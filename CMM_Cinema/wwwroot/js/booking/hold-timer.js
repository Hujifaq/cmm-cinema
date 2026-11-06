(() => {
  'use strict';

  // Seat hold countdown on the summary page. When it reaches zero the
  // continue buttons are disabled; the server rejects the expired hold either way.
  const hold = document.querySelector('[data-hold-expiry]');
  if (!hold) return;

  const expiresAt = Number(hold.dataset.holdExpiry) * 1000;
  const countdown = hold.querySelector('[data-countdown]');
  const pad = value => String(value).padStart(2, '0');

  function expire() {
    hold.textContent = 'Your hold has expired. Please start a new booking.';
    document.querySelectorAll('[data-hold-action]').forEach(action => {
      if (action.tagName === 'BUTTON') {
        action.disabled = true;
      } else {
        action.removeAttribute('href');
        action.setAttribute('aria-disabled', 'true');
      }
    });
  }

  function tick() {
    const secondsLeft = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
    countdown.textContent = `${pad(Math.floor(secondsLeft / 60))}:${pad(secondsLeft % 60)}`;
    if (secondsLeft === 0) {
      clearInterval(timer);
      expire();
    }
  }

  const timer = setInterval(tick, 1000);
  tick();
})();
