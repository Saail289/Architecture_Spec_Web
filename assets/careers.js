(function () {
  'use strict';

  var ROLES = [
    {
      title: 'Site Engineer', dept: 'Construction',
      desc: 'Own the day-to-day on the ground — sequencing crews, reading structural drawings and keeping quality and safety uncompromising as the building rises floor by floor.',
      tags: ['Full-time', 'On-site · Mumbai', '3+ yrs'],
      img: 'site-engineer.jpeg', pos: '38% 50%',
      grad: 'linear-gradient(150deg,#1a1226 0%,#2a1750 55%,#3D1A85 120%)'
    },
    {
      title: 'Project Architect', dept: 'Design',
      desc: 'Translate a bold concept into buildable detail. You lead drawing sets, coordinate consultants and defend the design intent from first sketch to final handover.',
      tags: ['Full-time', 'Studio + site', 'B.Arch'],
      img: 'project-architect.jpeg',
      grad: 'linear-gradient(150deg,#12101a 0%,#241640 60%,#4A2596 130%)'
    },
    {
      title: 'Structural Designer', dept: 'Engineering',
      desc: 'Make the ambitious stand up. Model load paths, optimise material and collaborate with architects so elegance and safety are never a trade-off.',
      tags: ['Full-time', 'Hybrid', 'M.Tech pref.'],
      img: 'structural-designer.jpeg',
      grad: 'linear-gradient(150deg,#181120 0%,#31205c 55%,#5B33B0 125%)'
    },
    {
      title: 'Construction Manager', dept: 'Delivery',
      desc: 'Run the whole programme — budget, schedule, vendors and risk. You are the single point where a hundred moving parts become one delivered building.',
      tags: ['Full-time', 'On-site · Mumbai', '8+ yrs'],
      img: 'construction-manager.jpeg',
      grad: 'linear-gradient(150deg,#100f16 0%,#1f1838 60%,#3D1A85 120%)'
    },
    {
      title: 'Interior Designer', dept: 'Experience',
      desc: 'Shape how spaces feel the moment someone walks in. From lobbies to model homes, you curate material, light and detail into a coherent Hubtown signature.',
      tags: ['Full-time', 'Studio', 'Portfolio'],
      img: 'interior-designer.jpeg',
      grad: 'linear-gradient(150deg,#171020 0%,#2d1a54 55%,#6C2BD9 135%)'
    }
  ];

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };

  var list = document.getElementById('roleList');
  var scroller = document.getElementById('scroller');

  var sections = ROLES.map(function (r, i) {
    var sec = document.createElement('section');
    sec.className = 'role';
    sec.innerHTML =
      '<div class="role__grid">' +
        '<div class="role__text">' +
          '<div class="role__meta">' +
            '<span class="role__num">' + String(i + 1).padStart(2, '0') + '</span>' +
            '<span class="role__rule"></span>' +
            '<span class="role__dept">' + esc(r.dept) + '</span>' +
          '</div>' +
          '<h2 class="role__title"></h2>' +
          '<p class="role__desc"></p>' +
          '<div class="role__tags">' +
            r.tags.map(function (t) { return '<span class="role__tag">' + esc(t) + '</span>'; }).join('') +
          '</div>' +
          '<a class="btn btn--solid role__apply" href="apply.html?role=' + encodeURIComponent(r.title) + '">' +
            'Apply for this role <span aria-hidden="true">→</span></a>' +
        '</div>' +
        '<div class="role__media">' +
          '<div class="role__frame" style="background:' + r.grad + '">' +
            '<img class="role__img" src="uploads/images/careers/' + r.img + '" alt="' + esc(r.title) + '"' +
              (r.pos ? ' style="--img-pos:' + r.pos + '"' : '') +
              ' loading="lazy" decoding="async">' +
          '</div>' +
        '</div>' +
      '</div>';
    list.appendChild(sec);
    return {
      el: sec,
      title: sec.querySelector('.role__title'),
      desc: sec.querySelector('.role__desc'),
      media: sec.querySelector('.role__media')
    };
  });

  /* ---------------- scramble reveal ---------------- */
  var CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

  function scramble(el, finalText, dur, delay) {
    var n = finalText.length;
    var win = Math.max(5, Math.round(n * 0.18)); // width of the scrambling frontier
    var rnd = new Array(n).fill(' ');
    el.textContent = '';
    el.style.opacity = '0';
    setTimeout(function () {
      el.style.transition = 'opacity .6s ease';
      el.style.opacity = '1';
      var start = performance.now(), lastRegen = 0;
      (function step(now) {
        var raw = Math.min(1, (now - start) / dur);
        var frontier = (1 - Math.pow(1 - raw, 3)) * (n + win); // easeOutCubic
        if (now - lastRegen > 55) { // throttle char churn so it reads smooth, not flickery
          lastRegen = now;
          for (var i = 0; i < n; i++) rnd[i] = CHARS[(Math.random() * CHARS.length) | 0];
        }
        var out = '';
        for (var j = 0; j < n; j++) {
          var ch = finalText[j];
          if (ch === ' ') out += ' ';
          else if (j < frontier - win) out += ch;      // settled
          else if (j < frontier) out += rnd[j];        // scrambling near the frontier
          else out += ' ';                        // not yet arrived — hold width
        }
        el.textContent = out;
        if (raw < 1) requestAnimationFrame(step);
        else el.textContent = finalText;
      })(performance.now());
    }, delay || 0);
  }

  var seen = new Set();
  function revealOne(i) {
    if (seen.has(i)) return;
    seen.add(i);
    var s = sections[i], r = ROLES[i];
    if (reduced) {
      s.title.textContent = r.title;
      s.desc.textContent = r.desc;
      s.media.classList.add('is-in');
      return;
    }
    scramble(s.title, r.title, 1500, 160);
    scramble(s.desc, r.desc, 2100, 520);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { s.media.classList.add('is-in'); });
    });
  }

  function scan() {
    var vh = innerHeight;
    sections.forEach(function (s, i) {
      if (seen.has(i)) return;
      var r = s.el.getBoundingClientRect();
      // genuinely in view: top has risen above ~72% of the viewport and the
      // bottom hasn't left the top region
      if (r.top < vh * 0.72 && r.bottom > vh * 0.24) revealOne(i);
    });
  }

  var started = false, ticking = false;
  function start() {
    if (started) return;
    started = true;
    scroller.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; scan(); });
    }, { passive: true });
    scan();
  }

  // Wait for fonts + layout to settle before the first scan; otherwise the intro
  // section is briefly short and role 0 counts as in view at scrollTop 0 — it
  // would then reveal instantly and never appear to slide in.
  (document.fonts ? document.fonts.ready : Promise.resolve())
    .then(function () { requestAnimationFrame(function () { requestAnimationFrame(start); }); });
  setTimeout(start, 1600); // fallback if fonts never resolve

  window.initWater(document.getElementById('water'), { mood: 'Tidal', tint: 'Violet' });
})();
