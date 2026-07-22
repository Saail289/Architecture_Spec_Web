(function () {
  'use strict';

  var form = document.getElementById('lgForm');
  var email = document.getElementById('lgEmail');
  var pass = document.getElementById('lgPass');
  var peek = document.getElementById('lgPeek');
  var note = document.getElementById('lgNote');

  /* ---------------- password reveal ---------------- */
  peek.addEventListener('click', function () {
    var shown = pass.type === 'text';
    pass.type = shown ? 'password' : 'text';
    peek.setAttribute('aria-pressed', String(!shown));
    peek.setAttribute('aria-label', shown ? 'Show password' : 'Hide password');
    pass.focus();
  });

  /* ---------------- validation ---------------- */
  function setErr(input, msg) {
    var slot = document.getElementById(input.id + 'Err');
    slot.textContent = msg || '';
    input.closest('.field').classList.toggle('is-bad', !!msg);
    return !msg;
  }

  function checkEmail() {
    var v = email.value.trim();
    if (!v) return setErr(email, 'Enter your email address.');
    // deliberately loose: real addresses are stranger than most regexes allow
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return setErr(email, 'That doesn’t look like a valid email.');
    return setErr(email, '');
  }

  function checkPass() {
    if (!pass.value) return setErr(pass, 'Enter your password.');
    return setErr(pass, '');
  }

  // only nag after the first submit, then correct live as they type
  var submitted = false;
  email.addEventListener('input', function () { if (submitted) checkEmail(); });
  pass.addEventListener('input', function () { if (submitted) checkPass(); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    submitted = true;
    var ok = checkEmail();
    ok = checkPass() && ok; // run both so all errors surface at once

    if (!ok) {
      note.textContent = '';
      form.querySelector('.is-bad input').focus();
      return;
    }

    // No backend exists. Say so plainly rather than faking a session.
    note.textContent = 'Preview only — this form has no backend, so nothing was submitted.';
  });
})();
