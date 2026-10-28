// Generates the Hubtown Marina walkthrough clips with Wan 3.0 Prime on Higgsfield.
// Shots, durations, keyframes and prompts are read from skills/MARINA-WALKTHROUGH.md.
//
//   node scripts/gen-video.mjs --dry                     list shots, spend nothing
//   node scripts/gen-video.mjs --estimate --res 1080p    exact USD cost from Higgsfield, spend nothing
//   node scripts/gen-video.mjs --shots 1 --res 720p      generate shot 1 as a test
//   node scripts/gen-video.mjs --res 1080p               generate every shot
//   node scripts/gen-video.mjs --single --res 1080p      the whole film as ONE 30s clip (Wan 3.0 Reference-to-Video,
//                                                        prompt from the doc's ```text single-30s block)
//
// Clips land in uploads/video/hubtown-marina/clips/NN-<res>[-takeK].mp4 (existing takes are never
// overwritten), with request id, seed and cost logged to clips/manifest.json.
// Needs HF_KEY=KEY_ID:KEY_SECRET in .env (Higgsfield_key= is accepted too).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const MODEL = 'alibaba/wan-3.0-prime/image-to-video';
const R2V = 'alibaba/wan-3.0/reference-to-video';
const API = 'https://api.higgsfield.ai';
const FRAMES = 'uploads/video/hubtown-marina/frames';
const CLIPS = 'uploads/video/hubtown-marina/clips';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const RES = opt('--res', '1080p');
if (!['480p', '720p', '1080p'].includes(RES)) throw new Error('--res must be 480p, 720p or 1080p');

// "**Shot 3 — Arrival** · 6s · `03-forecourt.jpeg`" followed by "> prompt"
const doc = readFileSync('skills/MARINA-WALKTHROUGH.md', 'utf8');
let shots = [...doc.matchAll(/\*\*Shot (\d+) — ([^*]+)\*\* · (\d+)s · `([\w.-]+)`\s*\n> (.+)/g)]
  .map((m) => ({ n: +m[1], title: m[2].trim(), seconds: +m[3], frame: m[4], prompt: m[5].trim() }));
if (!shots.length) throw new Error('no shots found in skills/MARINA-WALKTHROUGH.md');
const pick = opt('--shots');
if (pick) {
  const want = pick.split(',').map(Number);
  shots = shots.filter((s) => want.includes(s.n));
}

const input = (s, imageUrl) => ({
  prompt: s.prompt, image_url: imageUrl, duration: s.seconds, resolution: RES,
  aspect_ratio: '16:9', generate_audio: true,
  enable_thinking: false // keep our prompts as written; "thinking" lets the model rewrite them
});

if (flag('--dry')) {
  shots.forEach((s) => console.log(`${String(s.n).padStart(2)}  ${s.seconds}s  ${s.frame.padEnd(18)} ${existsSync(`${FRAMES}/${s.frame}`) ? 'ok ' : 'MISSING'}  ${s.title}`));
  console.log(shots.length, 'shots,', shots.reduce((t, s) => t + s.seconds, 0) + 's total at', RES);
  process.exit(0);
}

const env = existsSync('.env') ? readFileSync('.env', 'utf8') : '';
const KEY = (env.match(/^(?:HF_KEY|Higgsfield_key)=(.+)$/m) || [])[1]?.trim() || process.env.HF_KEY;
if (!KEY || !KEY.includes(':')) throw new Error('HF_KEY missing — add HF_KEY=KEY_ID:KEY_SECRET to .env');
const auth = { Authorization: 'Key ' + KEY };

async function api(path, body) {
  const res = await fetch(path.startsWith('http') ? path : API + path, {
    method: body ? 'POST' : 'GET',
    headers: body ? { ...auth, 'Content-Type': 'application/json' } : auth,
    body: body && JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${path}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

async function estimate(s) {
  // Estimate only needs the parameters; a placeholder image URL keeps it from uploading anything.
  const r = await api('/estimate/' + MODEL, input(s, 'https://example.com/frame.jpg'));
  return r.usd;
}

if (flag('--estimate') && !flag('--single')) {
  let total = 0;
  for (const s of shots) {
    const usd = await estimate(s);
    total += usd;
    console.log(`${String(s.n).padStart(2)}  ${s.seconds}s  $${usd}  ${s.title}`);
  }
  console.log(`total at ${RES}: $${total.toFixed(2)} (exact, from Higgsfield's estimate endpoint)`);
  process.exit(0);
}

async function upload(file) {
  const u = await api('/files/generate-upload-url', { content_type: 'image/jpeg' });
  // Presigned storage URL: send only its own headers, never our API key.
  const put = await fetch(u.upload_url, { method: 'PUT', headers: u.upload_headers, body: readFileSync(file) });
  if (!put.ok) throw new Error('upload failed ' + put.status);
  return u.public_url;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(job) {
  let delay = 2000;
  for (;;) {
    await sleep(delay + Math.random() * 500);
    const st = await api(job.status_url || `/requests/${job.request_id}/status`);
    if (st.status === 'completed') return st;
    if (['failed', 'nsfw', 'canceled'].includes(st.status)) throw new Error(st.status + ': ' + (st.error || ''));
    delay = Math.min(10000, delay * 1.5);
  }
}

function outPath(n) {
  const base = `${CLIPS}/${String(n).padStart(2, '0')}-${RES}`;
  if (!existsSync(base + '.mp4')) return base + '.mp4';
  for (let k = 2; ; k++) if (!existsSync(`${base}-take${k}.mp4`)) return `${base}-take${k}.mp4`;
}

mkdirSync(CLIPS, { recursive: true });
const MANIFEST = `${CLIPS}/manifest.json`;
const log = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : [];

if (flag('--single')) {
  const prompt = (doc.match(/```text single-30s\r?\n([\s\S]+?)\r?\n```/) || [])[1];
  if (!prompt) throw new Error('no ```text single-30s block in skills/MARINA-WALKTHROUGH.md');
  const body = { prompt, duration: 30, resolution: RES, aspect_ratio: '16:9', generate_audio: true,
    prompt_extend: false, enable_thinking: false }; // both would rewrite the prompt and lose the shot timing
  const frames = shots.map((s) => `${FRAMES}/${s.frame}`); // all 9, in shot order = [Image 1..9]
  // This model's estimate returns a price description, not a usd figure: derive the list price from it.
  const est = await api('/estimate/' + R2V, { ...body, image_urls: frames.map(() => 'https://example.com/frame.jpg') });
  const rate = +((est.pricing_description || '').match(new RegExp(RES + ' \\$([\\d.]+)/s')) || [])[1];
  const usd = est.usd ?? (rate ? +(rate * body.duration).toFixed(2) : null);
  console.log(`single 30s clip at ${RES}, ${frames.length} reference images: $${usd} list price (before any discount)`);
  if (flag('--estimate')) process.exit(0);

  const t0 = Date.now();
  const image_urls = [];
  for (const f of frames) image_urls.push(await upload(f));
  const job = await api('/' + R2V, { ...body, image_urls });
  console.log(`submitted (${job.request_id}), est. $${usd}… a 30s 1080p clip can take several minutes`);
  const done = await waitFor(job);
  const base = `uploads/video/hubtown-marina/walkthrough-30s-${RES}`;
  let path = base + '.mp4';
  for (let k = 2; existsSync(path); k++) path = `${base}-take${k}.mp4`;
  writeFileSync(path, Buffer.from(await (await fetch(done.video.url)).arrayBuffer()));
  log.push({ shot: 'single-30s', model: R2V, path, resolution: RES, seconds: 30, usd, request_id: job.request_id,
    seed: done.seed, took_s: Math.round((Date.now() - t0) / 1000), prompt, at: new Date().toISOString() });
  writeFileSync(MANIFEST, JSON.stringify(log, null, 2));
  console.log(`ok -> ${path} ($${usd}, ${Math.round((Date.now() - t0) / 1000)}s)`);
  process.exit(0);
}

// One shot at a time: easy to stop after a bad take, and nothing is paid for in parallel by surprise.
for (const s of shots) {
  const t0 = Date.now();
  try {
    const usd = await estimate(s);
    const imageUrl = await upload(`${FRAMES}/${s.frame}`);
    const job = await api('/' + MODEL, input(s, imageUrl));
    console.log(`shot ${s.n} submitted (${job.request_id}), est. $${usd}…`);
    const done = await waitFor(job);
    const path = outPath(s.n);
    writeFileSync(path, Buffer.from(await (await fetch(done.video.url)).arrayBuffer()));
    log.push({ shot: s.n, title: s.title, path, resolution: RES, seconds: s.seconds, usd, request_id: job.request_id,
      seed: done.seed, took_s: Math.round((Date.now() - t0) / 1000), prompt: s.prompt, at: new Date().toISOString() });
    writeFileSync(MANIFEST, JSON.stringify(log, null, 2));
    console.log(`ok   shot ${s.n} -> ${path} ($${usd}, ${Math.round((Date.now() - t0) / 1000)}s)`);
  } catch (e) {
    console.log(`FAIL shot ${s.n}: ${e.message}`);
  }
}
const spent = log.filter((l) => shots.some((s) => s.n === l.shot)).reduce((t, l) => t + (l.usd || 0), 0);
console.log(`done. clips in ${CLIPS}/ — this project's logged spend so far: $${spent.toFixed(2)}`);
