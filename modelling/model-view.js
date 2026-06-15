// model-view.js — shared GLB load + framing for every modelling viewer and the
// editor preview. Keeping the normalise + camera math in one place guarantees
// the framing curated in the editor is byte-identical to what visitors see.
//
// Imports resolve via each page's <script type="importmap"> ("three", "three/addons/").

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Cache fetched .glb bytes so re-opening a work in the editor (or revisiting a
// model) doesn't re-download it — important for large character models.
THREE.Cache.enabled = true;

const loader = new GLTFLoader();

// Per-work camera defaults. lift=0, dolly=5.5 reproduce the original framing.
export const CAMERA_DEFAULTS = { lift: 0, dolly: 5.5 };

// Distance limits — also used to bound the editor's Distance slider.
export const DOLLY_MIN = 2;
export const DOLLY_MAX = 14;

/**
 * Flat grey material with optional normal map — the portfolio's house look.
 * Models that ship a diffuse texture keep their own material.
 */
export function makeGreyMaterial(src) {
  if (src && src.map) return src; // textured — use as-is
  const mat = new THREE.MeshStandardMaterial({
    color: 0xcccccc, roughness: 0.88, metalness: 0.0,
    normalMap: (src && src.normalMap) || null,
  });
  if (src && src.normalScale) mat.normalScale.copy(src.normalScale);
  return mat;
}

/**
 * Load a .glb, normalise scale + position, and apply the grey material.
 * Resolves { model, animations, frame:{ baseX, yMid } } where `frame` is what
 * applyCamera() needs. `targetSize` controls the normalised max dimension
 * (3.8 for full views, smaller for thumbnails).
 */
export function loadModel(url, { targetSize = 3.8 } = {}) {
  return new Promise((resolve, reject) => {
    loader.load(url, (gltf) => {
      const model  = gltf.scene;
      const box    = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size   = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const scale  = targetSize / maxDim;
      const baseX  = -center.x * scale;
      model.scale.setScalar(scale);
      model.position.set(baseX, -center.y * scale, -center.z * scale);
      model.traverse(child => {
        if (child.isMesh) child.material = makeGreyMaterial(child.material);
      });
      const yMid = (-center.y * scale) + (size.y * scale * 0.5);
      resolve({ model, animations: gltf.animations || [], frame: { baseX, yMid } });
    }, undefined, reject);
  });
}

/**
 * Point an OrbitControls camera at a framed model, honouring the work's curated
 * camera (vertical `lift` + `dolly` distance). With no `camera` set it matches
 * the original default exactly (camera at yMid + baseHeight, distance 5.5).
 *
 * @param baseHeight extra height baked into the default look (0.8 full, 0.6 thumb).
 */
export function applyCamera(camera, controls, frame, work, baseHeight = 0.8) {
  const lift  = work?.camera?.lift  ?? CAMERA_DEFAULTS.lift;
  const dolly = work?.camera?.dolly ?? CAMERA_DEFAULTS.dolly;
  controls.target.set(frame.baseX, frame.yMid + lift, 0);
  camera.position.set(frame.baseX, frame.yMid + baseHeight + lift, dolly);
  controls.update();
}
