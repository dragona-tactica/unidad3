import * as THREE from 'three/webgpu';
import {
  Fn,
  If,
  attribute,
  cos,
  cross,
  hash,
  instanceIndex,
  instancedArray,
  max,
  mod,
  normalize,
  positionLocal,
  sign,
  sin,
  texture,
  time,
  uint,
  uv,
  vec3
} from 'three/tsl';
import { loadBatGeometry } from './loadBatGeometry.js';

const BAT_MODEL_URL = './models/bat_animation_fly.glb';
// Normalized model has bounding-sphere radius 1; this puts a bat at a
// visible scale relative to boundsSize (10) once multiplied by particleSize.
const BAT_VISUAL_SCALE = 12.0;

export async function createSimulation({ renderer, scene, params, count = 131072 }) {
  // STATE -----------------------------------------------------------------
  // Each particle owns position and velocity. The arrays live in GPU storage.
  const positionBuffer = instancedArray(count, 'vec3');
  const velocityBuffer = instancedArray(count, 'vec3');

  // INITIALIZATION --------------------------------------------------------
  // A compute pass writes the initial state for every particle in parallel.
  const initParticles = Fn(() => {
    const i = instanceIndex;
    const p = positionBuffer.element(i);
    const v = velocityBuffer.element(i);

    const r1 = hash(i.add(uint(11)));
    const r2 = hash(i.add(uint(23)));
    const r3 = hash(i.add(uint(37)));
    const r4 = hash(i.add(uint(53)));
    const r5 = hash(i.add(uint(71)));
    const r6 = hash(i.add(uint(89)));

    p.assign(vec3(r1, r2, r3).sub(0.5).mul(params.boundsSize.mul(0.45)));
    v.assign(vec3(r4, r5, r6).sub(0.5).mul(params.initialSpeed));
  })().compute(count).setName('Initialize Particles');

  // UPDATE / COMPUTE SHADER ----------------------------------------------
  // This is the conceptual heart of the project:
  // state -> forces -> acceleration -> velocity -> position.
  const updateParticles = Fn(() => {
    const p = positionBuffer.element(instanceIndex);
    const v = velocityBuffer.element(instanceIndex);

    const dt = params.dt.mul(params.timeScale);
    const force = vec3(0.0).toVar();

    // 1) CONSTANT / WIND FORCE
    force.addAssign(params.wind.mul(params.windEnabled));

    // 2) RADIAL FORCE (positive = attraction, negative = repulsion)
    const toAttractor = params.attractor.sub(p);
    const distance = max(toAttractor.length(), params.softening);
    const radialDirection = toAttractor.div(distance);
    const radialForce = radialDirection
      .mul(params.radialStrength)
      .div(distance.pow(2))
      .mul(params.radialEnabled);
    force.addAssign(radialForce);

    // 3) VORTEX FORCE: tangent to the radial direction around Z.
    const zAxis = vec3(0.0, 0.0, 1.0);
    const tangent = zAxis.cross(radialDirection);
    force.addAssign(tangent.mul(params.vortexStrength).mul(params.vortexEnabled));

    // 4) LINEAR DRAG: F = -c v
    force.addAssign(v.mul(params.dragCoefficient).mul(params.dragEnabled).mul(-1.0));

    // INTEGRATION ---------------------------------------------------------
    // Unit mass: a = F. Semi-implicit Euler: update v, then p.
    v.addAssign(force.mul(dt));

    const speed = v.length();
    If(speed.greaterThan(params.maxSpeed), () => {
      v.assign(v.normalize().mul(params.maxSpeed));
    });

    p.addAssign(v.mul(dt));

    // Periodic boundary conditions: particles leaving one side re-enter.
    const half = params.boundsSize.mul(0.5);
    p.assign(mod(p.add(half), params.boundsSize).sub(half));
  })().compute(count).setName('Update Particles');

  // RENDER ---------------------------------------------------------------
  // Rendering does not recompute the physics. It consumes the GPU state.
  // The bat mesh replaces the plain sprite, but position still comes only
  // from positionBuffer/velocityBuffer: state -> forces -> integration ->
  // render stays intact. Wing flap and orientation are cosmetic, GPU-side,
  // vertex-shader effects layered on top of that same state.
  const { geometry, texture: batTexture } = await loadBatGeometry(BAT_MODEL_URL);

  // Shared across both materials (body+wing+hair and eyes) so every
  // instance/vertex is placed identically regardless of material group.
  const positionNode = Fn(() => {
    const i = instanceIndex;
    const center = positionBuffer.element(i);
    const v = velocityBuffer.element(i);

    const local = positionLocal.mul(params.particleSize).mul(BAT_VISUAL_SCALE);
    const isWing = attribute('aWing');

    // Cosmetic wing flap: a per-instance phased sine, mirrored by wing side.
    const phase = hash(i.add(uint(211))).mul(6.28318);
    const flapAngle = sin(time.mul(params.flapSpeed).add(phase)).mul(params.flapAmplitude).mul(isWing);
    const side = sign(local.x);
    const angle = flapAngle.mul(side);
    const ca = cos(angle);
    const sa = sin(angle);
    const flapped = vec3(
      local.x,
      local.y.mul(ca).sub(local.z.mul(sa)),
      local.y.mul(sa).add(local.z.mul(ca))
    );

    // Orient the bat to face its velocity direction.
    const forward = v.div(max(v.length(), 0.0001));
    const worldUp = vec3(0.0, 1.0, 0.0001);
    const right = normalize(cross(worldUp, forward));
    const up = cross(forward, right);
    const oriented = right.mul(flapped.x).add(up.mul(flapped.y)).add(forward.mul(flapped.z));

    return center.add(oriented);
  })();

  const bodyMaterial = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
  bodyMaterial.positionNode = positionNode;
  if (batTexture) {
    bodyMaterial.colorNode = texture(batTexture, uv());
  }

  const eyesMaterial = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, color: '#050505' });
  eyesMaterial.positionNode = positionNode;

  const mesh = new THREE.InstancedMesh(geometry, [bodyMaterial, eyesMaterial], count);
  mesh.frustumCulled = false;
  scene.add(mesh);

  function reset() {
    renderer.compute(initParticles);
  }

  function stepSimulation() {
    renderer.compute(updateParticles);
  }

  function dispose() {
    geometry.dispose();
    bodyMaterial.dispose();
    eyesMaterial.dispose();
    scene.remove(mesh);
  }

  return {
    count,
    positionBuffer,
    velocityBuffer,
    reset,
    stepSimulation,
    dispose
  };
}
