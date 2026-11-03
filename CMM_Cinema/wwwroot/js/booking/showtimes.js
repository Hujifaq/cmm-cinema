(() => {
  const root = document.querySelector('[data-showtimes]');
  if (!root) return;
  const form = root.querySelector('[data-booking-filters]');
  const status = root.querySelector('[data-booking-status]');
  let pending;
  function bind() {
    root.dataset.enhanced = '';
    root.querySelectorAll('[data-auto-submit]').forEach(control => control.addEventListener('change', update));
    root.querySelectorAll('[data-format-mirror]').forEach(control => control.addEventListener('change', () => {
      form.elements.format.value = control.value;
      update();
    }));
    const dates = root.querySelector('[data-date-options]');
    const buttons = root.querySelectorAll('[data-date-scroll]');
    function scrollState() {
      buttons.forEach(button => {
        button.disabled = Number(button.dataset.dateScroll) < 0 ? dates.scrollLeft <= 1 : dates.scrollLeft + dates.clientWidth >= dates.scrollWidth - 1;
      });
    }
    buttons.forEach(button => button.addEventListener('click', () => dates.scrollBy({left: Number(button.dataset.dateScroll) * 180, behavior: 'smooth'})));
    dates.addEventListener('scroll', scrollState, {passive:true});
    new ResizeObserver(scrollState).observe(dates);
    scrollState();
  }
  async function update() {
    pending?.abort();
    const request = new AbortController();
    pending = request;
    const url = new URL(form.action);
    new FormData(form).forEach((value, key) => { if (value !== '') url.searchParams.set(key, value); });
    root.querySelector('[data-screenings]').inert = true;
    root.setAttribute('aria-busy', 'true');
    status.textContent = 'Updating showtimes…';
    try {
      const response = await fetch(url, {signal:request.signal});
      if (!response.ok) throw new Error('Unable to load showtimes.');
      const page = new DOMParser().parseFromString(await response.text(), 'text/html');
      root.querySelector('[data-screenings]').innerHTML = page.querySelector('[data-screenings]').innerHTML;
      root.querySelector('.date-heading span').textContent = page.querySelector('.date-heading span').textContent;
      root.querySelectorAll('[data-format-mirror]').forEach(control => {
        control.value = form.elements.format.value;
        control.addEventListener('change', () => {form.elements.format.value = control.value; update();});
      });
      history.replaceState(null, '', url);
      status.textContent = 'Showtimes updated.';
    } catch (error) {
      if (error.name === 'AbortError') return;
      console.error('Booking filters:', error);
      status.textContent = 'Could not update showtimes. Please change a filter to retry.';
    } finally {
      if (!request.signal.aborted) {
        root.removeAttribute('aria-busy');
        root.querySelector('[data-screenings]').inert = false;
      }
    }
  }
  bind();
})();
