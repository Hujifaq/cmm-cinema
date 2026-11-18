(() => {
  'use strict';

  // Confirm booking: cover the summary page with the popcorn loader and cycle its lines,
  // then post the form once the loader has had time to be seen. No page transition runs.
  const loader = document.querySelector('[data-booking-loader]');
  const form = document.querySelector('[data-loader-form]');
  if (!loader || !form) return;

  const MIN_VISIBLE_MS = 2200;
  const LINE_MS = 1400;
  const lines = [...loader.querySelectorAll('[data-loader-line]')];
  const status = loader.querySelector('[data-loader-status]');
  let active = false;
  let cycle = 0;
  let submitTimer = 0;

  function showLine(index) {
    const leaving = (index - 1 + lines.length) % lines.length;
    lines.forEach((line, i) => {
      line.dataset.state = i === index ? 'active' : i === leaving && line.dataset.state === 'active' ? 'leaving' : '';
    });
  }

  function open() {
    active = true;
    loader.hidden = false;
    document.documentElement.classList.add('bk-loader-open');
    requestAnimationFrame(() => loader.setAttribute('data-open', ''));
    if (status) status.textContent = 'Confirming your booking. Please wait.';

    let index = 0;
    showLine(index);
    cycle = window.setInterval(() => showLine(index = (index + 1) % lines.length), LINE_MS);
  }

  function reset() {
    active = false;
    window.clearInterval(cycle);
    window.clearTimeout(submitTimer);
    loader.removeAttribute('data-open');
    loader.hidden = true;
    document.documentElement.classList.remove('bk-loader-open');
    lines.forEach(line => { line.dataset.state = ''; });
    if (status) status.textContent = '';
  }

  form.addEventListener('submit', event => {
    if (event.defaultPrevented) return;
    event.preventDefault();
    if (active) return;
    open();
    submitTimer = window.setTimeout(() => HTMLFormElement.prototype.submit.call(form), MIN_VISIBLE_MS);
  });

  // Leaving with the loader up (to Confirmation, or back to Summary on an error) skips any cross-document transition.
  window.addEventListener('pageswap', event => {
    if (active) event.viewTransition?.skipTransition();
  });

  // Coming back through the history cache must not show a stuck loader.
  window.addEventListener('pageshow', event => {
    if (event.persisted) reset();
  });
})();
