import { loadBatGeometry } from './loadBatGeometry.js';

const BAT_MODEL_URL = './models/bat_animation_fly.glb';
// Visual size of the bat formation relative to the normalized (radius-1)
// geometry returned by loadBatGeometry.
const BAT_TARGET_SCALE = 3.2;

// Samples `count` points across the bat mesh surface (repeating with a small
// jitter once `count` exceeds the vertex count) so every particle can be
// assigned a target point to converge on during the breakdown moment.
export async function sampleBatTargets(count) {
  const { geometry } = await loadBatGeometry(BAT_MODEL_URL);
  const position = geometry.attributes.position;
  const vertexCount = position.count;

  const targets = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const src = i % vertexCount;
    const jitter = 0.02;
    targets[i * 3 + 0] = (position.getX(src) + (Math.random() - 0.5) * jitter) * BAT_TARGET_SCALE;
    targets[i * 3 + 1] = (position.getY(src) + (Math.random() - 0.5) * jitter) * BAT_TARGET_SCALE;
    targets[i * 3 + 2] = (position.getZ(src) + (Math.random() - 0.5) * jitter) * BAT_TARGET_SCALE;
  }

  geometry.dispose();
  return targets;
}
