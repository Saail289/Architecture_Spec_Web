/* Minimal static server for the Hubtown site.
   Usage: node serve.js [port]
   Supports HTTP byte ranges so the scrubbed background videos seek properly. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.argv[2]) || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mp4': 'video/mp4',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
  '.bin': 'application/octet-stream',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const CHOICES = ['recraft-v4.1', 'nano-banana-2.1', 'current', 'redo', null];

// The image picker (generated/compare.html) saves its picks here. Only this one route accepts writes,
// and only a small, well-formed picks object.
function saveSelections(req, res) {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > 256 * 1024) req.destroy();
  });
  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      const ok = data && typeof data.picks === 'object' && Object.entries(data.picks).every(([k, v]) =>
        /^[\w-]+\/[\w-]+$/.test(k) && v && CHOICES.includes(v.choice ?? null) && (v.note == null || typeof v.note === 'string'));
      if (!ok) throw new Error('bad shape');
      fs.mkdirSync(path.join(ROOT, 'generated'), { recursive: true });
      fs.writeFileSync(path.join(ROOT, 'generated', 'selections.json'), JSON.stringify(data, null, 2));
      res.writeHead(204).end();
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'text/plain' }).end('Invalid selections');
    }
  });
}

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (req.method === 'POST' && urlPath === '/generated/selections') return saveSelections(req, res);
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const file = path.join(ROOT, rel);

  // never serve outside site/
  // ...and never serve dotfiles (.env holds API keys)
  if (path.relative(ROOT, file).startsWith('..') || rel.split(/[\\/]/).some((seg) => seg.startsWith('.'))) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found: ' + rel);
      return;
    }

    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const range = req.headers.range;

    // Byte ranges matter here: the video scrub sets currentTime, and a server
    // without range support makes those seeks silently fail.
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      if (m) {
        const start = m[1] ? parseInt(m[1], 10) : 0;
        const end = m[2] ? parseInt(m[2], 10) : stat.size - 1;
        if (start >= stat.size || end >= stat.size || start > end) {
          res.writeHead(416, { 'Content-Range': 'bytes */' + stat.size }).end();
          return;
        }
        res.writeHead(206, {
          'Content-Type': type,
          'Content-Range': 'bytes ' + start + '-' + end + '/' + stat.size,
          'Accept-Ranges': 'bytes',
          'Content-Length': end - start + 1
        });
        fs.createReadStream(file, { start, end }).pipe(res);
        return;
      }
    }

    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': stat.size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, () => {
  console.log('Hubtown site running at http://localhost:' + PORT);
});
