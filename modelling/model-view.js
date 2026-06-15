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

// Distance limits — also used to bound the editor's Distance slider. The max is
// generous so tall/elongated models (and portrait viewports) can be pulled far
// enough back to contain the whole silhouette.
export const DOLLY_MIN = 2;
export const DOLLY_MAX = 30;

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
 * Resolves { model, animations, frame:{ baseX, yMid, half } } where `frame` is
 * what applyCamera()/fitDolly() need (`half` = normalised half-extents on each
 * axis). `targetSize` controls the normalised max dimension (3.8 for full views,
 * smaller for thumbnails).
 */
export function loadModel(url, { targetSize = 3.8 } = {}) {
  return new Promise((resolve, reject) => {
    loader.load(url, (gltf) => {
      const model  = gltf.scene;
      // Propagate world matrices before measuring. Rigged/skinned models (e.g.
      // Auto-Rig Pro exports) bake transforms into the bind pose; without this
      // Box3.setFromObject reads un-updated matrices and returns a too-small box,
      // which over-scales the model and pushes it out of frame.
      model.updateMatrixWorld(true);
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
      // Half-extents of the normalised model — fitDolly() needs these to work
      // out how far back the camera must sit to contain the whole silhouette.
      const half = {
        x: size.x * scale * 0.5,
        y: size.y * scale * 0.5,
        z: size.z * scale * 0.5,
      };
      resolve({ model, animations: gltf.animations || [], frame: { baseX, yMid, half } });
    }, undefined, reject);
  });
}

/**
 * Distance the camera must sit from the model centre to contain its full
 * height AND width given the camera's vertical FOV and current viewport aspect.
 * `margin` (>1) leaves breathing room; the result is clamped to the dolly range.
 * Falls back gracefully when `frame.half` is missing (older callers).
 */
export function fitDolly(camera, frame, margin = 1.18) {
  const half = (frame && frame.half) || { x: 1.9, y: 1.9, z: 1.9 };
  const vFov = (camera.fov * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (camera.aspect || 1));
  const distV = half.y / Math.tan(vFov / 2);   // fit the height
  const distH = half.x / Math.tan(hFov / 2);   // fit the width
  const dist  = Math.max(distV, distH) * margin + half.z;  // +half.z clears the near face
  return Math.min(DOLLY_MAX, Math.max(DOLLY_MIN, dist));
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
  // No curated distance → auto-fit so the whole model is contained.
  const dolly = work?.camera?.dolly ?? fitDolly(camera, frame);
  controls.target.set(frame.baseX, frame.yMid + lift, 0);
  camera.position.set(frame.baseX, frame.yMid + baseHeight + lift, dolly);
  controls.update();
}
