// serve.js — local dev server for the 3D modelling portfolio
// Usage: node serve.js
// Then open: http://localhost:3000/modelling/

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 3000;
// Serve from repo root so ../media/models/ paths resolve correctly
const DIR  = path.join(__dirname, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.glb':  'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.webp': 'image/webp',
  '.mp4':  'video/mp4',
  '.svg':  'image/svg+xml',
};

http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/' || urlPath === '/modelling' || urlPath === '/modelling/') {
    urlPath = '/modelling/index.html';
  }

  const filePath = path.join(DIR, urlPath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`404 — Not found: ${urlPath}`);
      return;
    }
    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log(`\n  Modelling portfolio → http://localhost:${PORT}/modelling/\n`);
  console.log('  Press Ctrl+C to stop.\n');
});
