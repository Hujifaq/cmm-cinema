(() => {
  'use strict';

  // Showtimes filters: changing a filter fetches the same page and swaps in the new
  // screenings list, so the page does not jump back to the top. Without JS the form
  // still works through its normal GET submit.
  const root = document.querySelector('[data-showtimes]');
  if (!root) return;

  const form = root.querySelector('[data-booking-filters]');
  const status = root.querySelector('[data-booking-status]');
  const month = root.querySelector('[data-date-month]');
  const dates = root.querySelector('[data-date-options]');
  const scrollButtons = root.querySelectorAll('[data-date-scroll]');
  let pending;

  const screenings = () => root.querySelector('[data-screenings]');

  // The per-cinema format pickers mirror the hidden format filter in the form.
  function bindFormatMirrors() {
    root.querySelectorAll('[data-format-mirror]').forEach(select => {
      select.value = form.elements.format.value;
      select.addEventListener('change', () => {
        form.elements.format.value = select.value;
        update();
      });
    });
  }

  function updateScrollButtons() {
    const atStart = dates.scrollLeft <= 1;
    const atEnd = dates.scrollLeft + dates.clientWidth >= dates.scrollWidth - 1;
    scrollButtons.forEach(button => {
      button.disabled = Number(button.dataset.dateScroll) < 0 ? atStart : atEnd;
    });
  }

  async function update() {
    pending?.abort();
    const request = new AbortController();
    pending = request;

    const url = new URL(form.action);
    new FormData(form).forEach((value, key) => {
      if (value !== '') url.searchParams.set(key, value);
    });

    screenings().inert = true;
    root.setAttribute('aria-busy', 'true');
    status.textContent = 'Updating showtimes…';

    try {
      const response = await fetch(url, { signal: request.signal });
      if (!response.ok) throw new Error(`Showtimes request failed with ${response.status}`);

      const page = new DOMParser().parseFromString(await response.text(), 'text/html');
      screenings().replaceWith(page.querySelector('[data-screenings]'));
      month.textContent = page.querySelector('[data-date-month]').textContent;
      const stamp = root.querySelector('[data-date-stamp]');
      const nextStamp = page.querySelector('[data-date-stamp]');
      if (stamp && nextStamp) stamp.replaceChildren(...nextStamp.childNodes);
      bindFormatMirrors();

      history.replaceState(null, '', url);
      status.textContent = 'Showtimes updated.';
    } catch (error) {
      if (error.name === 'AbortError') return;
      console.error(error);
      status.textContent = 'Could not update showtimes. Change a filter to try again.';
    } finally {
      if (pending === request) {
        root.removeAttribute('aria-busy');
        screenings().inert = false;
      }
    }
  }

  root.dataset.enhanced = '';
  root.querySelectorAll('[data-auto-submit]').forEach(control => control.addEventListener('change', update));
  bindFormatMirrors();

  scrollButtons.forEach(button => button.addEventListener('click', () => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    dates.scrollBy({ left: Number(button.dataset.dateScroll) * 180, behavior: reduced ? 'auto' : 'smooth' });
  }));
  dates.addEventListener('scroll', updateScrollButtons, { passive: true });
  new ResizeObserver(updateScrollButtons).observe(dates);
})();
