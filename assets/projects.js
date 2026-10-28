import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/* lat/lon are approximate locality centres (Solaris near Andheri station east).
   Swap in exact site coordinates when available.
   reveal: only shown on the map once its area is selected.
   soon: no photo or interiors yet, so the card shows no image and no tour link. */
var PROJECTS = [
  { name: 'Hubtown Solaris',  loc: 'Andheri (E), Mumbai',    type: 'Commercial',  status: 'Completed',          area: 'andheri',  lat: 19.1180, lon: 72.8500 },
  { name: 'Hubtown Viva',     loc: 'Jogeshwari (E), Mumbai', type: 'Commercial',  status: 'Under Construction', area: 'andheri',  lat: 19.1429, lon: 72.8552 },
  { name: 'Hubtown Premiere', loc: 'Andheri (W), Mumbai',    type: 'Residential', status: 'Completed',          area: 'andheri',  lat: 19.1172, lon: 72.8340 },
  { name: 'Hubtown Harmony',  loc: 'Goregaon (W), Mumbai',   type: 'Residential', status: 'Upcoming',           area: 'goregaon', lat: 19.1633, lon: 72.8412 },
  { name: 'Hubtown Celeste',  loc: 'Vile Parle (E), Mumbai', type: 'Commercial',  status: 'Completed',          area: 'andheri',  lat: 19.1000, lon: 72.8500 },
  { name: 'Hubtown Aria',     loc: 'Goregaon (W), Mumbai',   type: 'Residential', status: 'Under Construction', area: 'goregaon', lat: 19.1672, lon: 72.8462, reveal: true },
  { name: 'Hubtown Verde',    loc: 'Goregaon (W), Mumbai',   type: 'Residential', status: 'Upcoming',           area: 'goregaon', lat: 19.1598, lon: 72.8372, reveal: true },
  { name: 'Hubtown Marina',   loc: 'Nariman Point, Mumbai',  type: 'Commercial',  status: 'Upcoming',           area: 'south',    lat: 18.9262, lon: 72.8236 }
];
// side: which way the wide-shot tag's plate points, so neighbouring tags don't collide.
var AREAS = [
  { id: 'all',      name: 'All Mumbai' },
  { id: 'goregaon', name: 'Goregaon West',          side: 'left' },
  { id: 'andheri',  name: 'Andheri – Vile Parle',   side: 'right' },
  { id: 'south',    name: 'South Bombay',           side: 'right' }
];
var CHIPS = ['Residential', 'Commercial', 'Completed', 'Under Construction', 'Upcoming'];
var TYPES = ['Residential', 'Commercial'];
var STATUSES = ['Completed', 'Under Construction', 'Upcoming'];
var STATUS_COLOR = { 'Completed': '#9B6BFF', 'Under Construction': '#F6F3F4', 'Upcoming': '#9C939A' };

// Road + coastline segments built by scripts/build-map.mjs from OpenStreetMap.
// BBOX must match the script's.
var MAP_DATA = 'assets/map/mumbai.bin';
var LAYERS = ['major', 'arterial', 'street', 'minor', 'coast']; // file order
var BBOX = { s: 18.89, w: 72.65, n: 19.29, e: 73.25 };
var M_PER_LON = 111320 * Math.cos((BBOX.s + BBOX.n) / 2 * Math.PI / 180), M_PER_LAT = 110574;
var UNIT_M = 400;                                  // metres per world unit
var MAP_W = (BBOX.e - BBOX.w) * M_PER_LON / UNIT_M;
var MAP_H = (BBOX.n - BBOX.s) * M_PER_LAT / UNIT_M;
var CELL = 2.1;                                    // district tile size, world units
var COLS = Math.ceil(MAP_W / CELL), ROWS = Math.ceil(MAP_H / CELL);
var ROAD_Y = 0.16;                                 // roads ride just above the tallest tile
var FOV = 35, TAN = Math.tan(FOV * Math.PI / 360);
var D_MIN = 2.5, D_PROJECT = 11;

var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
var $ = function (id) { return document.getElementById(id); };
var pad = function (n) { return String(n).padStart(2, '0'); };
var clamp01 = function (t) { return Math.min(1, Math.max(0, t)); };
var easeInOut = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

var root = $('map'), labelsEl = $('labels'), cardSlot = $('cardSlot');
var cursorEl = $('cursor'), cursorRing = $('cursorRing');
var active = -1, hovered = -1, labelHover = -1, filters = {}, areaFilter = 'all', region = 'all';

PROJECTS.forEach(function (p) {
  p.x = (p.lon - BBOX.w) * M_PER_LON / UNIT_M - MAP_W / 2;
  p.z = (BBOX.n - p.lat) * M_PER_LAT / UNIT_M - MAP_H / 2;
});

function matches(p) {
  var types = TYPES.filter(function (t) { return filters[t]; });
  var stats = STATUSES.filter(function (s) { return filters[s]; });
  return (!types.length || types.indexOf(p.type) >= 0) &&
         (!stats.length || stats.indexOf(p.status) >= 0);
}

// What the map shows: filters, plus reveal-only projects once their area is picked.
function visible(p) {
  return matches(p) && (!p.reveal || region === p.area);
}

/* ================================================================
   Scene
   ================================================================ */
var renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: true });
} catch (err) {
  root.classList.add('no-gl'); // fallback still image + list/cards keep working
}

var scene = new THREE.Scene();
var cam = new THREE.PerspectiveCamera(FOV, innerWidth / innerHeight, 0.1, 600);
var composer = null, bloom = null, fatMats = [], roadMats = null, roadSegs = null;
var tileUniforms = {
  uMouse: { value: new THREE.Vector2(0, 0) },
  uSpotR: { value: 20 }
};
var cubes = [];

// Seeded so the tile relief is the same on every visit.
var seed = 7;
function rand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

if (renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight, false);
  scene.background = new THREE.Color(0x07060a);

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, cam));
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.45, 0.4);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* ---- district tiles: dark raised blocks, lit where the street grid is dense (land) ---- */
  var boxGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  var tileMat = new THREE.ShaderMaterial({
    uniforms: tileUniforms,
    vertexShader: [
      'attribute float aShade; attribute float aLand;',
      'varying vec3 vWorld; varying float vTop; varying float vShade; varying float vLand;',
      'void main() {',
      '  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);',
      '  vWorld = w.xyz; vTop = step(0.5, normal.y); vShade = aShade; vLand = aLand;',
      '  gl_Position = projectionMatrix * viewMatrix * w;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform vec2 uMouse; uniform float uSpotR;',
      'varying vec3 vWorld; varying float vTop; varying float vShade; varying float vLand;',
      'void main() {',
      '  float d = distance(vWorld.xz, uMouse) / uSpotR;',
      '  float spot = exp(-d * d * 2.5);',
      '  vec3 sea = vec3(0.022, 0.018, 0.04);',
      '  vec3 land = vec3(0.06, 0.04, 0.11) * (0.7 + 0.6 * vShade);',
      '  vec3 base = mix(sea, land, vLand);',
      '  vec3 top = base * (0.85 + 1.5 * spot) + vec3(0.05, 0.02, 0.12) * spot * vLand;',
      '  gl_FragColor = vec4(pow(mix(base * 0.45, top, vTop), vec3(2.2)), 1.0);', // sRGB-authored -> linear for OutputPass
      '}'
    ].join('\n')
  });
  var tiles = new THREE.InstancedMesh(boxGeo, tileMat, COLS * ROWS);
  var shade = new Float32Array(COLS * ROWS);
  var landAttr = new THREE.InstancedBufferAttribute(new Float32Array(COLS * ROWS), 1);
  var m = new THREE.Matrix4();
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      var i = r * COLS + c;
      shade[i] = rand();
      m.makeScale(CELL, 0.02 + rand() * 0.11, CELL).setPosition((c + 0.5) * CELL - MAP_W / 2, 0, (r + 0.5) * CELL - MAP_H / 2);
      tiles.setMatrixAt(i, m);
    }
  }
  boxGeo.setAttribute('aShade', new THREE.InstancedBufferAttribute(shade, 1));
  boxGeo.setAttribute('aLand', landAttr);
  scene.add(tiles);

  loadRoads(landAttr);

  /* ---- project cubes ---- */
  var glowTex = (function () {
    var cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    var g = cv.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,.45)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(cv);
  })();
  var cubeGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
  var hitGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);

  PROJECTS.forEach(function (p, i) {
    var group = new THREE.Group();
    group.position.set(p.x, ROAD_Y, p.z);

    var cube = new THREE.Mesh(cubeGeo, new THREE.MeshBasicMaterial({ color: 0xb794ff, transparent: true }));
    cube.position.y = 0.4;
    var halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0x9b6bff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    halo.position.y = 0.4;
    halo.scale.setScalar(1.1);
    var pool = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), new THREE.MeshBasicMaterial({
      map: glowTex, color: 0x6c2bd9, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.01;
    var hit = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.4;
    hit.userData.index = i;

    group.add(pool, cube, halo, hit);
    scene.add(group);
    cubes.push({ group: group, cube: cube, halo: halo, pool: pool, hit: hit, s: 1, phase: i * 1.3 });
  });
}

/* ---- roads + coastline as real geometry, so they stay crisp at every zoom ---- */
async function loadRoads(landAttr) {
  var buf;
  try {
    var res = await fetch(MAP_DATA);
    if (!res.ok) throw new Error(res.status);
    buf = await res.arrayBuffer();
  } catch (err) {
    return; // bare tiles; list + cards still work
  }
  var counts = new Uint32Array(buf, 0, LAYERS.length);
  var data = new Uint16Array(buf, LAYERS.length * 4);
  var land = landAttr.array, pos = {}, off = 0;
  roadSegs = {};
  LAYERS.forEach(function (name, li) {
    var n = counts[li], src = data.subarray(off * 4, (off + n) * 4), out = new Float32Array(n * 6);
    off += n;
    roadSegs[name] = src;
    for (var k = 0; k < n; k++) {
      var x1 = src[k * 4] / UNIT_M - MAP_W / 2, z1 = src[k * 4 + 1] / UNIT_M - MAP_H / 2;
      out[k * 6] = x1; out[k * 6 + 1] = ROAD_Y; out[k * 6 + 2] = z1;
      out[k * 6 + 3] = src[k * 4 + 2] / UNIT_M - MAP_W / 2; out[k * 6 + 4] = ROAD_Y; out[k * 6 + 5] = src[k * 4 + 3] / UNIT_M - MAP_H / 2;
      if (name !== 'coast') {
        var cc = Math.min(COLS - 1, Math.floor((x1 + MAP_W / 2) / CELL));
        var cr = Math.min(ROWS - 1, Math.floor((z1 + MAP_H / 2) / CELL));
        land[cr * COLS + cc] += 1;
      }
    }
    pos[name] = out;
  });
  for (var i = 0; i < land.length; i++) land[i] = Math.min(1, land[i] / 40);
  landAttr.needsUpdate = true;

  // Fat lines have pixel widths; the wide additive pass under each is the glow.
  function fat(p, color, width, opacity, additive) {
    var mat = new LineMaterial({
      color: color, linewidth: width, transparent: true, opacity: opacity, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
    });
    mat.resolution.set(innerWidth, innerHeight);
    fatMats.push(mat);
    var line = new LineSegments2(new LineSegmentsGeometry().setPositions(p), mat);
    line.frustumCulled = false;
    scene.add(line);
    return mat;
  }
  // Hairlines for the dense street grid.
  function thin(p, color, opacity) {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    // normal blending: additive would pile the dense core up into a white blob
    var mat = new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: opacity, depthWrite: false });
    scene.add(new THREE.LineSegments(g, mat));
    return mat;
  }
  roadMats = {
    minor: thin(pos.minor, 0x5b3cc0, 0.22),
    street: thin(pos.street, 0x7a52e6, 0.45),
    arterialGlow: fat(pos.arterial, 0x6c2bd9, 4, 0.08, true),
    arterial: fat(pos.arterial, 0xa883ff, 1.2, 0.8),
    coastGlow: fat(pos.coast, 0x7c4dff, 7, 0.12, true),
    coast: fat(pos.coast, 0xc9b4ff, 1.4, 0.9),
    majorGlow: fat(pos.major, 0x8a5cff, 8, 0.14, true),
    major: fat(pos.major, 0xe6d6ff, 1.8, 1)
  };
  drawMinimapBase();
}

/* ================================================================
   Camera rig: a target on the ground, a distance, pitch tied to zoom
   ================================================================ */
var dMax = 1;
var cur = { x: 0, z: 0, d: 1 };   // rendered
var goal = { x: 0, z: 0, d: 1 };  // where damping heads
var fly = null;
var groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
var ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hitPt = new THREE.Vector3();

function fitDMax() {
  var aspect = innerWidth / innerHeight;
  dMax = Math.min(MAP_H / (2 * TAN), MAP_W / (2 * TAN * aspect));
}
fitDMax();
goal = areaView('all');
clampGoal();
cur = { x: goal.x, z: goal.z, d: goal.d };

function zoomLevel(d) { return dMax / d; }

function placeCamera() {
  var k = Math.pow(clamp01((dMax - cur.d) / (dMax - D_MIN)), 0.6);
  var pitch = (82 - 30 * k) * Math.PI / 180; // near top-down wide, tilts as you dive
  cam.position.set(cur.x, cur.d * Math.sin(pitch), cur.z + cur.d * Math.cos(pitch));
  cam.lookAt(cur.x, 0, cur.z);
  cam.updateMatrixWorld();
}

function clampGoal() {
  goal.d = Math.min(dMax, Math.max(D_MIN, goal.d));
  var visH = 2 * goal.d * TAN, visW = visH * cam.aspect;
  var lx = Math.max(0, (MAP_W - visW) / 2), lz = Math.max(0, (MAP_H - visH) / 2);
  goal.x = Math.min(lx, Math.max(-lx, goal.x));
  goal.z = Math.min(lz, Math.max(-lz, goal.z));
}

function groundAt(clientX, clientY) {
  ndc.set(clientX / innerWidth * 2 - 1, -(clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, cam);
  return ray.ray.intersectPlane(groundPlane, hitPt) ? hitPt.clone() : null;
}

function flyTo(x, z, d, done) {
  if (!renderer) { if (done) done(); return; }
  var to = { x: x, z: z, d: d };
  if (reduced) {
    goal.x = cur.x = to.x; goal.z = cur.z = to.z; goal.d = cur.d = to.d;
    clampGoal(); fly = null;
    if (done) done();
    return;
  }
  fly = { from: { x: goal.x, z: goal.z, d: goal.d }, to: to, t0: performance.now(), dur: 1600, done: done };
}

/* ================================================================
   Labels (HTML, projected from 3D)
   ================================================================ */
var areaTags = AREAS.filter(function (a) { return a.id !== 'all'; }).map(function (a) {
  var list = PROJECTS.filter(function (p) { return p.area === a.id; });
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'tag tag--' + a.side;
  b.setAttribute('aria-label', 'Zoom to ' + a.name);
  b.innerHTML =
    '<span class="tag__ping" aria-hidden="true"></span>' +
    '<span class="tag__diamond"><span class="tag__dot"></span></span>' +
    '<span class="tag__plate"><span class="tag__name">' + a.name + '</span>' +
    '<span class="tag__meta">' + pad(list.length) + ' project' + (list.length === 1 ? '' : 's') + ' · Click to zoom</span></span>';
  b.addEventListener('click', function () { flyToArea(a.id); });
  labelsEl.appendChild(b);
  var x = 0, z = 0;
  list.forEach(function (p) { x += p.x; z += p.z; });
  return { el: b, pos: new THREE.Vector3(x / list.length, 1, z / list.length) };
});

var projectLabels = PROJECTS.map(function (p, i) {
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'plabel';
  b.innerHTML = p.name + '<span class="plabel__status">' + p.status + '</span>';
  b.addEventListener('click', function () { selectProject(i); });
  b.addEventListener('mouseenter', function () { labelHover = i; });
  b.addEventListener('mouseleave', function () { labelHover = -1; });
  labelsEl.appendChild(b);
  return { el: b, pos: new THREE.Vector3(p.x, ROAD_Y + 1, p.z) };
});

var tmpV = new THREE.Vector3();
function placeLabel(el, pos, opacity) {
  tmpV.copy(pos).project(cam);
  var x = (tmpV.x + 1) / 2 * innerWidth, y = (1 - tmpV.y) / 2 * innerHeight;
  el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
  el.style.opacity = opacity.toFixed(3);
  el.style.pointerEvents = opacity > 0.5 ? 'auto' : 'none';
  el.tabIndex = opacity > 0.5 ? 0 : -1;
}

/* ================================================================
   Project selection + card
   ================================================================ */
function sync() {
  var vis = 0;
  PROJECTS.forEach(function (p, i) {
    var on = visible(p);
    if (on) vis++;
    projectLabels[i].el.classList.toggle('is-hidden', !on);
    projectLabels[i].el.classList.toggle('is-hot', on && (hovered === i || active === i));
  });
  $('visCount').textContent = pad(vis);
  root.style.cursor = hovered >= 0 ? 'pointer' : '';
}
$('totalCount').textContent = pad(PROJECTS.length);

function closeCard() {
  active = -1;
  cardSlot.innerHTML = '';
  sync();
}

function openCard(i) {
  active = i;
  var p = PROJECTS[i];
  var slug = p.name.toLowerCase().replace(/\s+/g, '-');
  var card = document.createElement('div');
  card.className = 'card';
  card.innerHTML =
    '<div class="card__media">' +
      (p.soon ? '' : '<img class="card__img" src="uploads/images/projects/' + slug + '.jpeg" alt="' + p.name + '" decoding="async">') +
      '<button class="card__close" type="button" aria-label="Close">×</button>' +
    '</div>' +
    '<div class="card__body">' +
      '<span class="card__status" style="color:' + STATUS_COLOR[p.status] + '">' + p.status + '</span>' +
      '<h3 class="card__name">' + p.name + '</h3>' +
      '<div class="card__meta">' + p.loc + ' · ' + p.type + '</div>' +
      (p.soon ? '<span class="btn card__soon">Tour coming soon</span>'
              : '<a class="btn" href="interiors.html?p=' + slug + '">View project <span aria-hidden="true">→</span></a>') +
    '</div>';
  card.querySelector('.card__close').addEventListener('click', closeCard);
  cardSlot.innerHTML = '';
  cardSlot.appendChild(card);
  sync();
}

function selectProject(i) {
  closeCard();
  closeList();
  active = i;
  sync();
  setRegion(PROJECTS[i].area);
  flyTo(PROJECTS[i].x, PROJECTS[i].z, D_PROJECT, function () { if (active === i) openCard(i); });
}

function flyToArea(id) {
  closeCard();
  setRegion(id);
  var v = areaView(id);
  flyTo(v.x, v.z, v.d);
}

// Camera framing that fits every project in an area ('all' = the whole portfolio).
function areaView(id) {
  var list = PROJECTS.filter(function (p) { return id === 'all' || p.area === id; });
  var x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  list.forEach(function (p) {
    x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
    z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z);
  });
  var span = Math.max(x1 - x0, (z1 - z0) * cam.aspect) * 1.25 + 6; // margin around the cluster
  return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, d: Math.min(dMax, Math.max(D_PROJECT, span / (2 * TAN * cam.aspect))) };
}

/* ================================================================
   Region nav (left)
   ================================================================ */
var regionBtns = AREAS.map(function (a) {
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'regions__btn';
  b.textContent = a.name;
  b.addEventListener('click', function () { flyToArea(a.id); });
  $('regions').appendChild(b);
  return b;
});
function setRegion(id) {
  region = id;
  sync();
  if (plist && !plist.hidden) renderList(); // plist is set later in the file
  AREAS.forEach(function (a, i) {
    regionBtns[i].classList.toggle('is-on', a.id === id);
    regionBtns[i].setAttribute('aria-current', a.id === id ? 'true' : 'false');
  });
}
setRegion('all');

/* ================================================================
   Filters (bottom-right popover)
   ================================================================ */
var chipsEl = $('chips'), filterBtn = $('filterBtn');
CHIPS.forEach(function (label) {
  var b = document.createElement('button');
  b.className = 'chip';
  b.type = 'button';
  b.textContent = label;
  b.setAttribute('aria-pressed', 'false');
  b.addEventListener('click', function () {
    filters[label] = !filters[label];
    b.classList.toggle('is-on', !!filters[label]);
    b.setAttribute('aria-pressed', String(!!filters[label]));
    $('filterCount').textContent = '[' + pad(CHIPS.filter(function (c) { return filters[c]; }).length) + ']';
    sync();
    renderList();
  });
  chipsEl.appendChild(b);
});
filterBtn.addEventListener('click', function () {
  chipsEl.hidden = !chipsEl.hidden;
  filterBtn.setAttribute('aria-expanded', String(!chipsEl.hidden));
});

/* ================================================================
   Project list panel
   ================================================================ */
var plist = $('plist'), listBtn = $('listBtn');
function renderList() {
  var rows = $('plistRows');
  rows.innerHTML = '';
  PROJECTS.forEach(function (p, i) {
    if ((areaFilter !== 'all' && p.area !== areaFilter) || !matches(p) || (p.reveal && areaFilter !== p.area && region !== p.area)) return;
    var li = document.createElement('li');
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'plist__row';
    b.innerHTML =
      '<span><b>' + p.name + '</b><small>' + p.type + ' · ' + p.status + '</small></span>' +
      '<span class="plist__loc">' + p.loc.replace(', Mumbai', '') + '</span>' +
      '<span class="plist__go">Discover →</span>';
    b.addEventListener('click', function () { selectProject(i); });
    li.appendChild(b);
    rows.appendChild(li);
  });
  if (!rows.children.length) rows.innerHTML = '<li class="plist__empty">No projects match these filters.</li>';
}
AREAS.forEach(function (a) {
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'plist__tab' + (a.id === 'all' ? ' is-on' : '');
  b.textContent = a.id === 'all' ? 'All' : a.name;
  b.addEventListener('click', function () {
    areaFilter = a.id;
    Array.prototype.forEach.call($('plistTabs').children, function (t) { t.classList.toggle('is-on', t === b); });
    renderList();
  });
  $('plistTabs').appendChild(b);
});
function openList() {
  renderList();
  plist.hidden = false;
  listBtn.setAttribute('aria-expanded', 'true');
  $('listClose').focus();
}
function closeList() {
  if (plist.hidden) return;
  plist.hidden = true;
  listBtn.setAttribute('aria-expanded', 'false');
}
listBtn.addEventListener('click', function () { plist.hidden ? openList() : closeList(); });
$('listClose').addEventListener('click', function () { closeList(); listBtn.focus(); });

/* ================================================================
   Intro overlay — once per session
   ================================================================ */
var intro = $('intro'), seen = false;
try { seen = sessionStorage.getItem('ht-map-intro') === '1'; } catch (e) {}
if (!seen) {
  intro.hidden = false;
  $('introEnter').focus();
}
$('introEnter').addEventListener('click', function () {
  intro.classList.add('is-out');
  setTimeout(function () { intro.hidden = true; }, 600);
  try { sessionStorage.setItem('ht-map-intro', '1'); } catch (e) {}
});

/* ================================================================
   Minimap
   ================================================================ */
var mini = $('minimap'), mctx = mini.getContext('2d'), miniBase = null;
function drawMinimapBase() {
  miniBase = document.createElement('canvas');
  miniBase.width = mini.width; miniBase.height = mini.height;
  var g = miniBase.getContext('2d'), sx = mini.width / (MAP_W * UNIT_M), sy = mini.height / (MAP_H * UNIT_M);
  [['minor', 'rgba(107,70,217,.35)', 0.5], ['arterial', '#9b6bff', 1], ['major', '#e6d6ff', 1.5], ['coast', '#c9b4ff', 1.2]].forEach(function (l) {
    var a = roadSegs[l[0]];
    g.strokeStyle = l[1];
    g.lineWidth = l[2];
    g.beginPath();
    for (var k = 0; k < a.length; k += 4) {
      g.moveTo(a[k] * sx, a[k + 1] * sy);
      g.lineTo(a[k + 2] * sx, a[k + 3] * sy);
    }
    g.stroke();
  });
}
function drawMinimap() {
  var w = mini.width, h = mini.height;
  mctx.clearRect(0, 0, w, h);
  if (miniBase) {
    mctx.globalAlpha = 0.8;
    mctx.drawImage(miniBase, 0, 0);
    mctx.globalAlpha = 1;
  }
  mctx.fillStyle = '#c9b4ff';
  PROJECTS.forEach(function (p) { if (visible(p)) mctx.fillRect((p.x / MAP_W + 0.5) * w - 2, (p.z / MAP_H + 0.5) * h - 2, 4, 4); });
  var visH = 2 * cur.d * TAN, visW = visH * cam.aspect;
  mctx.strokeStyle = '#9b6bff';
  mctx.lineWidth = 2;
  mctx.strokeRect((cur.x - visW / 2) / MAP_W * w + w / 2, (cur.z - visH / 2) / MAP_H * h + h / 2,
                  visW / MAP_W * w, visH / MAP_H * h);
}
mini.addEventListener('click', function (e) {
  var r = mini.getBoundingClientRect();
  flyTo(((e.clientX - r.left) / r.width - 0.5) * MAP_W, ((e.clientY - r.top) / r.height - 0.5) * MAP_H, goal.d);
});

/* ================================================================
   Input: wheel zoom toward cursor, drag pan, pinch, hover/click cubes
   ================================================================ */
var canvas = $('gl');
var pointers = new Map(), dragFrom = null, downAt = null, pinchDist = 0;
var mouseX = innerWidth / 2, mouseY = innerHeight / 2;
var spot = new THREE.Vector2(), spotGoal = new THREE.Vector2();

function zoomAt(factor, clientX, clientY) {
  fly = null;
  var before = goal.d;
  goal.d = Math.min(dMax, Math.max(D_MIN, goal.d * factor));
  var g = groundAt(clientX, clientY);
  if (g) {
    var k = 1 - goal.d / before; // keep the ground point under the cursor
    goal.x += (g.x - goal.x) * k;
    goal.z += (g.z - goal.z) * k;
  }
  clampGoal();
}

root.addEventListener('wheel', function (e) {
  if (!renderer || e.target.closest('.plist, .card, .chips, .intro')) return;
  e.preventDefault();
  zoomAt(Math.exp(e.deltaY * 0.0015), e.clientX, e.clientY);
}, { passive: false });

canvas.addEventListener('pointerdown', function (e) {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  downAt = { x: e.clientX, y: e.clientY };
  if (pointers.size === 1) dragFrom = groundAt(e.clientX, e.clientY);
  if (pointers.size === 2) {
    var pts = Array.from(pointers.values());
    pinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    dragFrom = null;
  }
});

canvas.addEventListener('pointermove', function (e) {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    var pts = Array.from(pointers.values());
    var dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    if (pinchDist) zoomAt(pinchDist / dist, (pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
    pinchDist = dist;
    return;
  }
  if (dragFrom && pointers.size === 1) {
    fly = null;
    // Pan without damping so the grabbed ground point stays glued to the pointer.
    var g = groundAt(e.clientX, e.clientY);
    if (g) {
      goal.x = cur.x = cur.x + dragFrom.x - g.x;
      goal.z = cur.z = cur.z + dragFrom.z - g.z;
      clampGoal();
      cur.x = goal.x; cur.z = goal.z;
      placeCamera();
    }
    root.classList.add('is-dragging');
  }
});

function endPointer(e) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchDist = 0;
  if (pointers.size === 0) {
    var moved = downAt ? Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) : 99;
    if (moved < 6 && e.type === 'pointerup' && hovered >= 0) selectProject(hovered);
    dragFrom = null;
    root.classList.remove('is-dragging');
  }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

addEventListener('pointermove', function (e) { mouseX = e.clientX; mouseY = e.clientY; });

addEventListener('pointerdown', function () {
  if (cursorRing && cursorRing.animate && !reduced) {
    cursorRing.animate(
      [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.8)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
      { duration: 450, easing: 'ease-out' });
  }
});

addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  if (!chipsEl.hidden) { chipsEl.hidden = true; filterBtn.setAttribute('aria-expanded', 'false'); }
  else if (!plist.hidden) closeList();
  else closeCard();
});

addEventListener('resize', function () {
  if (!renderer) return;
  renderer.setSize(innerWidth, innerHeight, false);
  composer.setSize(innerWidth, innerHeight);
  fatMats.forEach(function (m) { m.resolution.set(innerWidth, innerHeight); });
  cam.aspect = innerWidth / innerHeight;
  cam.updateProjectionMatrix();
  fitDMax();
  clampGoal();
});

function pickHover() {
  if (!renderer || pointers.size || !intro.hidden) return;
  ndc.set(mouseX / innerWidth * 2 - 1, -(mouseY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, cam);
  var hits = ray.intersectObjects(cubes.filter(function (c) { return c.group.visible; }).map(function (c) { return c.hit; }));
  var h = labelHover >= 0 ? labelHover : hits.length ? hits[0].object.userData.index : -1;
  if (h !== hovered) { hovered = h; sync(); }
}

/* ================================================================
   Loop
   ================================================================ */
var zoomText = $('zoomText'), scaleText = $('scaleText'), scaleBar = $('scaleBar');
var lastHud = '', last = performance.now();
var NICE_KM = [0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 20];

sync();

function frame(now) {
  var dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (fly) {
    var t = Math.min(1, (now - fly.t0) / fly.dur), e = easeInOut(t);
    goal.x = fly.from.x + (fly.to.x - fly.from.x) * e;
    goal.z = fly.from.z + (fly.to.z - fly.from.z) * e;
    // Log-space distance so the dive feels even instead of rushing the last metres.
    goal.d = Math.exp(Math.log(fly.from.d) + (Math.log(fly.to.d) - Math.log(fly.from.d)) * e);
    clampGoal();
    if (t >= 1) { var done = fly.done; fly = null; if (done) done(); }
  }

  var k = 1 - Math.exp(-dt * 7);
  cur.x += (goal.x - cur.x) * k;
  cur.z += (goal.z - cur.z) * k;
  cur.d += (goal.d - cur.d) * k;
  placeCamera();

  var zoom = zoomLevel(cur.d);
  var tagO = 1 - clamp01((zoom - 1.6) / 0.8);
  var projO = clamp01((zoom - 2) / 1.0);

  // cursor spotlight on the tiles
  var g = intro.hidden ? groundAt(mouseX, mouseY) : null;
  if (g) spotGoal.set(g.x, g.z);
  spot.lerp(spotGoal, k);
  tileUniforms.uMouse.value.copy(spot);
  tileUniforms.uSpotR.value = cur.d * 0.45;
  if (roadMats) {
    // the street grid comes up as you dive; the big glows ease off so close-ups stay legible
    var deep = clamp01((zoom - 2) / 6);
    roadMats.minor.opacity = 0.22 + 0.3 * deep;
    roadMats.street.opacity = 0.45 + 0.25 * deep;
    roadMats.majorGlow.opacity = 0.14 - 0.08 * deep;
    roadMats.arterialGlow.opacity = 0.08 - 0.05 * deep;
  }

  cubes.forEach(function (c, i) {
    var on = visible(PROJECTS[i]);
    var hot = on && (hovered === i || active === i);
    var target = on ? (hot ? 1.35 : 1) : 0;
    c.s += (target - c.s) * k;
    c.group.visible = c.s > 0.02 && projO > 0.01;
    c.group.scale.setScalar(Math.max(0.001, c.s));
    c.cube.position.y = 0.4 + Math.sin(now / 700 + c.phase) * 0.04;
    c.cube.rotation.y += dt * 0.4;
    c.halo.position.y = c.cube.position.y;
    c.cube.material.opacity = projO;
    c.halo.material.opacity = projO * (hot ? 0.6 : 0.35);
    c.pool.material.opacity = projO * 0.35;
  });

  areaTags.forEach(function (a) { placeLabel(a.el, a.pos, tagO); });
  projectLabels.forEach(function (l, i) {
    var hot = hovered === i || active === i;
    placeLabel(l.el, l.pos, visible(PROJECTS[i]) ? projO * (hot || zoom > 4 ? 1 : 0.75) : 0);
  });

  pickHover();
  composer.render();

  // HUD
  var pxPerUnit = innerHeight / (2 * cur.d * TAN);
  var kmPerUnit = UNIT_M / 1000;
  var km = NICE_KM[0];
  NICE_KM.forEach(function (n) { if (n / kmPerUnit * pxPerUnit <= 110) km = n; });
  var hud = zoom.toFixed(2) + '|' + km;
  if (hud !== lastHud) {
    lastHud = hud;
    zoomText.textContent = zoom.toFixed(2) + '×';
    scaleText.textContent = (km < 1 ? km * 1000 + ' m' : km + ' km');
    scaleBar.style.width = Math.round(km / kmPerUnit * pxPerUnit) + 'px';
  }
  root.classList.toggle('is-zoomed', zoom > 1.5);
  if (zoom > 1.5) drawMinimap();

  requestAnimationFrame(frame);
}

if (renderer) requestAnimationFrame(frame);

/* custom cursor follows the pointer */
(function cursorLoop() {
  var cx = mouseX, cy = mouseY;
  (function tick() {
    cx += (mouseX - cx) * 0.22;
    cy += (mouseY - cy) * 0.22;
    cursorEl.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)';
    requestAnimationFrame(tick);
  })();
})();
