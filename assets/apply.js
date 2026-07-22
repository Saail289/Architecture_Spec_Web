(function () {
  'use strict';

  var ROLE_OPTIONS = [
    'Open application', 'Site Engineer', 'Project Architect',
    'Structural Designer', 'Construction Manager', 'Interior Designer'
  ];

  var select = document.getElementById('roleSelect');
  var label = document.getElementById('roleLabel');
  var form = document.getElementById('apForm');
  var card = document.getElementById('apCard');
  var done = document.getElementById('done');
  var scroller = document.getElementById('scroller');

  // A role arriving from the careers page may not be one of the known options
  // (hand-edited URL) — keep it selectable rather than silently dropping it.
  var requested = new URLSearchParams(location.search).get('role');
  var options = ROLE_OPTIONS.slice();
  if (requested && options.indexOf(requested) < 0) options.push(requested);

  options.forEach(function (name) {
    var o = document.createElement('option');
    o.value = o.textContent = name;
    select.appendChild(o);
  });

  var current = requested || 'Open application';
  select.value = current;
  label.textContent = current;

  select.addEventListener('change', function () { label.textContent = select.value; });

  /* ---------------- resume dropzone ---------------- */
  var zone = document.querySelector('.dropzone');
  var fileInput = zone.querySelector('input[type=file]');

  function showFile(file) {
    if (!file) return;
    zone.firstChild.textContent = file.name + ' — ';
  }
  fileInput.addEventListener('change', function () { showFile(fileInput.files[0]); });

  ['dragenter', 'dragover'].forEach(function (t) {
    zone.addEventListener(t, function (e) { e.preventDefault(); zone.classList.add('is-over'); });
  });
  ['dragleave', 'drop'].forEach(function (t) {
    zone.addEventListener(t, function () { zone.classList.remove('is-over'); });
  });
  zone.addEventListener('drop', function (e) {
    e.preventDefault();
    var file = e.dataTransfer.files[0];
    if (!file) return;
    fileInput.files = e.dataTransfer.files;
    showFile(file);
  });

  /* ---------------- submit ---------------- */
  // No backend in this build — the prototype's success state is the whole flow.
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    card.hidden = true;
    done.hidden = false;
    scroller.scrollTo({ top: 0, behavior: 'smooth' });
  });

  window.initWater(document.getElementById('water'), { mood: 'Tidal', tint: 'Violet' });
})();
