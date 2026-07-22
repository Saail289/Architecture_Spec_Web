(function () {
  'use strict';

  var SECTIONS = ['Future', 'Innovation', 'Excellence', 'Purpose', 'Legacy', 'Connect'];
  var IDS = ['future', 'innovation', 'excellence', 'purpose', 'legacy', 'connect'];
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var LOADER_MS = 1900;

  /* ---------------- loader ---------------- */
  function runLoader() {
    var el = document.getElementById('loader');
    var pctEl = document.getElementById('loadPct');
    var barEl = document.getElementById('loadBar');
    if (reduced) { el.classList.add('is-gone'); return; }

    var t0 = performance.now(), dur = LOADER_MS;
    (function tick(t) {
      var p = Math.min(1, (t - t0) / dur);
      var pct = Math.round((1 - Math.pow(1 - p, 2.2)) * 100); // ease-out: count feels deliberate
      pctEl.textContent = pct;
      barEl.style.width = pct + '%';
      if (p < 1) requestAnimationFrame(tick);
      else {
        el.classList.add('is-fading');
        setTimeout(function () { el.classList.add('is-gone'); }, 750);
      }
    })(performance.now());
  }

  /* ---------------- right rail + section counter ---------------- */
  function buildRail() {
    var rail = document.getElementById('rail');
    var counterNum = document.getElementById('counterCurrent');
    var counterBar = document.getElementById('counterBar');
    var items = SECTIONS.map(function (name, i) {
      var btn = document.createElement('button');
      btn.className = 'rail__item';
      btn.type = 'button';
      btn.innerHTML = '<span class="rail__label">' + name + '</span>' +
                      '<span class="rail__ring"><span class="rail__dot"></span></span>';
      btn.addEventListener('click', function () {
        var t = document.getElementById(IDS[i]);
        if (t) window.scrollTo({ top: t.offsetTop, behavior: reduced ? 'auto' : 'smooth' });
      });
      rail.appendChild(btn);
      return btn;
    });

    var active = -1;
    function setActive(i) {
      if (i === active) return;
      active = i;
      items.forEach(function (b, n) { b.classList.toggle('is-active', n === i); });
      counterNum.textContent = String(i + 1).padStart(2, '0');
      counterBar.style.width = Math.round(((i + 1) / SECTIONS.length) * 100) + '%';
    }
    setActive(0);

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var i = parseInt(e.target.getAttribute('data-idx'), 10);
        if (!isNaN(i)) setActive(i);
      });
    }, { threshold: 0.45 });
    document.querySelectorAll('section[data-idx]').forEach(function (s) { obs.observe(s); });
  }

  /* ---------------- digit scramble on the hero stats ---------------- */
  function scramble(el, finalText, dur, delay) {
    if (!el) return;
    var n = finalText.length;
    var rnd = new Array(n).fill('0');
    setTimeout(function () {
      var start = performance.now(), lastRegen = 0;
      (function step(now) {
        var raw = Math.min(1, (now - start) / dur);
        var revealed = (1 - Math.pow(1 - raw, 3)) * n; // easeOutCubic
        if (now - lastRegen > 70) { // throttle churn so it reads smooth, not flickery
          lastRegen = now;
          for (var i = 0; i < n; i++) rnd[i] = String((Math.random() * 10) | 0);
        }
        var out = '';
        for (var j = 0; j < n; j++) out += (j < Math.floor(revealed)) ? finalText[j] : rnd[j];
        el.textContent = out;
        if (raw < 1) requestAnimationFrame(step);
        else el.textContent = finalText;
      })(performance.now());
    }, delay || 0);
  }

  // Runs on every load. Deliberately not tied to the video fetch — a slow or
  // failed 10MB download must never delay or swallow the count-in.
  function runStats() {
    var els = document.querySelectorAll('[data-stat]');
    els.forEach(function (el) {
      // remember the target once, so a re-run can't scramble a scrambled value
      if (!el.dataset.final) el.dataset.final = el.textContent.trim();
    });
    if (reduced) return;
    els.forEach(function (el, i) {
      scramble(el, el.dataset.final, 1200, i * 130);
    });
  }

  /* ---------------- scroll scrub + reveal ---------------- */
  function runScrub() {
    var video = document.getElementById('bgVideo');
    var reveals = Array.from(document.querySelectorAll('[data-reveal]'));
    var scrubTime = 0;

    if (reduced) {
      reveals.forEach(function (el) { el.style.opacity = 1; });
      return;
    }

    // Start the loop before the video is fetched so element positions settle on
    // first paint — otherwise the reveal transform only kicks in once the blob
    // finishes loading, which visibly shifts the stats down.
    (function loop() {
      var vh = window.innerHeight;
      var max = document.documentElement.scrollHeight - vh;
      var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;

      if (video.duration && video.readyState >= 2) {
        var target = p * Math.max(0, video.duration - 0.05);
        scrubTime += (target - scrubTime) * 0.1; // lerp: smooth in both directions
        if (Math.abs(video.currentTime - scrubTime) > 0.005) {
          try { video.currentTime = scrubTime; } catch (e) {}
        }
      }

      var band = vh * 0.42;
      for (var i = 0; i < reveals.length; i++) {
        var r = reveals[i].getBoundingClientRect();
        var o = Math.min(1, Math.max(0, Math.min((vh - r.top) / band, r.bottom / band)));
        reveals[i].style.opacity = o.toFixed(3);
        reveals[i].style.transform = 'translateY(' + ((1 - o) * 36).toFixed(1) + 'px)';
      }
      requestAnimationFrame(loop);
    })();

    video.pause();
    // The served file may lack byte-range support, in which case currentTime
    // assignments are silently ignored. A blob URL is always fully seekable.
    fetch(video.getAttribute('src'))
      .then(function (r) { return r.blob(); })
      .then(function (b) {
        video.src = URL.createObjectURL(b);
        video.load();
        video.pause();
      })
      .catch(function () { /* fall back to the plain src */ });
  }

  runLoader();
  buildRail();
  runScrub();
  // Fire once the loader has cleared, so the count-in is actually seen rather
  // than playing out behind the overlay.
  setTimeout(runStats, reduced ? 0 : LOADER_MS + 250);

  // Returning via Back/Forward restores from bfcache without re-running this
  // script, so replay explicitly — the count-in should greet every arrival.
  addEventListener('pageshow', function (e) { if (e.persisted) runStats(); });
})();
