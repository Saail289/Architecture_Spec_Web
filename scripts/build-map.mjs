// Builds assets/map/mumbai.bin — Mumbai roads + coastline as line segments — from OpenStreetMap.
//
//   node scripts/build-map.mjs              fetch from Overpass, then build
//   node scripts/build-map.mjs raw.json     build from a saved Overpass response
//
// Output layout (little-endian):
//   Uint32[CLASSES.length]  segment count per class
//   Uint16[...]             x1,y1,x2,y2 per segment, metres from the bbox's north-west corner
// Data © OpenStreetMap contributors, ODbL.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

// Keep in sync with BBOX in assets/projects.js.
export const BBOX = { s: 18.89, w: 72.65, n: 19.29, e: 73.25 };
const CLASSES = [
  { name: 'major', match: /^(motorway|trunk)(_link)?$/, tol: 6 },
  { name: 'arterial', match: /^(primary|secondary)(_link)?$/, tol: 5 },
  { name: 'street', match: /^tertiary(_link)?$/, tol: 4 },
  { name: 'minor', match: /^(residential|unclassified|living_street)$/, tol: 3 },
  { name: 'coast', match: /^coastline$/, tol: 6 }
];
const MIRRORS = ['https://overpass.kumi.systems/api/interpreter', 'https://overpass-api.de/api/interpreter'];
const QUERY = `[out:json][timeout:300];(way["highway"~"^(motorway|trunk|primary|secondary|tertiary|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link|residential|unclassified|living_street)$"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});way["natural"="coastline"](${BBOX.s - 0.1},${BBOX.w - 0.1},${BBOX.n + 0.1},${BBOX.e + 0.1}););out geom;`;

const latMid = (BBOX.s + BBOX.n) / 2;
const mPerLon = 111320 * Math.cos(latMid * Math.PI / 180), mPerLat = 110574;
const W = Math.round((BBOX.e - BBOX.w) * mPerLon), H = Math.round((BBOX.n - BBOX.s) * mPerLat);
const project = (p) => [(p.lon - BBOX.w) * mPerLon, (BBOX.n - p.lat) * mPerLat];
const inside = ([x, y]) => x >= 0 && y >= 0 && x <= W && y <= H;

// Douglas–Peucker: drop points closer than tol metres to the simplified line.
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    let max = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
      if (d > max) { max = d; idx = i; }
    }
    if (max > tol) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

async function load() {
  if (process.argv[2]) return JSON.parse(readFileSync(process.argv[2], 'utf8'));
  // Public Overpass servers are often at capacity; try each in turn.
  let last;
  for (const url of MIRRORS) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'User-Agent': 'hubtown-map-build/1.0', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(QUERY)
    });
    if (res.ok) return res.json();
    last = url + ' ' + res.status;
    console.warn('Overpass failed:', last);
  }
  throw new Error('All Overpass servers failed (last: ' + last + ')');
}

const data = await load();
const segs = CLASSES.map(() => []);
for (const way of data.elements) {
  const tag = way.tags.natural === 'coastline' ? 'coastline' : way.tags.highway;
  const ci = CLASSES.findIndex((c) => c.match.test(tag));
  if (ci < 0 || !way.geometry) continue;
  const pts = simplify(way.geometry.map(project), CLASSES[ci].tol);
  for (let i = 1; i < pts.length; i++) {
    // ponytail: segments crossing the bbox edge are dropped, not clipped; the edge is off-screen at max zoom-out.
    if (!inside(pts[i - 1]) || !inside(pts[i])) continue;
    segs[ci].push(Math.round(pts[i - 1][0]), Math.round(pts[i - 1][1]), Math.round(pts[i][0]), Math.round(pts[i][1]));
  }
}

const head = new Uint32Array(segs.map((s) => s.length / 4));
const body = Uint16Array.from(segs.flat());
mkdirSync('assets/map', { recursive: true });
writeFileSync('assets/map/mumbai.bin', Buffer.concat([Buffer.from(head.buffer), Buffer.from(body.buffer)]));
console.log('bbox', W + 'm x ' + H + 'm');
CLASSES.forEach((c, i) => console.log(c.name.padEnd(9), head[i], 'segments'));
console.log('wrote assets/map/mumbai.bin', (head.byteLength + body.byteLength) / 1e6 + ' MB');
