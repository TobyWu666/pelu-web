import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, readdir } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT || 3000);
const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm':  'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.txt':  'text/plain; charset=utf-8',
  '.md':   'text/markdown; charset=utf-8'
};

const server = http.createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    let pathname = normalize(url).replace(/^([\\/]+)/, '');
    let filePath = resolve(ROOT, pathname);

    // Prevent path traversal
    if (!filePath.startsWith(ROOT + sep) && filePath !== ROOT) {
      res.writeHead(403); res.end('Forbidden'); return;
    }

    let stats;
    try { stats = await stat(filePath); }
    catch { res.writeHead(404); res.end('Not found'); return; }

    if (stats.isDirectory()) {
      const indexPath = join(filePath, 'index.html');
      try {
        const idx = await stat(indexPath);
        if (idx.isFile()) { return stream(indexPath, res); }
      } catch {}
      // simple directory listing
      const entries = await readdir(filePath, { withFileTypes: true });
      const links = entries.map(e => `<li><a href="${encodeURI(e.name)}${e.isDirectory()?'/':''}">${e.name}${e.isDirectory()?'/':''}</a></li>`).join('');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(`<!doctype html><meta charset="utf-8"><title>${pathname}</title><h1>${pathname || '/'}</h1><ul>${links}</ul>`);
      return;
    }

    return stream(filePath, res);
  } catch (err) {
    console.error(err);
    res.writeHead(500); res.end('Server error');
  }
});

function stream(filePath, res) {
  const type = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, {
    'content-type': type,
    'cache-control': 'no-cache'
  });
  createReadStream(filePath).pipe(res);
}

server.listen(PORT, () => {
  console.log(`Pelu web serving at http://localhost:${PORT}`);
  console.log(`Root: ${ROOT}`);
});
