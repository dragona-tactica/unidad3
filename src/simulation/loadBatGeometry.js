import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const KEPT_ATTRIBUTES = ['position', 'normal', 'uv', 'aWing'];

// Loads the rigged bat model and flattens it into a single static geometry
// (bind pose, no skinning) so it can be driven by the existing GPU force
// simulation through InstancedMesh. Wing vertices are tagged with a custom
// `aWing` attribute so the render shader can animate them separately.
export async function loadBatGeometry(url) {
  const gltf = await new GLTFLoader().loadAsync(url);
  gltf.scene.updateMatrixWorld(true);

  const parts = [];
  let bodyTexture = null;

  gltf.scene.traverse((node) => {
    if (!node.isMesh) return;

    const geometry = node.geometry.clone();
    geometry.applyMatrix4(node.matrixWorld);

    const isWing = node.name.toLowerCase().includes('wing');
    const wingFlag = new Float32Array(geometry.attributes.position.count).fill(isWing ? 1 : 0);
    geometry.setAttribute('aWing', new THREE.BufferAttribute(wingFlag, 1));

    for (const name of Object.keys(geometry.attributes)) {
      if (!KEPT_ATTRIBUTES.includes(name)) geometry.deleteAttribute(name);
    }
    geometry.morphAttributes = {};
    geometry.setIndex(geometry.getIndex());

    if (!bodyTexture && node.material?.map) bodyTexture = node.material.map;

    parts.push({ geometry, isEyes: node.name.toLowerCase().includes('eye') });
  });

  const merged = mergeGeometries(parts.map((part) => part.geometry), true);
  merged.groups.forEach((group, index) => {
    group.materialIndex = parts[index].isEyes ? 1 : 0;
  });

  merged.computeBoundingBox();
  const center = new THREE.Vector3();
  merged.boundingBox.getCenter(center);
  merged.translate(-center.x, -center.y, -center.z);
  merged.computeBoundingSphere();

  // Normalize to a unit bounding sphere so callers can size the bat purely
  // through a world-space scale factor, independent of the source model's
  // native units.
  const radius = merged.boundingSphere.radius || 1;
  merged.scale(1 / radius, 1 / radius, 1 / radius);
  merged.computeBoundingSphere();

  if (bodyTexture) bodyTexture.colorSpace = THREE.SRGBColorSpace;

  return { geometry: merged, texture: bodyTexture, radius: merged.boundingSphere.radius };
}
