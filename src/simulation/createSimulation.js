import * as THREE from 'three/webgpu';
import {
  Fn,
  color,
  greaterThanEqual,
  hash,
  instanceIndex,
  instancedArray,
  max,
  mix,
  mx_fractal_noise_vec3,
  normalize,
  oneMinus,
  positionGeometry,
  select,
  smoothstep,
  storage,
  time,
  uint,
  uv,
  vec3,
  vec4
} from 'three/tsl';
import { sampleBatTargets } from './sampleBatTargets.js';

// state -> forces -> integration -> render, same mental model as the
// forces lab, but the "state" now includes an age per particle so moments
// can spawn (birthRate) and dissipate (lifetimeRate) a population instead
// of only pushing a fixed set of particles around.
export async function createSimulation({ renderer, scene, params, count = 20000 }) {
  // STATE -----------------------------------------------------------------
  const positionBuffer = instancedArray(count, 'vec3');
  const velocityBuffer = instancedArray(count, 'vec3');
  const ageBuffer = instancedArray(count, 'float'); // 0 = just born, >=1 = dead

  // Precomputed target point (on the bat silhouette) each particle is
  // pulled toward when the "bat" formation parameter is active.
  const targetData = await sampleBatTargets(count);
  const targetBuffer = storage(new THREE.StorageBufferAttribute(targetData, 3), 'vec3', count);

  // INITIALIZATION ----------------------------------------------------------
  // Everyone starts alive so the scene shows the current moment immediately
  // on load/reset, without needing pointer movement or a birthRate ramp-up
  // to become visible. The birth/death mechanic itself still exists for
  // moments that use it live (drop, outro) — it just doesn't gate the very
  // first frame.
  const initParticles = Fn(() => {
    const i = instanceIndex;
    const p = positionBuffer.element(i);
    const v = velocityBuffer.element(i);
    const age = ageBuffer.element(i);

    const r1 = hash(i.add(uint(11)));
    const r2 = hash(i.add(uint(23)));
    const r3 = hash(i.add(uint(37)));

    p.assign(vec3(r1, r2, r3).sub(0.5).mul(0.6));
    v.assign(vec3(0.0));
    age.assign(0.0);
  })().compute(count).setName('Initialize Particles');

  // UPDATE / COMPUTE SHADER ------------------------------------------------
  // Written branchless (select() instead of If/Else): every particle
  // computes both the "reborn" and "alive" candidate next-states, then
  // one unconditional assign picks the right one.
  const updateParticles = Fn(() => {
    const i = instanceIndex;
    const p0 = positionBuffer.element(i);
    const v0 = velocityBuffer.element(i);
    const age0 = ageBuffer.element(i);
    const target = targetBuffer.element(i);

    const dt = params.frameDt.mul(params.timeScale);
    const wasDead = age0.greaterThanEqual(1.0);

    // BIRTH CANDIDATE: only some dead particles reroll successfully each
    // frame, so birthRate reads as "how fast the population fills in".
    const seed = uint(params.frame).mul(uint(2654435761)).add(i.mul(uint(2246822519))).add(uint(1));
    const roll = hash(seed);
    const reborn = wasDead.and(roll.lessThan(params.birthRate.mul(dt)));

    const r1 = hash(seed.add(uint(17)));
    const r2 = hash(seed.add(uint(29)));
    const r3 = hash(seed.add(uint(41)));
    const rv1 = hash(seed.add(uint(53)));
    const rv2 = hash(seed.add(uint(59)));
    const rv3 = hash(seed.add(uint(61)));
    const bornPos = params.attractor.add(vec3(r1, r2, r3).sub(0.5).mul(0.6));
    const bornVel = vec3(rv1, rv2, rv3).sub(0.5).mul(0.4);

    // ALIVE CANDIDATE: forces + integration, computed from the pre-frame
    // snapshot. Harmless to compute even for dead particles — it's simply
    // discarded by the final select() below.
    const force = vec3(0.0).toVar();

    // 1) CENTER ATTRACTION: pull toward the interactive attractor.
    const toAttractor = params.attractor.sub(p0);
    const distAttractor = max(toAttractor.length(), 0.25);
    force.addAssign(toAttractor.div(distAttractor).mul(params.centerAttraction).mul(6.0));

    // 2) DISPERSION: push away from the world origin.
    const distCenter = max(p0.length(), 0.25);
    force.addAssign(p0.div(distCenter).mul(params.dispersion).mul(6.0));

    // 3) TURBULENCE: chaotic noise field, drifting over time.
    const noiseCoord = p0.mul(0.5).add(vec3(0.0, 0.0, time.mul(0.6)));
    force.addAssign(mx_fractal_noise_vec3(noiseCoord).mul(params.turbulence).mul(8.0));

    // 4) RING FORMATION: settle onto one of a few concentric radii, with
    // a tangential push so it reads as an orbit, not just a shell.
    const radius = max(p0.length(), 0.001);
    const radialDir = p0.div(radius);
    const ringLevel = hash(i.add(uint(97))).mul(3.0).floor().add(1.0);
    const targetRadius = ringLevel.mul(params.ringSpacing);
    force.addAssign(radialDir.mul(targetRadius.sub(radius)).mul(params.ring).mul(2.5));
    const tangent = vec3(0.0, 0.0, 1.0).cross(radialDir);
    force.addAssign(tangent.mul(params.ring).mul(3.0));

    // 5) BAT FORMATION: converge on the assigned silhouette point.
    force.addAssign(target.sub(p0).mul(params.bat).mul(4.0));

    // 6) DAMPING (friction): F = -c v
    force.addAssign(v0.mul(params.damping).mul(-1.0));

    // 7) IMPULSE: manual outward "hit", set from JS on keydown and
    // decayed from JS every frame afterward.
    const impulseDir = normalize(p0.sub(params.attractor).add(vec3(0.0001, 0.0, 0.0)));
    force.addAssign(impulseDir.mul(params.impulse).mul(10.0));

    // INTEGRATION -----------------------------------------------------
    const rawVel = v0.add(force.mul(dt));
    const speed = rawVel.length();
    const cappedVel = select(speed.greaterThan(params.maxSpeed), rawVel.normalize().mul(params.maxSpeed), rawVel);
    const rawPos = p0.add(cappedVel.mul(dt));

    // Soft containment: nudge back instead of teleporting, so it never
    // breaks a ring or bat formation with a visible jump.
    const distFromOrigin = rawPos.length();
    const boundary = params.boundsSize.mul(0.5);
    const overshoot = max(distFromOrigin.sub(boundary), 0.0);
    const containedVel = cappedVel.sub(rawPos.normalize().mul(overshoot).mul(4.0).mul(dt));

    const aliveAge = age0.add(params.lifetimeRate.mul(dt));

    // FINAL SELECT: reborn > still-dead (frozen) > alive-updated. -------
    const nextPos = select(reborn, bornPos, select(wasDead, p0, rawPos));
    const nextVel = select(reborn, bornVel, select(wasDead, v0, containedVel));
    const nextAge = select(reborn, 0.0, select(wasDead, age0, aliveAge));

    positionBuffer.element(i).assign(nextPos);
    velocityBuffer.element(i).assign(nextVel);
    ageBuffer.element(i).assign(nextAge);
  })().compute(count).setName('Update Particles');

  // RENDER ------------------------------------------------------------------
  // Placeholder look (color/shape) — swap once the performance aesthetics
  // per moment are defined; the mechanics above don't depend on it.
  //
  // Opaque + depth-tested + alpha-tested (not additive/transparent): with
  // thousands of particles overlapping in a dense shell, additive blending
  // sums every overlap toward white and erases the individual points. Depth
  // testing instead makes particles occlude each other like solid dots, so
  // a dense cluster reads as a textured, granular sphere — visible discrete
  // points, not a glowing blob — matching the reference sketch.
  const material = new THREE.SpriteNodeMaterial({
    depthWrite: true,
    depthTest: true,
    transparent: false,
    alphaTest: 0.5
  });

  material.positionNode = positionBuffer.toAttribute();
  material.scaleNode = params.particleSize;

  const lifeAlpha = Fn(() => {
    const age = ageBuffer.toAttribute();
    const isDead = greaterThanEqual(age, 1.0);
    const dyingFade = oneMinus(smoothstep(0.75, 1.0, age));
    return select(isDead, 0.0, dyingFade);
  })();

  material.colorNode = Fn(() => {
    const speed = velocityBuffer.toAttribute().length();
    const t = speed.div(params.maxSpeed).clamp(0.0, 1.0);
    const slow = color('#3ea0ff');
    const fast = color('#ffffff');
    return vec4(mix(slow, fast, t), 1.0);
  })();

  // Soft-edged circle; alphaTest above discards the corners/fringe so the
  // depth buffer only ever gets written where a dot is actually visible.
  const circularMask = oneMinus(smoothstep(0.4, 0.5, uv().xy.sub(0.5).length()));
  material.opacityNode = circularMask.mul(lifeAlpha).mul(params.opacity);

  const geometry = new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  scene.add(mesh);

  // TRAIL PASS ---------------------------------------------------------------
  // A camera-independent full-screen quad, drawn first each frame without
  // clearing, that fades the previous frame toward black. trail=0 behaves
  // like a normal clear; trail=1 never fades (infinite trail).
  const trailMaterial = new THREE.MeshBasicNodeMaterial();
  trailMaterial.transparent = true;
  trailMaterial.depthWrite = false;
  trailMaterial.depthTest = false;
  // vertexNode replaces the whole vertex stage (bypassing the camera's
  // model-view-projection), which is what makes this quad screen-space.
  trailMaterial.vertexNode = Fn(() => vec4(positionGeometry.xy, 0.0, 1.0))();
  trailMaterial.colorNode = vec4(0.0, 0.0, 0.0, oneMinus(params.trail));

  const trailQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), trailMaterial);
  trailQuad.frustumCulled = false;
  trailQuad.renderOrder = -1;
  scene.add(trailQuad);

  function reset() {
    renderer.compute(initParticles);
  }

  function stepSimulation() {
    renderer.compute(updateParticles);
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
    scene.remove(mesh);
    trailQuad.geometry.dispose();
    trailMaterial.dispose();
    scene.remove(trailQuad);
  }

  return {
    count,
    positionBuffer,
    velocityBuffer,
    ageBuffer,
    reset,
    stepSimulation,
    dispose
  };
}
