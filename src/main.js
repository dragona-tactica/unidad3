import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import WebGPU from 'three/addons/capabilities/WebGPU.js';
import './styles.css';

import { createParameters } from './simulation/parameters.js';
import { createSimulation } from './simulation/createSimulation.js';
import { MOMENTS } from './simulation/moments.js';
import { createLabPanel } from './ui/labPanel.js';

// Bumped again to fill the screen on Apple Silicon (M-series) — lower this
// if the frame rate doesn't hold up on the target machine.
const PARTICLE_COUNT = 1000000;

async function main() {
  const mount = document.querySelector('#app');

  if (!WebGPU.isAvailable()) {
    mount.appendChild(WebGPU.getErrorMessage());
    throw new Error('Este proyecto requiere WebGPU para ejecutar compute shaders.');
  }

  // THREE.JS MENTAL MODEL: scene + camera + renderer ---------------------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#050607');

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.05, 100);
  camera.position.set(0, 0, 11);

  const renderer = new THREE.WebGPURenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  // The trail pass paints its own fade quad every frame instead of a hard
  // clear, so the renderer must not clear the color buffer on its own.
  renderer.autoClear = false;
  mount.appendChild(renderer.domElement);
  await renderer.init();

  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.target.set(0, 0, 0);

  const params = createParameters();
  const simulation = await createSimulation({ renderer, scene, params, count: PARTICLE_COUNT });

  // LAB HELPERS -----------------------------------------------------------
  const attractorHelper = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 16, 12),
    new THREE.MeshBasicMaterial({ color: '#ffffff' })
  );
  scene.add(attractorHelper);
  const axes = new THREE.AxesHelper(1.5);
  scene.add(axes);

  let paused = false;
  let mode = 'LAB';
  let panel;
  let currentMoment = MOMENTS[0].id;

  // POINTER -> WORLD POSITION --------------------------------------------
  // Every moment now has its own fixed attraction point instead of the
  // pointer — except breakdown (bat), which still follows the pointer
  // exactly as before, untouched.
  const pointerNdc = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const interactionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();

  addEventListener('pointermove', (event) => {
    if (currentMoment !== 'breakdown') return;
    pointerNdc.x = (event.clientX / innerWidth) * 2 - 1;
    pointerNdc.y = -(event.clientY / innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    if (raycaster.ray.intersectPlane(interactionPlane, hit)) {
      params.attractor.value.copy(hit);
      attractorHelper.position.copy(hit);
    }
  });

  // Hold-to-attract / hold-to-repel: while the key is down, this fully
  // overrides the current moment's own centerAttraction/dispersion with a
  // strong value; releasing it restores whatever the moment last set.
  // Only the value at the moment the key goes down is saved, so a moment
  // switch that happens mid-hold is respected once the key comes back up.
  const ATTRACT_HOLD_STRENGTH = 1.8;
  const REPEL_HOLD_STRENGTH = 1.8;
  let savedCenterAttraction = null;
  let savedDispersion = null;

  // Applying a moment only sets target values once, right now — nothing
  // here runs on a timer, so the system never changes state on its own.
  const applyMoment = (id) => {
    const moment = MOMENTS.find((m) => m.id === id);
    if (!moment) return;
    currentMoment = id;
    for (const [key, value] of Object.entries(moment.params)) {
      // Color uniforms hold a THREE.Color instance; moments give hex
      // strings, so update the instance in place rather than overwrite it.
      if (params[key].value?.isColor) params[key].value.set(value);
      else params[key].value = value;
    }
    // Fixed attraction point for every moment except breakdown (bat),
    // which keeps following the pointer instead — see pointermove above.
    if (id !== 'breakdown') {
      params.attractor.value.set(0, 0, 0);
      attractorHelper.position.set(0, 0, 0);
    }
    panel?.refresh();
    hud.querySelector('#momentLabel').textContent = `${moment.label} (${moment.range})`;
  };

  const setMode = (next) => {
    mode = next;
    const lab = mode === 'LAB';
    panel.setVisible(lab);
    axes.visible = lab;
    attractorHelper.visible = lab;
    hud.querySelector('#hints').style.display = lab ? '' : 'none';
  };

  panel = createLabPanel({
    params,
    moments: MOMENTS,
    onReset: () => simulation.reset(),
    onMoment: applyMoment,
    onModeChange: () => setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB'),
    onPauseChange: () => (paused = !paused)
  });

  const hud = document.createElement('div');
  hud.className = 'hud';
  hud.innerHTML = '<span id="hints"><strong>LAB</strong> · P: performance · R: reset · 1-6: momentos · espacio: impulso · A: atraer · D: repeler · B: vibrar (arena en altavoz)</span><br><span id="momentLabel"></span>';
  document.body.append(hud);
  setMode('LAB');
  applyMoment(MOMENTS[0].id);

  // KEY MAPPING: the digits mirror the song's own moment numbering (1-6). --
  addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (event.code === 'KeyP') setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB');
    if (event.code === 'KeyR') simulation.reset();

    const moment = MOMENTS.find((m) => m.key === event.code);
    if (moment) applyMoment(moment.id);

    if (event.code === 'Space') {
      event.preventDefault();
      params.impulse.value = 1.0;
    }

    // Tap on the beat: sand-on-a-speaker vibration for up to 1.5s (see
    // the pulse force in createSimulation.js).
    if (event.code === 'KeyB') params.pulse.value = 1.0;

    // Hold to attract / hold to repel — a live override on top of
    // whatever the current moment already set.
    if (event.code === 'KeyA') {
      savedCenterAttraction = params.centerAttraction.value;
      params.centerAttraction.value = ATTRACT_HOLD_STRENGTH;
      panel?.refresh();
    }
    if (event.code === 'KeyD') {
      savedDispersion = params.dispersion.value;
      params.dispersion.value = REPEL_HOLD_STRENGTH;
      panel?.refresh();
    }
  });

  addEventListener('keyup', (event) => {
    if (event.code === 'KeyA' && savedCenterAttraction !== null) {
      params.centerAttraction.value = savedCenterAttraction;
      savedCenterAttraction = null;
      panel?.refresh();
    }
    if (event.code === 'KeyD' && savedDispersion !== null) {
      params.dispersion.value = savedDispersion;
      savedDispersion = null;
      panel?.refresh();
    }
  });

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  simulation.reset();

  // FRAME LOOP ------------------------------------------------------------
  let lastTime = performance.now();
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const frameDt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    params.frame.value += 1;
    // The impulse and pulse are one-shot "hits"; they decay here so a
    // moment's own parameters never drift on their own between keypresses.
    params.impulse.value = Math.max(0, params.impulse.value - frameDt * 2.5);
    // Pulse is a plain envelope for the "sand on a speaker" vibration in
    // createSimulation.js — linear decay to 0 over exactly 1.5s, so a tap
    // never rings on longer than that regardless of how fast it's re-tapped.
    params.pulse.value = Math.max(0, params.pulse.value - frameDt / 1.5);

    if (!paused) simulation.stepSimulation();
    orbit.update();
    // Color is cleared by the trail quad (see createSimulation.js), but
    // depth still needs a real clear each frame — otherwise last frame's
    // particle depth lingers and can occlude particles that moved closer.
    renderer.clearDepth();
    renderer.render(scene, camera);
  });
}

main().catch((error) => {
  console.error(error);
  const pre = document.createElement('pre');
  pre.style.cssText = 'position:fixed;inset:16px;white-space:pre-wrap;color:#fff;z-index:50';
  pre.textContent = String(error?.stack || error);
  document.body.append(pre);
});
