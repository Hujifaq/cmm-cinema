(() => {
  const form = document.querySelector('[data-payment-form]');
  if (!form) return;
  const description = form.querySelector('[data-payment-description]');
  form.querySelectorAll('input[name="paymentMethod"]').forEach(input => input.addEventListener('change', () => {
    description.textContent = input.value === 'promptpay'
      ? 'PromptPay demo selected. No real QR transfer is required. Confirm to complete a simulated payment.'
      : 'Card demo selected. No card details are collected. Confirm to complete a simulated payment.';
  }));
  form.addEventListener('submit', () => {
    const button = form.querySelector('button[type="submit"]');
    if (button) { button.disabled = true; button.textContent = 'Confirming demo booking…'; }
  });
})();
