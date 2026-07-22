(function () {
  'use strict';

  var DATA = {
    'hubtown-solaris':  { name: 'Hubtown Solaris',  loc: 'Andheri (E), Mumbai',    type: 'Commercial' },
    'hubtown-viva':     { name: 'Hubtown Viva',     loc: 'Jogeshwari (E), Mumbai', type: 'Commercial' },
    'hubtown-premiere': { name: 'Hubtown Premiere', loc: 'Andheri (W), Mumbai',    type: 'Residential' },
    'hubtown-harmony':  { name: 'Hubtown Harmony',  loc: 'Goregaon (W), Mumbai',   type: 'Residential' },
    'hubtown-celeste':  { name: 'Hubtown Celeste',  loc: 'Vile Parle (E), Mumbai', type: 'Commercial' }
  };

  // Room sets differ by building type — a commercial tower has no master bedroom.
  // The hero panel carries no room label; it reuses the first room's image as its backdrop.
  var ROOM_SETS = {
    Commercial: [
      { hero: true,                             img: 'reception' },
      { room: 'Reception',      tag: 'Arrival',  img: 'reception' },
      { room: 'Grand Lobby',    tag: 'Common',   img: 'lobby' },
      { room: 'Workspace',      tag: 'Offices',  img: 'workspace' },
      { room: 'Boardroom',      tag: 'Offices',  img: 'boardroom' },
      { room: 'Café',           tag: 'Amenity',  img: 'cafe' },
      { room: 'Sky Terrace',    tag: 'Amenity',  img: 'terrace' }
    ],
    Residential: [
      { hero: true,                             img: 'arrival' },
      { room: 'Arrival',        tag: 'Arrival',  img: 'arrival' },
      { room: 'Grand Lobby',    tag: 'Common',   img: 'lobby' },
      { room: 'Living Room',    tag: 'Residence', img: 'living-room' },
      { room: 'Master Bedroom', tag: 'Residence', img: 'master-bedroom' },
      { room: 'Kitchen',        tag: 'Residence', img: 'kitchen' },
      { room: 'Rooftop Deck',   tag: 'Amenity',  img: 'rooftop-deck' }
    ]
  };

  var GRADS = [
    'linear-gradient(155deg,#171021 0%,#2a1750 55%,#3D1A85 120%)',
    'linear-gradient(155deg,#12101a 0%,#241640 60%,#4A2596 130%)',
    'linear-gradient(155deg,#1a1226 0%,#31205c 55%,#5B33B0 125%)',
    'linear-gradient(155deg,#100f16 0%,#1f1838 60%,#3D1A85 120%)',
    'linear-gradient(155deg,#181120 0%,#2d1a54 55%,#6C2BD9 135%)',
    'linear-gradient(155deg,#12101a 0%,#281a48 58%,#4A2596 125%)'
  ];

  var esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };

  var slug = new URLSearchParams(location.search).get('p');
  var prop = DATA[slug] || DATA['hubtown-solaris'];
  var propSlug = DATA[slug] ? slug : 'hubtown-solaris';
  var ROOMS = ROOM_SETS[prop.type];
  document.title = prop.name + ' — Interiors — Hubtown';

  var panelsWrap = document.getElementById('panels');
  var dotsWrap = document.getElementById('dots');
  var scroller = document.getElementById('scroller');
  var stage = document.getElementById('stage');
  var hint = document.getElementById('hint');

  var panels = ROOMS.map(function (r, i) {
    var el = document.createElement('div');
    el.className = 'panel-i';
    el.style.zIndex = i;

    var inner = r.hero
      ? '<div class="hero-i">' +
          '<div class="hero-i__clip"><div class="hero-i__eyebrow">Interiors</div></div>' +
          '<div class="hero-i__clip"><h1 class="hero-i__title">' + esc(prop.name) + '</h1></div>' +
          '<div class="hero-i__clip"><div class="hero-i__meta">' + esc(prop.loc) + ' · ' + esc(prop.type) + '</div></div>' +
        '</div>'
      : '';

    var room = r.hero ? '' :
      '<div class="room">' +
        '<span class="room__tag">' + esc(r.tag) + '</span>' +
        '<span class="room__name">' + esc(r.room) + '</span>' +
      '</div>';

    el.innerHTML =
      '<div class="panel-i__img" style="background:' + GRADS[i % GRADS.length] + '">' +
        '<img class="panel-i__photo" src="uploads/images/interiors/' + propSlug + '/' + r.img + '.jpeg"' +
          ' alt="' + esc(prop.name) + (r.room ? ' — ' + esc(r.room) : '') + '"' +
          (i > 1 ? ' loading="lazy"' : '') + ' decoding="async">' +
        '<div class="panel-i__grid"></div>' + room +
      '</div>' +
      '<div class="panel-i__scrim"></div>' + inner;

    panelsWrap.appendChild(el);

    var dot = document.createElement('span');
    dot.className = 'dot';
    dotsWrap.appendChild(dot);

    return { wrap: el, img: el.querySelector('.panel-i__img'), dot: dot };
  });

  stage.style.height = (ROOMS.length * 100) + 'vh';

  var vh = scroller.clientHeight;
  var p = 0, tp = 0, activeDot = -1, hintHidden = false;

  scroller.addEventListener('scroll', function () { tp = scroller.scrollTop / vh; }, { passive: true });
  addEventListener('resize', function () { vh = scroller.clientHeight; });

  (function loop() {
    p += (tp - p) * 0.11;

    for (var i = 1; i < panels.length; i++) {
      var raw = Math.min(1, Math.max(0, p - (i - 1)));
      var t = raw * raw * (3 - 2 * raw); // smoothstep
      panels[i].wrap.style.clipPath = 'inset(0 0 ' + ((1 - t) * 100).toFixed(2) + '% 0)';
      panels[i].img.style.transform = 'scale(' + (1.16 - 0.16 * t).toFixed(4) + ')';
    }

    // slow drift on the base panel
    var d = Math.min(1, p);
    panels[0].img.style.transform = 'scale(' + (1 + d * 0.06).toFixed(4) + ') translateY(' + (d * -3).toFixed(2) + '%)';

    if (p > 0.12 && !hintHidden) {
      hintHidden = true;
      hint.style.animation = 'none';
      hint.style.transition = 'opacity .5s ease';
      hint.style.opacity = '0';
    }

    var act = Math.min(panels.length - 1, Math.round(p));
    if (act !== activeDot) {
      activeDot = act;
      panels.forEach(function (pn, i) { pn.dot.classList.toggle('is-on', i === act); });
    }

    requestAnimationFrame(loop);
  })();
})();
