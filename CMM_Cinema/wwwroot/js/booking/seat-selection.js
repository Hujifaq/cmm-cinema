(() => {
  'use strict';

  // Seat map: keeps the selected list, total and submit button in sync, and stops
  // more than the allowed number of seats being picked.
  const form = document.querySelector('[data-seat-form]');
  if (!form) return;

  const layout = form.closest('[data-seat-selection]') || form;
  const selectedText = layout.querySelector('[data-selected-seats]');
  const totalText = layout.querySelector('[data-seat-total]');
  const feedback = form.querySelector('[data-seat-feedback]');
  const submit = layout.querySelector('[data-seat-submit]');
  const max = Number(form.dataset.max) || 8;
  const capacity = seat => Number(seat.dataset.seatCapacity) || 1;
  const price = seat => Number(seat.dataset.seatPrice ?? form.dataset.price) || 0;
  const description = seat => `Row ${seat.dataset.seatRow} · ${capacity(seat) === 2 ? 'Pair' : 'Seat'} ${seat.dataset.seatNumber} · ${seat.dataset.seatType || 'Normal'}`;
  const baht = new Intl.NumberFormat('en-TH');

  const seats = [...form.querySelectorAll('input[name="seatIds"]')];
  const openSeats = seats.filter(seat => !seat.disabled);

  function refresh() {
    const chosen = seats.filter(seat => seat.checked);
    const admissions = chosen.reduce((total, seat) => total + capacity(seat), 0);
    const remaining = max - admissions;

    selectedText.textContent = chosen.length ? chosen.map(seat => seat.value).join(', ') : 'None yet';
    totalText.textContent = `฿${baht.format(chosen.reduce((total, seat) => total + price(seat), 0))}`;
    feedback.textContent = chosen.length
      ? `${chosen.map(description).join("; ")}. ${admissions} of ${max} admissions selected.`
      : `Please select up to ${max} admissions. Each VIP pair counts as 2 seats.`;
    submit.disabled = chosen.length === 0;

    openSeats.forEach(seat => {
      if (!seat.checked) seat.disabled = capacity(seat) > remaining;
    });
  }

  seats.forEach(seat => seat.addEventListener('change', refresh));
  refresh();
})();
