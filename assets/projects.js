(function () {
  'use strict';

  // x/y are percentages of the map world, matching the prototype's tuned marker props.
  var PROJECTS = [
    { name: 'Hubtown Solaris',  loc: 'Andheri (E), Mumbai',    type: 'Commercial',  status: 'Completed',          x: 41,   y: 50 },
    { name: 'Hubtown Viva',     loc: 'Jogeshwari (E), Mumbai', type: 'Commercial',  status: 'Under Construction', x: 60,   y: 34 },
    { name: 'Hubtown Premiere', loc: 'Andheri (W), Mumbai',    type: 'Residential', status: 'Completed',          x: 10.5, y: 36 },
    { name: 'Hubtown Harmony',  loc: 'Goregaon (W), Mumbai',   type: 'Residential', status: 'Upcoming',           x: 31,   y: 37 },
    { name: 'Hubtown Celeste',  loc: 'Vile Parle (E), Mumbai', type: 'Commercial',  status: 'Completed',          x: 80,   y: 57 }
  ];
  var CHIPS = ['Residential', 'Commercial', 'Completed', 'Under Construction', 'Upcoming'];
  var TYPES = ['Residential', 'Commercial'];
  var STATUSES = ['Completed', 'Under Construction', 'Upcoming'];
  var STATUS_COLOR = { 'Completed': '#9B6BFF', 'Under Construction': '#F6F3F4', 'Upcoming': '#9C939A' };
  var AUTO_ZOOM_MS = 5000;
  var PARALLAX = 24;
  var WORLD_W = 1882, WORLD_H = 987;

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (id) { return document.getElementById(id); };

  var root = $('map'), video = $('zoomVideo'), tags = $('tags'), markersWrap = $('markers');
  var parallaxEl = $('parallax'), cursorEl = $('cursor'), cursorRing = $('cursorRing');
  var zoomText = $('zoomText'), zoomBar = $('zoomBar'), visCountEl = $('visCount');
  var chipsEl = $('chips'), cardSlot = $('cardSlot');

  var active = -1, hovered = -1, filters = {};

  /* ---------------- filtering ---------------- */
  function matches(p) {
    var types = TYPES.filter(function (t) { return filters[t]; });
    var stats = STATUSES.filter(function (s) { return filters[s]; });
    return (!types.length || types.indexOf(p.type) >= 0) &&
           (!stats.length || stats.indexOf(p.status) >= 0);
  }

  /* ---------------- markers ---------------- */
  var markerEls = PROJECTS.map(function (p, i) {
    var b = document.createElement('button');
    b.className = 'marker';
    b.type = 'button';
    b.style.left = p.x + '%';
    b.style.top = p.y + '%';
    b.setAttribute('aria-label', p.name);
    b.innerHTML =
      '<span class="marker__ping" style="animation-delay:' + (i * 0.35) + 's"></span>' +
      '<span class="marker__diamond"><span class="marker__dot"></span></span>' +
      '<span class="marker__label">' + p.name + '<br><span class="marker__status">' +
      p.status.toUpperCase() + '</span></span>';
    b.addEventListener('click', function (e) { e.stopPropagation(); openCard(i); });
    b.addEventListener('mouseenter', function () { hovered = i; syncMarkers(); });
    b.addEventListener('mouseleave', function () { hovered = -1; syncMarkers(); });
    markersWrap.appendChild(b);
    return b;
  });

  function syncMarkers() {
    var vis = 0;
    markerEls.forEach(function (el, i) {
      var on = matches(PROJECTS[i]);
      if (on) vis++;
      el.classList.toggle('is-hidden', !on);
      el.classList.toggle('is-hot', on && (hovered === i || active === i));
    });
    visCountEl.textContent = String(vis).padStart(2, '0');
  }
  $('totalCount').textContent = String(PROJECTS.length).padStart(2, '0');

  /* ---------------- filter chips ---------------- */
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
      syncMarkers();
    });
    chipsEl.appendChild(b);
  });
  syncMarkers();

  /* ---------------- project card ---------------- */
  function closeCard() {
    active = -1;
    cardSlot.innerHTML = '';
    syncMarkers();
  }

  function openCard(i) {
    active = i;
    var p = PROJECTS[i];
    var slug = p.name.toLowerCase().replace(/\s+/g, '-');
    var card = document.createElement('div');
    card.className = 'card';
    card.innerHTML =
      '<div class="card__media">' +
        '<img class="card__img" src="uploads/images/projects/' + slug + '.jpeg" alt="' + p.name + '" decoding="async">' +
        '<button class="card__close" type="button" aria-label="Close">×</button>' +
      '</div>' +
      '<div class="card__body">' +
        '<span class="card__status" style="color:' + STATUS_COLOR[p.status] + '">' + p.status + '</span>' +
        '<h3 class="card__name">' + p.name + '</h3>' +
        '<div class="card__meta">' + p.loc + ' · ' + p.type + '</div>' +
        '<a class="btn" href="interiors.html?p=' + slug + '">View project <span aria-hidden="true">→</span></a>' +
      '</div>';
    card.querySelector('.card__close').addEventListener('click', closeCard);
    cardSlot.innerHTML = '';
    cardSlot.appendChild(card);
    syncMarkers();
  }

  /* ---------------- camera ---------------- */
  var vw = innerWidth, vh = innerHeight;
  var cover = Math.max(vw / WORLD_W, vh / WORLD_H);
  var maxS = cover * 4;
  var s = cover * 1.02, ts = s;
  var px = 0, py = 0, tpx = 0, tpy = 0;
  var cx = vw / 2, cy = vh / 2, tcx = cx, tcy = cy;
  var auto = null, vidTime = 0, lastZoomShown = 0, seekStuckSince = 0, seekStuckAt = 0;

  addEventListener('pointermove', function (e) {
    tcx = e.clientX; tcy = e.clientY;
    tpx = ((e.clientX / innerWidth) - 0.5) * -PARALLAX;
    tpy = ((e.clientY / innerHeight) - 0.5) * -PARALLAX;
  });

  // Pan is intentionally disabled — the camera path is baked into the flythrough video.
  root.addEventListener('wheel', function (e) {
    e.preventDefault();
    auto = null; // user takes over from the auto-zoom tween
    ts = Math.min(maxS, Math.max(cover, ts * Math.exp(-e.deltaY * 0.0016)));
  }, { passive: false });

  addEventListener('resize', function () {
    cover = Math.max(innerWidth / WORLD_W, innerHeight / WORLD_H);
    maxS = cover * 4;
    if (ts < cover) ts = cover;
  });

  addEventListener('keydown', function (e) { if (e.key === 'Escape') closeCard(); });

  addEventListener('pointerdown', function () {
    if (cursorRing && cursorRing.animate && !reduced) {
      cursorRing.animate(
        [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.8)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
        { duration: 450, easing: 'ease-out' });
    }
  });

  $('zoomTag').addEventListener('click', function (e) {
    e.stopPropagation();
    // Defer a frame so the same-gesture pointerdown pulse can't race the tween start.
    requestAnimationFrame(function () {
      auto = { t0: performance.now(), from: ts, to: maxS, dur: AUTO_ZOOM_MS };
    });
  });

  /* ---------------- flythrough video ---------------- */
  // The served file may lack byte-range support, so currentTime assignments get
  // silently ignored. Load into a blob URL, which is always fully seekable.
  fetch(video.getAttribute('data-src'))
    .then(function (r) { return r.blob(); })
    .then(function (b) {
      video.src = URL.createObjectURL(b);
      video.load();
      video.pause();
      // The decode can wedge (also on retry) — poll and re-kick a few times.
      var tries = 0;
      var kick = setInterval(function () {
        if (video.readyState >= 2 || ++tries > 6) return clearInterval(kick);
        video.load();
        video.pause();
      }, 800);
    })
    .catch(function () {});

  /* ---------------- loop ---------------- */
  (function loop() {
    var now = performance.now();

    if (auto) {
      var a = auto;
      var t = Math.min(1, (now - a.t0) / a.dur);
      var ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // easeInOutCubic
      ts = a.from + (a.to - a.from) * ease;
      if (t >= 1) auto = null;
    }

    s += (ts - s) * 0.12;
    px += (tpx - px) * 0.055;
    py += (tpy - py) * 0.055;
    cx += (tcx - cx) * 0.22;
    cy += (tcy - cy) * 0.22;
    parallaxEl.style.transform = 'translate3d(' + px + 'px,' + py + 'px,0)';
    cursorEl.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)';

    var zr = s / cover;
    var phase = Math.min(1, Math.max(0, (zr - 1) / (maxS / cover - 1)));

    if (video.duration && video.readyState >= 2) {
      var target = phase * Math.max(0, video.duration - 0.05);
      vidTime += (target - vidTime) * 0.12;
      if (!video.seeking) {
        if (Math.abs(video.currentTime - vidTime) > 0.005) {
          try { video.currentTime = vidTime; } catch (e) {}
        }
        seekStuckSince = 0;
      } else if (!seekStuckSince) {
        seekStuckSince = now; seekStuckAt = video.currentTime;
      } else if (now - seekStuckSince > 500) {
        // watchdog: a seek that never completes gets re-issued
        if (Math.abs(video.currentTime - seekStuckAt) < 0.001) {
          vidTime = target;
          try { video.currentTime = target; } catch (e) {}
        }
        seekStuckSince = 0;
      }
    }

    // wide-shot tags fade out as zoom begins; markers fade in near full zoom
    var tagO = Math.min(1, Math.max(0, 1 - phase / 0.18));
    tags.style.opacity = tagO.toFixed(3);
    tags.style.pointerEvents = tagO > 0.4 ? 'auto' : 'none';

    var mkO = Math.min(1, Math.max(0, (phase - 0.78) / 0.2));
    markersWrap.style.opacity = mkO.toFixed(3);
    markersWrap.style.pointerEvents = mkO > 0.5 ? 'auto' : 'none';

    if (Math.abs(zr - lastZoomShown) > 0.005) {
      lastZoomShown = zr;
      zoomText.textContent = zr.toFixed(2) + '×';
      zoomBar.style.width = Math.round(((zr - 1) / 3) * 100) + '%';
    }

    requestAnimationFrame(loop);
  })();
})();
