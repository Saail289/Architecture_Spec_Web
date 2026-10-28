// Generates images from skills/IMAGE-PROMPTS.md through fal, once per model, for side-by-side review.
//
//   node scripts/gen-images.mjs hubtown-aria hubtown-verde
//   node scripts/gen-images.mjs --dry hubtown-aria      list the prompts, spend nothing
//
// For each project slug: the map card + its interior rooms. Output is tagged by model and never
// touches uploads/ — pick the winners later:
//   generated/<model-tag>/<slug>/<file>__<model-tag>.<ext>
//   generated/manifest.json   model, prompt, seconds, unit price, file per image
//   generated/compare.html    both models side by side; pick per image, saved to generated/selections.json
//                             by serve.js (open it via http://localhost:8080/generated/compare.html)
// Re-running skips images that already exist and merges into the manifest, so nothing is paid for twice.
// Needs FAL_KEY in .env.

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';

const MODELS = [
  { tag: 'recraft-v4.1', id: 'fal-ai/recraft/v4.1/text-to-image', input: { image_size: 'landscape_16_9' } },
  { tag: 'nano-banana-2.1', id: 'google/nano-banana-2.1', input: { aspect_ratio: '16:9', resolution: '1K', output_format: 'jpeg' } }
];
const CONCURRENCY = 3;
// Marina doubles as 1080p video keyframes, so it is generated at 2K.
const HIRES = { 'hubtown-marina': { 'recraft-v4.1': { image_size: { width: 2048, height: 1152 } }, 'nano-banana-2.1': { resolution: '2K' } } };

const DRY = process.argv.includes('--dry');
const env = existsSync('.env') ? readFileSync('.env', 'utf8') : '';
const KEY = (env.match(/^FAL_KEY=(.+)$/m) || [])[1]?.trim() || process.env.FAL_KEY;
if (!KEY && !DRY) throw new Error('FAL_KEY missing — add it to .env');
const auth = { Authorization: 'Key ' + KEY };

// Pull "`file.jpeg`" (older sections: ".jpg") headings and the "> prompt" paragraph that follows each.
function promptsFor(slug) {
  const md = readFileSync('skills/IMAGE-PROMPTS.md', 'utf8');
  const out = [];
  const card = md.match(new RegExp('`' + slug + '\\.jpe?g`[^\\n]*\\n(?:\\*\\*Concept[^\\n]*\\n)?\\n?> (.+)'));
  if (card) out.push({ file: 'card', prompt: card[1] });
  const section = md.split(/\n### /).find((s) => s.includes('uploads/images/interiors/' + slug + '/'));
  if (section) {
    for (const m of section.matchAll(/\*\*`([\w-]+)\.jpe?g`\*\*[^\n]*\n> (.+)/g)) out.push({ file: m[1], prompt: m[2] });
  }
  return out;
}

async function price(id) {
  try {
    const r = await fetch('https://api.fal.ai/v1/models/pricing?endpoint_id=' + encodeURIComponent(id), { headers: auth });
    const j = await r.json();
    const p = (j.prices || [])[0];
    return p ? { unit_price: p.unit_price, unit: p.unit, currency: p.currency } : { error: JSON.stringify(j).slice(0, 200) };
  } catch (e) {
    return { error: String(e) };
  }
}

async function run(model, job) {
  const t0 = Date.now();
  const res = await fetch('https://fal.run/' + model.id, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: job.prompt, ...model.input, ...(HIRES[job.slug] || {})[model.tag] })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(model.tag + ' ' + job.slug + '/' + job.file + ': ' + res.status + ' ' + JSON.stringify(body).slice(0, 300));
  const img = body.images[0];
  const ext = (img.content_type || 'image/jpeg').split('/')[1].replace('jpg', 'jpeg');
  const dir = `generated/${model.tag}/${job.slug}`;
  mkdirSync(dir, { recursive: true });
  const path = `${dir}/${job.file}__${model.tag}.${ext}`;
  writeFileSync(path, Buffer.from(await (await fetch(img.url)).arrayBuffer()));
  return { model: model.tag, endpoint: model.id, slug: job.slug, file: job.file, path, seconds: (Date.now() - t0) / 1000,
    width: img.width, height: img.height, bytes: img.file_size, prompt: job.prompt };
}

const slugs = process.argv.slice(2).filter((a) => a !== '--dry');
if (!slugs.length) throw new Error('usage: node scripts/gen-images.mjs <project-slug> ...');
const jobs = slugs.flatMap((slug) => promptsFor(slug).map((j) => ({ ...j, slug })));
if (!jobs.length) throw new Error('no prompts found for ' + slugs.join(', '));
if (DRY) {
  jobs.forEach((j) => console.log(j.slug.padEnd(14), j.file.padEnd(15), j.prompt.split(' ').length + ' words'));
  console.log(jobs.length, 'prompts x', MODELS.length, 'models =', jobs.length * MODELS.length, 'images');
  process.exit(0);
}

const prices = {};
for (const m of MODELS) prices[m.tag] = await price(m.id);
console.log('pricing', prices);
console.log(jobs.length, 'prompts x', MODELS.length, 'models');

mkdirSync('generated', { recursive: true });
const MANIFEST = 'generated/manifest.json';
const prev = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : { results: [] };
const done = (m, j) => prev.results.some((r) => r.model === m.tag && r.slug === j.slug && r.file === j.file && existsSync(r.path));
const queue = MODELS.flatMap((m) => jobs.filter((j) => !done(m, j)).map((j) => [m, j]));
console.log(queue.length, 'to generate,', jobs.length * MODELS.length - queue.length, 'already done');
const results = [], failures = [];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    const [m, j] = queue.shift();
    try {
      const r = await run(m, j);
      results.push(r);
      console.log('ok  ', r.path, r.seconds.toFixed(1) + 's');
    } catch (e) {
      failures.push(String(e.message));
      console.log('FAIL', e.message);
    }
  }
}));

const all = prev.results.filter((r) => !results.some((n) => n.model === r.model && n.slug === r.slug && n.file === r.file)).concat(results);
const summary = MODELS.map((m) => {
  const mine = all.filter((r) => r.model === m.tag), p = prices[m.tag];
  return { model: m.tag, images: mine.length, avg_seconds: +(mine.reduce((s, r) => s + r.seconds, 0) / (mine.length || 1)).toFixed(1),
    unit_price: p.unit_price, unit: p.unit,
    // only per-image pricing can be multiplied out; 'units' billing (Nano Banana) needs the fal usage dashboard
    est_cost: p.unit === 'images' ? +(p.unit_price * mine.length).toFixed(3) : null };
});
writeFileSync(MANIFEST, JSON.stringify({ generated_at: new Date().toISOString(), summary, failures, results: all }, null, 2));
copyFileSync('scripts/compare.html', 'generated/compare.html');

console.log('\nsummary', summary);
if (failures.length) console.log(failures.length, 'failed — see generated/manifest.json');
