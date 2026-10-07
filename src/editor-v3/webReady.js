// webReady.js — make uploads web-friendly in the browser, before they're sent.
//
// • Images (PNG, JPEG, BMP) → WebP, long edge capped at 3840 px.
// • 3D models (.glb) → the same model with its embedded PNG/JPEG textures
//   re-encoded as WebP (EXT_texture_webp). Geometry, materials and animation
//   are copied byte for byte.
// • Videos aren't converted (that needs a video encoder); the caller shows a
//   pointer to the web-copy steps in MEDIA-GUIDE.md instead.
// • The signature (signature.json, edited on the Media Library page) is
//   stamped on what's converted: an XMP block in WebP images, and an empty
//   object "_RGR ◦ uploaded to …" with custom properties in models (Blender
//   shows it in the Outliner). Models are signed even when no texture shrank.
//
// A result is only used when it's at least 10% smaller. Browsers that can't
// make WebP (Safari) upload the original. The on/off choice is remembered per
// browser (the "Make web-friendly" checkbox in the media picker and page).

const KEY = 'rgr_webready';
const IMAGE_QUALITY = 0.85;
const TEXTURE_QUALITY = 0.9;      // textures include normal maps — keep a little more detail
const MAX_EDGE = 3840;
const MIN_SAVING = 0.9;           // keep the result only if it's ≤ 90% of the original

export function webReadyOn() {
  try { return localStorage.getItem(KEY) !== '0'; } catch (e) { return true; }
}
export function setWebReady(on) {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) { /* not remembered */ }
}

/** Checkbox markup for the upload areas; wire it with bindWebReadyToggle(). */
export function webReadyToggleHtml() {
  return `<label class="v3-webready" title="Convert images and model textures to WebP before uploading. Videos upload as they are.">
    <input type="checkbox" class="v3-webready-input"${webReadyOn() ? ' checked' : ''}> Make web-friendly (WebP)</label>`;
}
export function bindWebReadyToggle(root) {
  root.querySelectorAll('.v3-webready-input').forEach(cb => {
    cb.checked = webReadyOn();
    cb.addEventListener('change', () => setWebReady(cb.checked));
  });
}

const mb = n => (n / 1024 / 1024).toFixed(n < 1024 * 1024 ? 2 : 1) + ' MB';
const swapExt = (name, ext) => name.replace(/\.[^.]+$/, '') + ext;
export const isVideoFile = f => /^video\//.test(f.type) || /\.(mp4|webm|mov|m4v|ogg)$/i.test(f.name);

/** The signature with today's date filled in; null when there's nothing to stamp. */
function stamp(sig) {
  if (!sig || !(sig.site || sig.note)) return null;
  return { site: sig.site || '', note: sig.note || '', uploaded: new Date().toLocaleDateString('en-CA') };
}

/** Name of the signed empty in models (the leading _ sorts it near the top of Blender's Outliner). */
export const signatureNodeName = site => `_RGR ◦ uploaded to ${site || 'rungirlrun.studio'}`;

/**
 * Returns { file, note }: the file to upload (converted or the original) and a
 * short note for the toast, or note '' when nothing worth saying happened.
 * `signature` is { site, note } from signature.json (or null).
 */
export async function makeWebReady(file, signature = null) {
  const sig = stamp(signature);
  try {
    if (/\.glb$/i.test(file.name)) {
      const res = await convertGlb(file, sig);
      if (!res) return { file, note: '' };
      const what = [res.textures && 'textures → WebP', res.signed && 'signed'].filter(Boolean).join(', ');
      return { file: res.file, note: `${file.name}: ${what}, ${mb(file.size)} → ${mb(res.file.size)}` };
    }
    if (/^image\/(png|jpeg|bmp)$/.test(file.type) || /\.(png|jpe?g|bmp)$/i.test(file.name)) {
      const enc = await encodeWebp(file, IMAGE_QUALITY, MAX_EDGE);
      if (!enc || enc.blob.size > file.size * MIN_SAVING) return { file, note: '' };
      const blob = sig ? await withXmp(enc.blob, enc.w, enc.h, xmpPacket(sig)) : enc.blob;
      const out = new File([blob], swapExt(file.name, '.webp'), { type: 'image/webp' });
      return { file: out, note: `${file.name} → ${out.name}${sig ? ' (signed)' : ''}, ${mb(file.size)} → ${mb(out.size)}` };
    }
  } catch (err) {
    console.warn('Web-friendly conversion skipped:', err);
  }
  return { file, note: '' };
}

/** Decode an image and re-encode it as WebP; null if the browser can't make WebP. */
async function encodeWebp(blob, quality, maxEdge = Infinity) {
  // Raw pixel values: no colour-profile conversion or premultiplying (textures
  // such as normal maps must come through unchanged)
  const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  let out;
  if (typeof OffscreenCanvas !== 'undefined') {
    const c = new OffscreenCanvas(w, h);
    c.getContext('2d').drawImage(bmp, 0, 0, w, h);
    out = await c.convertToBlob({ type: 'image/webp', quality });
  } else {
    const c = Object.assign(document.createElement('canvas'), { width: w, height: h });
    c.getContext('2d').drawImage(bmp, 0, 0, w, h);
    out = await new Promise(r => c.toBlob(r, 'image/webp', quality));
  }
  bmp.close?.();
  return out && out.type === 'image/webp' ? { blob: out, w, h } : null;
}

// ── WebP metadata (XMP) ─────────────────────────────────────────────────────

const xmlEsc = t => String(t).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

function xmpPacket(sig) {
  const url = /^https?:/.test(sig.site) ? sig.site : `https://${sig.site}`;
  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:rgr="https://rungirlrun.studio/ns/signature/1.0/">
${sig.site ? `<dc:source>${xmlEsc(url)}</dc:source>\n<rgr:uploadedTo>${xmlEsc(sig.site)}</rgr:uploadedTo>\n` : ''}<rgr:uploaded>${sig.uploaded}</rgr:uploaded>
${sig.note ? `<rgr:note>${xmlEsc(sig.note)}</rgr:note>\n` : ''}</rdf:Description></rdf:RDF></x:xmpmeta>
<?xpacket end="w"?>`;
}

/** Add an XMP chunk to a WebP (switching it to the extended "VP8X" layout). */
async function withXmp(blob, w, h, xmp) {
  const src = new Uint8Array(await blob.arrayBuffer());
  const dv = new DataView(src.buffer);
  const id = o => String.fromCharCode(...src.subarray(o, o + 4));
  if (id(0) !== 'RIFF' || id(8) !== 'WEBP') return blob;
  const chunks = [];
  for (let o = 12; o + 8 <= src.length;) {
    const size = dv.getUint32(o + 4, true);
    chunks.push({ id: id(o), data: src.subarray(o + 8, o + 8 + size) });
    o += 8 + size + (size & 1);
  }
  const old = chunks.find(c => c.id === 'VP8X');
  const head = new Uint8Array(10);
  if (old) head.set(old.data.subarray(0, 10));
  else {
    if (chunks.some(c => c.id === 'VP8L')) head[0] |= 0x10;   // lossless may carry alpha
    const put24 = (at, v) => { head[at] = v & 255; head[at + 1] = (v >> 8) & 255; head[at + 2] = (v >> 16) & 255; };
    put24(4, w - 1);
    put24(7, h - 1);
  }
  head[0] |= 0x04;                                             // has XMP
  const enc = (fourcc, data) => {
    const c = new Uint8Array(8 + data.length + (data.length & 1));
    c.set(new TextEncoder().encode(fourcc), 0);
    new DataView(c.buffer).setUint32(4, data.length, true);
    c.set(data, 8);
    return c;
  };
  const parts = [enc('VP8X', head),
    ...chunks.filter(c => c.id !== 'VP8X' && c.id !== 'XMP ').map(c => enc(c.id, c.data)),
    enc('XMP ', new TextEncoder().encode(xmp))];
  const body = parts.reduce((n, p) => n + p.length, 0);
  const riff = new Uint8Array(12);
  riff.set(new TextEncoder().encode('RIFFxxxxWEBP'));
  new DataView(riff.buffer).setUint32(4, 4 + body, true);
  return new Blob([riff, ...parts], { type: 'image/webp' });
}

/**
 * Re-encode a .glb's embedded PNG/JPEG textures as WebP and sign it.
 * Resolves { file, textures, signed }, or null when nothing changed.
 */
async function convertGlb(file, sig) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const dv = new DataView(buf.buffer);
  if (buf.length < 28 || dv.getUint32(0, true) !== 0x46546C67) return null;      // 'glTF'
  const jsonLen = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(buf.subarray(20, 20 + jsonLen)));
  const binAt = 20 + jsonLen;
  if (binAt + 8 > buf.length || dv.getUint32(binAt + 4, true) !== 0x004E4942) return null; // 'BIN'
  const bin = buf.subarray(binAt + 8, binAt + 8 + dv.getUint32(binAt, true));
  const views = json.bufferViews || [];
  if (views.some(v => (v.buffer || 0) !== 0)) return null;   // only the single GLB buffer

  const slice = v => bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
  const replaced = new Map();      // bufferView index → new bytes
  const converted = new Set();     // image indices now WebP
  for (const [i, img] of (json.images || []).entries()) {
    if (img.bufferView == null || !/^image\/(png|jpeg)$/.test(img.mimeType || '')) continue;
    const v = views[img.bufferView];
    const enc = await encodeWebp(new Blob([slice(v)], { type: img.mimeType }), TEXTURE_QUALITY);
    if (!enc || enc.blob.size > v.byteLength * MIN_SAVING) continue;
    replaced.set(img.bufferView, new Uint8Array(await enc.blob.arrayBuffer()));
    img.mimeType = 'image/webp';
    converted.add(i);
  }
  if (sig) signGlb(json, sig);
  if (!converted.size && !sig) return null;

  // Point the textures at the WebP images through the extension
  for (const t of json.textures || []) {
    if (converted.has(t.source)) {
      t.extensions = { ...(t.extensions || {}), EXT_texture_webp: { source: t.source } };
      delete t.source;
    }
  }
  if (converted.size) {
    for (const k of ['extensionsUsed', 'extensionsRequired']) {
      json[k] = json[k] || [];
      if (!json[k].includes('EXT_texture_webp')) json[k].push('EXT_texture_webp');
    }
  }

  // Rebuild the binary chunk: every view in order, 4-byte aligned
  const parts = [];
  let off = 0;
  const pad = () => { const p = (4 - off % 4) % 4; if (p) { parts.push(new Uint8Array(p)); off += p; } };
  views.forEach((v, i) => {
    const data = replaced.get(i) || slice(v);
    pad();
    v.byteOffset = off;
    v.byteLength = data.length;
    parts.push(data);
    off += data.length;
  });
  pad();
  json.buffers[0].byteLength = off;

  let jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPad = (4 - jsonBytes.length % 4) % 4;
  if (jsonPad) jsonBytes = new Uint8Array([...jsonBytes, ...new Array(jsonPad).fill(0x20)]);

  const header = new DataView(new ArrayBuffer(20));
  header.setUint32(0, 0x46546C67, true);
  header.setUint32(4, 2, true);
  header.setUint32(8, 12 + 8 + jsonBytes.length + 8 + off, true);
  header.setUint32(12, jsonBytes.length, true);
  header.setUint32(16, 0x4E4F534A, true);                    // 'JSON'
  const binHeader = new DataView(new ArrayBuffer(8));
  binHeader.setUint32(0, off, true);
  binHeader.setUint32(4, 0x004E4942, true);                  // 'BIN'
  const out = new File([header, jsonBytes, binHeader, ...parts], file.name, { type: 'model/gltf-binary' });
  return { file: out, textures: converted.size > 0, signed: !!sig };
}

/** Add (or refresh) the signed empty at the root of the model's scene. */
function signGlb(json, sig) {
  json.nodes = json.nodes || [];
  const extras = { site: sig.site, uploaded: sig.uploaded, note: sig.note };
  let i = json.nodes.findIndex(n => typeof n.name === 'string' && n.name.startsWith('_RGR'));
  if (i < 0) {
    i = json.nodes.push({}) - 1;
    json.scenes = json.scenes && json.scenes.length ? json.scenes : [{ nodes: [] }];
    const scene = json.scenes[json.scene || 0];
    scene.nodes = scene.nodes || [];
    scene.nodes.push(i);
  }
  json.nodes[i] = { name: signatureNodeName(sig.site), extras };
}
