(() => {
  'use strict';

  // Seat map: keeps the selected list, total and submit button in sync, and stops
  // more than the allowed number of seats being picked.
  const form = document.querySelector('[data-seat-form]');
  if (!form) return;

  const selectedText = form.querySelector('[data-selected-seats]');
  const totalText = form.querySelector('[data-seat-total]');
  const feedback = form.querySelector('[data-seat-feedback]');
  const submit = form.querySelector('[data-seat-submit]');
  const max = Number(form.dataset.max) || 8;
  const price = Number(form.dataset.price) || 0;
  const baht = new Intl.NumberFormat('en-TH');

  const seats = [...form.querySelectorAll('input[name="seatIds"]')];
  const openSeats = seats.filter(seat => !seat.disabled);

  function refresh() {
    const chosen = seats.filter(seat => seat.checked).map(seat => seat.value);
    const full = chosen.length >= max;

    selectedText.textContent = chosen.length ? chosen.join(', ') : 'None yet';
    totalText.textContent = `฿${baht.format(price * chosen.length)}`;
    feedback.textContent = chosen.length
      ? `${chosen.length} of ${max} seats selected.`
      : `Please select 1–${max} seats.`;
    submit.disabled = chosen.length === 0;

    openSeats.forEach(seat => {
      if (!seat.checked) seat.disabled = full;
    });
  }

  seats.forEach(seat => seat.addEventListener('change', refresh));
  refresh();
})();
