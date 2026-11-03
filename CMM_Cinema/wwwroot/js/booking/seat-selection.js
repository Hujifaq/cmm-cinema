(() => {
  const form = document.querySelector('[data-seat-form]');
  if (!form) return;
  const selected = form.querySelector('[data-selected-seats]');
  const total = form.querySelector('[data-seat-total]');
  const submit = form.querySelector('[data-seat-submit]');
  const feedback = form.querySelector('[data-seat-feedback]');
  const max = Number(form.dataset.max) || 8;
  const price = Number(form.dataset.price) || 0;
  const seats = [...form.querySelectorAll('input[type="checkbox"]')];
  const priceFormatter = new Intl.NumberFormat('en-TH');
  function refresh() {
    const active = seats.filter(input => input.checked).map(input => input.value);
    selected.textContent = active.length ? active.join(', ') : 'None yet';
    total.textContent = `฿${priceFormatter.format(price * active.length)}`;
    feedback.textContent = active.length ? `${active.length} of ${max} seats selected.` : `Please select 1–${max} seats.`;
    submit.disabled = active.length < 1 || active.length > max;
    seats.forEach(input => { if (!input.checked && !input.hasAttribute('data-original-disabled')) input.disabled = active.length >= max; });
  }
  seats.forEach(input => {
    if (input.disabled) input.setAttribute('data-original-disabled', '');
    input.addEventListener('change', refresh);
  });
  refresh();
})();
