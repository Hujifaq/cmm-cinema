(() => {
  'use strict';

  // Results that stay on the same page update in place; only a real move to another page navigates (and plays the transition).
  document.querySelectorAll('form[data-ajax-form]').forEach(form => {
    const status = form.querySelector('[data-form-status]');
    const submit = form.querySelector('[type="submit"]');
    const show = (message, tone) => {
      if (!status) return;
      status.dataset.tone = tone;
      status.textContent = message;
      status.hidden = false;
    };

    form.addEventListener('submit', async event => {
      if (event.defaultPrevented || !window.fetch) return;
      event.preventDefault();
      if (submit) submit.disabled = true;
      try {
        const response = await fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          headers: { Accept: 'application/json' },
          credentials: 'same-origin'
        });
        const data = response.headers.get('content-type')?.includes('json') ? await response.json() : null;
        if (response.ok && data?.redirect) return window.location.assign(data.redirect);
        if (response.ok && data?.message) show(data.message, 'success');
        else show(data?.errors?.join(' ') || (response.status === 429
          ? 'Too many attempts. Please wait a few minutes and try again.'
          : 'Something went wrong. Please refresh the page and try again.'), 'error');
      } catch {
        show('Could not reach the server. Check your connection and try again.', 'error');
      }
      if (submit) submit.disabled = false;
      // Turnstile tokens are single-use, so each retry needs a fresh one.
      const widget = form.querySelector('.cf-turnstile');
      if (widget) window.turnstile?.reset(widget);
    });
  });
})();
