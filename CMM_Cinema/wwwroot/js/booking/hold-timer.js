(() => {
  const hold = document.querySelector('[data-expiry]');
  if (!hold) return;
  const until = Number(hold.dataset.expiry) * 1000;
  const output = hold.querySelector('[data-countdown]');
  function tick() {
    const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
    if (output) output.textContent = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
    if (!left) { hold.textContent = 'Your hold has expired. Please start a new booking.';
      document.querySelectorAll('.bk-primary').forEach(button => { if (button.tagName === 'BUTTON') button.disabled = true; else if (button.href?.includes('Payment')) { button.removeAttribute('href'); button.setAttribute('aria-disabled','true'); } });
      clearInterval(timer);
    }
  }
  const timer = setInterval(tick, 1000);
  tick();
})();
