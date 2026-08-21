import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import WebGPU from 'three/addons/capabilities/WebGPU.js';
import './styles.css';

import { createParameters } from './simulation/parameters.js';
import { createSimulation } from './simulation/createSimulation.js';
import { MOMENTS } from './simulation/moments.js';
import { createLabPanel } from './ui/labPanel.js';

// Quadrupled for Apple Silicon (M-series) headroom — lower this if the
// frame rate doesn't hold up on the target machine.
const PARTICLE_COUNT = 320000;

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

  // POINTER -> WORLD POSITION --------------------------------------------
  const pointerNdc = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const interactionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();

  addEventListener('pointermove', (event) => {
    pointerNdc.x = (event.clientX / innerWidth) * 2 - 1;
    pointerNdc.y = -(event.clientY / innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    if (raycaster.ray.intersectPlane(interactionPlane, hit)) {
      params.attractor.value.copy(hit);
      attractorHelper.position.copy(hit);
    }
  });

  let paused = false;
  let mode = 'LAB';
  let panel;
  let currentMoment = MOMENTS[0].id;

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
  hud.innerHTML = '<span id="hints"><strong>LAB</strong> · P: performance · R: reset · 1-6: momentos · espacio: impulso</span><br><span id="momentLabel"></span>';
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
    // The impulse is a one-shot "hit"; it decays here so a moment's own
    // parameters never drift on their own between keypresses.
    params.impulse.value = Math.max(0, params.impulse.value - frameDt * 2.5);

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
