(() => {
  'use strict';

  // Demo payment: describes the chosen method and stops a double submit.
  const form = document.querySelector('[data-payment-form]');
  if (!form) return;

  const description = form.querySelector('[data-payment-description]');
  const messages = {
    card: 'Card selected. Tap confirm to simulate a successful payment. No card details will be collected.',
    promptpay: 'PromptPay selected. No real QR transfer is needed. Tap confirm to simulate a successful payment.',
  };

  form.querySelectorAll('input[name="paymentMethod"]').forEach(input => {
    input.addEventListener('change', () => {
      description.textContent = messages[input.value];
    });
  });

  form.addEventListener('submit', () => {
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Confirming demo booking…';
  });
})();
