// app.js — local 3D model troubleshooter.
//
// Goal: show a .glb EXACTLY as the portfolio will, then layer on inspection
// tools the live site doesn't expose. The render pipeline (three version,
// lights, grey "house" material, framing) is a faithful mirror of
//   modelling/index.html  +  modelling/model-view.js
// so anything that looks wrong here will look wrong on the site — and vice
// versa. Where this file re-implements portfolio logic it imports the real
// helpers from model-view.js so the two can't silently drift.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { HalftonePass } from 'three/addons/postprocessing/HalftonePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { makeGreyMaterial, fitDolly, applyCamera } from '../modelling/model-view.js';

// Bundled models live in ../media/models. Browsers can't list a directory, so
// this list is maintained by hand — add new files here to get them in the menu.
const BUNDLED = [
  'Mumei_Walk_Cycle.glb', 'mdl.pancake-syrup.glb',
];

// ── DOM ───────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const canvas = $('viewer'), stage = $('stage'), emptyState = $('empty-state');

// ── Renderer / scene (mirrors modelling/index.html) ───────────────────────
const RENDER_SCALE = 1.5;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, RENDER_SCALE));

const scene = new THREE.Scene();
// scene.background stays pure white/black so the canvas blend can dissolve it
// into the paper page — exactly how the live site composites (style.css
// #main-canvas: multiply on light, screen on dark). PAPER mirrors --paper.
const BG = { light: 0xffffff, dark: 0x000000, mid: 0x6b7280 };
const PAPER = { light: '#f0ede8', dark: '#191714' };
scene.background = new THREE.Color(BG.light);

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
camera.position.set(0, 1.5, 5.5);

// Lighting — identical to the portfolio.
const keyLight = new THREE.DirectionalLight(0xffffff, 3.4); keyLight.position.set(5, 9, 5);
const fillLight = new THREE.DirectionalLight(0xffffff, 0.7); fillLight.position.set(-5, 2, 3);
const rimLight = new THREE.DirectionalLight(0xffffff, 0.35); rimLight.position.set(-2, 6, -6);
scene.add(keyLight, fillLight, rimLight, new THREE.AmbientLight(0xffffff, 0.62));

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.autoRotateSpeed = 1.2;

// Helpers (toggled from the panel).
const grid = new THREE.GridHelper(12, 12, 0x999999, 0xcccccc);
grid.material.transparent = true; grid.material.opacity = 0.35;
const axes = new THREE.AxesHelper(2.5); axes.visible = false;
const bboxHelper = new THREE.Box3Helper(new THREE.Box3(), 0xff3b6b); bboxHelper.visible = false;
scene.add(grid, axes, bboxHelper);

const normalMat = new THREE.MeshNormalMaterial();
const loader = new GLTFLoader();

// ── Halftone post-processing (exact copy of modelling/index.html) ──────────
// This is the site's signature look: the model is rendered, then HalftonePass
// turns it into greyscale ink dots. Combined with the multiply blend over paper
// you get dark dots on cream — what visitors actually see.
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const halftonePass = new HalftonePass(1, 1, {
  shape: 1, radius: 3,
  rotateR: Math.PI / 4,
  rotateG: (Math.PI * 5) / 12,
  rotateB: Math.PI / 6,
  scatter: 0, blending: 1, blendingMode: 1,
  greyscale: true, disable: false,
});
halftonePass.material.fragmentShader =
  halftonePass.material.fragmentShader.replace('const int samples = 8;', 'const int samples = 3;');
halftonePass.material.needsUpdate = true;
composer.addPass(halftonePass);
composer.addPass(new OutputPass());

// ── State ─────────────────────────────────────────────────────────────────
const state = {
  material: 'grey', wireframe: false, theme: 'light', composite: true, halftone: true,
  model: null, frame: null, mixer: null, actions: [], clips: [], playing: true,
};

// Reproduce the site's final composited look: render to white/black, then let
// the canvas blend over a paper-coloured page. Turn off to inspect the raw render.
function applyBackground() {
  const t = state.theme;
  document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
  if (state.composite && t !== 'mid') {
    scene.background.set(t === 'dark' ? BG.dark : BG.light);
    stage.style.background = PAPER[t];
    canvas.style.mixBlendMode = t === 'dark' ? 'screen' : 'multiply';
  } else {
    scene.background.set(BG[t]);
    stage.style.background = '';
    canvas.style.mixBlendMode = 'normal';
  }
}
const clock = new THREE.Clock();

function setStatus(msg, isError = false) {
  $('status').textContent = msg;
  $('status').style.color = isError ? '#e23' : '';
}

// ── Load ──────────────────────────────────────────────────────────────────
// Re-implements the normalisation from model-view.js loadModel() so we can keep
// the original materials around (loadModel() discards them for the grey look).
// Keep this block in sync with model-view.js — same targetSize, same maths.
const TARGET_SIZE = 3.8;

function disposeModel() {
  if (!state.model) return;
  scene.remove(state.model);
  state.model.traverse(n => {
    if (n.geometry) n.geometry.dispose();
    for (const m of materialsOf(n)) m && m.dispose();
  });
  state.model = null;
  if (state.mixer) { state.mixer.stopAllAction(); state.mixer = null; }
  state.actions = []; state.clips = [];
}

function materialsOf(node) {
  if (!node.material) return [];
  return Array.isArray(node.material) ? node.material : [node.material];
}

function buildModel(gltf, label, fileBytes) {
  disposeModel();
  const model = gltf.scene || gltf.scenes[0];
  model.updateMatrixWorld(true);

  const rawBox = new THREE.Box3().setFromObject(model);
  const rawSize = rawBox.getSize(new THREE.Vector3());
  const center = rawBox.getCenter(new THREE.Vector3());
  const maxDim = Math.max(rawSize.x, rawSize.y, rawSize.z) || 1;
  const scale = TARGET_SIZE / maxDim;
  const baseX = -center.x * scale;
  model.scale.setScalar(scale);
  model.position.set(baseX, -center.y * scale, -center.z * scale);
  const half = { x: rawSize.x * scale * 0.5, y: rawSize.y * scale * 0.5, z: rawSize.z * scale * 0.5 };
  const yMid = (-center.y * scale) + half.y;
  state.frame = { baseX, yMid, half };

  // Stats + stash original/grey materials per mesh.
  const stats = {
    label, fileBytes, rawSize, maxDim, scale,
    meshes: 0, tris: 0, verts: 0, materials: new Set(), textures: [],
    missingNormals: false, missingUVForTexture: false, multiMaterial: false,
  };
  model.traverse(node => {
    if (!node.isMesh) return;
    node.frustumCulled = false;
    stats.meshes++;
    const g = node.geometry;
    const vcount = g.attributes.position ? g.attributes.position.count : 0;
    stats.verts += vcount;
    stats.tris += g.index ? g.index.count / 3 : vcount / 3;
    if (!g.attributes.normal) stats.missingNormals = true;
    const mats = materialsOf(node);
    if (mats.length > 1) stats.multiMaterial = true;
    node.userData.origMat = node.material;
    node.userData.greyMat = Array.isArray(node.material)
      ? node.material.map(m => makeGreyMaterial(m))
      : makeGreyMaterial(node.material);
    for (const m of mats) {
      if (!m) continue;
      stats.materials.add(m.type);
      for (const slot of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap']) {
        const tex = m[slot];
        if (tex && tex.image) {
          stats.textures.push({
            slot, name: tex.name || '(unnamed)',
            w: tex.image.width, h: tex.image.height,
            colorSpace: tex.colorSpace || 'no-color-space',
          });
          if (slot === 'map' && !g.attributes.uv) stats.missingUVForTexture = true;
        }
      }
    }
  });
  stats.tris = Math.round(stats.tris);
  modelTris = stats.tris;

  scene.add(model);
  state.model = model;

  // Animations — portfolio plays every baked clip; we let you solo one.
  state.clips = gltf.animations || [];
  if (state.clips.length) {
    state.mixer = new THREE.AnimationMixer(model);
    rebuildClipMenu();
    applyClipSelection();
    clock.getDelta();
  }
  $('anim-group').hidden = state.clips.length === 0;

  applyMaterial();
  bboxHelper.box.setFromObject(model);
  applyCamera(camera, controls, state.frame, null); // portfolio default framing
  controls.update();

  emptyState.hidden = true;
  $('file-name').textContent = label;
  setStatus(`Loaded ${label}.`);
  renderReport(stats);
  window.__viewer = { scene, model, stats, frame: state.frame };
}

function loadFromArrayBuffer(buf, label) {
  setStatus(`Loading ${label}…`);
  loader.parse(buf, '', gltf => buildModel(gltf, label, buf.byteLength),
    err => { console.error(err); setStatus('Could not parse that file. Use a self-contained .glb.', true); });
}

function loadFromUrl(url, label) {
  setStatus(`Loading ${label}…`);
  fetch(url).then(r => {
    if (!r.ok) throw new Error(r.status);
    return r.arrayBuffer();
  }).then(buf => loadFromArrayBuffer(buf, label))
    .catch(err => { console.error(err); setStatus(`Could not fetch ${label} (${err.message}).`, true); });
}

// ── Render modes ──────────────────────────────────────────────────────────
function applyMaterial() {
  if (!state.model) return;
  if (state.material === 'normals') {
    normalMat.wireframe = state.wireframe;
    scene.overrideMaterial = normalMat;
    return;
  }
  scene.overrideMaterial = null;
  state.model.traverse(node => {
    if (!node.isMesh) return;
    const pick = state.material === 'grey' ? node.userData.greyMat : node.userData.origMat;
    node.material = pick;
    for (const m of materialsOf(node)) if (m) m.wireframe = state.wireframe;
  });
}

// ── Animation menu ────────────────────────────────────────────────────────
function rebuildClipMenu() {
  const sel = $('clip');
  sel.innerHTML = '';
  const all = document.createElement('option');
  all.value = '*'; all.textContent = `All clips (${state.clips.length})`;
  sel.appendChild(all);
  state.clips.forEach((c, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = `${c.name || 'clip ' + i} · ${c.duration.toFixed(2)}s`;
    sel.appendChild(o);
  });
}

function applyClipSelection() {
  if (!state.mixer) return;
  state.mixer.stopAllAction();
  state.actions = [];
  const val = $('clip').value || '*';
  const chosen = val === '*' ? state.clips.map((_, i) => i) : [Number(val)];
  chosen.forEach(i => {
    const a = state.mixer.clipAction(state.clips[i]);
    a.reset(); a.play(); a.paused = !state.playing;
    state.actions.push(a);
  });
  state.mixer.timeScale = Number($('speed').value);
}

// ── Report ────────────────────────────────────────────────────────────────
const fmtBytes = b => b == null ? '—' : b < 1024 ? `${b} B`
  : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(2)} MB`;
const v3 = v => `${v.x.toFixed(2)} × ${v.y.toFixed(2)} × ${v.z.toFixed(2)}`;

function renderReport(s) {
  const rows = [
    ['File size', fmtBytes(s.fileBytes)],
    ['Raw size (model units)', v3(s.rawSize)],
    ['Normalised scale', `×${s.scale.toFixed(3)} → fits ${TARGET_SIZE}`],
    ['Meshes', s.meshes],
    ['Triangles', s.tris.toLocaleString()],
    ['Vertices', s.verts.toLocaleString()],
    ['Material types', [...s.materials].join(', ') || '—'],
    ['Textures', s.textures.length],
    ['Animations', state.clips.length],
  ];
  $('info').innerHTML = rows.map(([k, val]) =>
    `<dt>${k}</dt><dd>${val}</dd>`).join('') +
    s.textures.map(t =>
      `<dt class="tex">${t.slot}</dt><dd class="tex">${t.w}×${t.h} · ${t.colorSpace}</dd>`).join('');

  // ── Warnings: the actual point of the tool ──
  const warns = [];
  const pow2 = n => (n & (n - 1)) === 0;
  if (s.fileBytes > 5 * 1048576) warns.push(['⚠', `${fmtBytes(s.fileBytes)} is heavy — slow first load on the site. Consider Draco/decimate.`]);
  if (s.missingNormals) warns.push(['✕', 'A mesh has no normals — it will shade flat/black under the grey house material.']);
  if (s.missingUVForTexture) warns.push(['✕', 'A textured mesh has no UVs — its diffuse map can\'t display.']);
  for (const t of s.textures) {
    if (Math.max(t.w, t.h) > 2048) warns.push(['⚠', `${t.slot} is ${t.w}×${t.h} — large; 2K is usually plenty.`]);
    if (!pow2(t.w) || !pow2(t.h)) warns.push(['⚠', `${t.slot} ${t.w}×${t.h} is non-power-of-two — mipmaps/repeat may misbehave.`]);
    if (t.slot === 'map' && t.colorSpace !== 'srgb') warns.push(['⚠', `Diffuse ${t.name} colorSpace is "${t.colorSpace}" (expected srgb) — colours may look washed/dark.`]);
    if (t.slot === 'normalMap' && t.colorSpace === 'srgb') warns.push(['⚠', `Normal map ${t.name} is tagged srgb (should be linear) — lighting may look wrong.`]);
  }
  if (s.maxDim > 1000 || s.maxDim < 0.01) warns.push(['ℹ', `Authored size is ${s.maxDim.toFixed(3)} units — fine (the site re-normalises), but check your export scale.`]);
  if (state.clips.length === 0 && /walk|cycle|anim|run/i.test(s.label)) warns.push(['ℹ', 'Filename hints at animation but no clips are baked into this .glb.']);

  $('warnings').innerHTML = warns.length
    ? warns.map(([icon, msg]) => `<div class="warn ${icon === '✕' ? 'bad' : icon === '⚠' ? 'mid' : 'info'}"><span>${icon}</span>${msg}</div>`).join('')
    : '<div class="warn ok"><span>✓</span>No issues flagged — should render cleanly on the site.</div>';
}

// ── Wiring ────────────────────────────────────────────────────────────────
const bundledSel = $('bundled');
BUNDLED.forEach(name => {
  const o = document.createElement('option');
  o.value = name; o.textContent = name;
  bundledSel.appendChild(o);
});
bundledSel.addEventListener('change', e => {
  if (!e.target.value) return;
  loadFromUrl(`../media/models/${encodeURIComponent(e.target.value)}`, e.target.value);
});

$('file-input').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  bundledSel.value = '';
  file.arrayBuffer().then(buf => loadFromArrayBuffer(buf, file.name));
});

$('reset-btn').addEventListener('click', () => {
  if (state.frame) { applyCamera(camera, controls, state.frame, null); controls.update(); }
});

$('material').addEventListener('change', e => { state.material = e.target.value; applyMaterial(); });
$('wireframe').addEventListener('change', e => { state.wireframe = e.target.checked; applyMaterial(); });
$('theme').addEventListener('change', e => { state.theme = e.target.value; applyBackground(); });
$('composite').addEventListener('change', e => { state.composite = e.target.checked; applyBackground(); });
$('halftone').addEventListener('change', e => { state.halftone = e.target.checked; });
$('grid').addEventListener('change', e => { grid.visible = e.target.checked; });
$('axes').addEventListener('change', e => { axes.visible = e.target.checked; });
$('bbox').addEventListener('change', e => { bboxHelper.visible = e.target.checked; });
$('zoom').addEventListener('change', e => { controls.enableZoom = e.target.checked; });
$('pan').addEventListener('change', e => { controls.enablePan = e.target.checked; });
$('autorotate').addEventListener('change', e => { controls.autoRotate = e.target.checked; });

$('clip').addEventListener('change', applyClipSelection);
$('speed').addEventListener('input', e => {
  $('speed-val').textContent = `${Number(e.target.value).toFixed(2)}×`;
  if (state.mixer) state.mixer.timeScale = Number(e.target.value);
});
$('play-btn').addEventListener('click', () => {
  state.playing = !state.playing;
  state.actions.forEach(a => a.paused = !state.playing);
  $('play-btn').textContent = state.playing ? 'Pause' : 'Play';
});

// Drag & drop.
['dragenter', 'dragover'].forEach(t => stage.addEventListener(t, e => {
  e.preventDefault(); stage.classList.add('dragging');
}));
['dragleave', 'drop'].forEach(t => stage.addEventListener(t, e => {
  e.preventDefault(); stage.classList.remove('dragging');
}));
stage.addEventListener('drop', e => {
  const file = e.dataTransfer.files?.[0];
  if (!file) return;
  bundledSel.value = '';
  file.arrayBuffer().then(buf => loadFromArrayBuffer(buf, file.name));
});

// ── Loop ──────────────────────────────────────────────────────────────────
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  // Dot scale is screen-space — drive the uniforms with CSS pixels (as the site does).
  halftonePass.uniforms['width'].value = w;
  halftonePass.uniforms['height'].value = h;
}
window.addEventListener('resize', resize);

let fpsAccum = 0, fpsFrames = 0, fps = 0, modelTris = 0;
function animate() {
  const dt = clock.getDelta();
  if (state.mixer) state.mixer.update(dt);
  controls.update();
  if (state.halftone) composer.render();
  else renderer.render(scene, camera);

  fpsAccum += dt; fpsFrames++;
  if (fpsAccum >= 0.5) { fps = Math.round(fpsFrames / fpsAccum); fpsAccum = 0; fpsFrames = 0; }
  $('hud').textContent = `${fps} fps · ${modelTris.toLocaleString()} tris${state.halftone ? ' · halftone' : ''}`;
  if (state.mixer && state.actions[0]) $('anim-time').textContent = `${(state.actions[0].time).toFixed(2)}s`;

  requestAnimationFrame(animate);
}
applyBackground();
resize();
animate();
