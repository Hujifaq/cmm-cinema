(() => {
  'use strict';

  // Booking dropdowns: replaces a native <select data-custom-select> with a styled listbox that eases open, a cream
  // pill that slides to the active option, and options that rise in. The native select stays in the form (hidden) as
  // the source of truth, and a bubbling "change" event fires on pick, so existing handlers keep working.
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  // GSAP loads after the booking scripts, so it is looked up when an animation runs, not at start-up.
  const motion = () => (reduced.matches ? null : window.gsap || null);
  const NS = 'http://www.w3.org/2000/svg';
  let openSelect = null;
  let counter = 0;

  document.addEventListener('pointerdown', event => {
    if (openSelect && !openSelect.root.contains(event.target)) openSelect.close(false);
  });

  document.querySelectorAll('select[data-custom-select]').forEach(enhance);

  function icon(pathData, className) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('class', className);
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', pathData);
    svg.append(path);
    return svg;
  }

  function enhance(select) {
    const id = `bk-select-${++counter}`;
    const labelId = select.getAttribute('aria-labelledby');

    const root = document.createElement('div');
    root.className = 'bk-select';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'bk-select__trigger';
    trigger.id = `${id}-trigger`;
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', `${id}-list`);
    if (labelId) trigger.setAttribute('aria-labelledby', `${labelId} ${trigger.id}`);
    const label = document.createElement('span');
    label.className = 'bk-select__label';
    trigger.append(label, icon('m6 9 6 6 6-6', 'bk-select__chevron'));

    const panel = document.createElement('div');
    panel.className = 'bk-select__panel';
    panel.hidden = true;
    const pill = document.createElement('span');
    pill.className = 'bk-select__pill';
    pill.setAttribute('aria-hidden', 'true');
    const list = document.createElement('ul');
    list.className = 'bk-select__list';
    list.id = `${id}-list`;
    list.tabIndex = -1;
    list.setAttribute('role', 'listbox');
    if (labelId) list.setAttribute('aria-labelledby', labelId);

    const options = [...select.options].map((source, index) => {
      const item = document.createElement('li');
      item.className = 'bk-select__option';
      item.id = `${id}-opt-${index}`;
      item.setAttribute('role', 'option');
      item.dataset.value = source.value;
      item.dataset.label = source.text;
      const text = document.createElement('span');
      text.textContent = source.text;
      item.append(text, icon('M5 12.5 10 17.5 19 7.5', 'bk-select__check'));
      list.append(item);
      return item;
    });
    panel.append(pill, list);
    root.append(trigger, panel);

    select.after(root);
    select.classList.add('bk-select__native');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');

    let active = -1;
    let timeline = null;
    let typed = '';
    let typedAt = 0;

    const selectedIndex = () => Math.max(0, options.findIndex(option => option.dataset.value === select.value));
    const field = { root, close, isOpen: () => trigger.getAttribute('aria-expanded') === 'true' };

    function paintSelection() {
      const current = selectedIndex();
      options.forEach((option, index) => option.setAttribute('aria-selected', String(index === current)));
      label.textContent = options[current].dataset.label;
    }
    paintSelection();

    trigger.addEventListener('click', () => (field.isOpen() ? close(true) : open()));
    trigger.addEventListener('keydown', event => {
      if (!['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      open(event.key === 'ArrowUp' ? options.length - 1 : undefined);
    });
    list.addEventListener('keydown', onKey);
    list.addEventListener('focusout', event => {
      if (!root.contains(event.relatedTarget)) close(false);
    });
    options.forEach((option, index) => {
      option.addEventListener('pointermove', () => { if (index !== active) setActive(index); });
      option.addEventListener('click', () => choose(index));
    });
    // Back/forward or autofill can change the native value without a pick.
    select.addEventListener('change', paintSelection);

    function open(start) {
      if (openSelect && openSelect !== field) openSelect.close(false);
      openSelect = field;
      panel.hidden = false;

      const box = trigger.getBoundingClientRect();
      const below = window.innerHeight - box.bottom;
      const up = below < panel.offsetHeight + 16 && box.top > below;
      panel.dataset.dir = up ? 'up' : 'down';
      trigger.setAttribute('aria-expanded', 'true');
      root.setAttribute('data-open', '');
      list.focus({ preventScroll: true });
      setActive(start ?? selectedIndex(), true);

      const gsap = motion();
      if (!gsap) return;
      const dir = up ? 1 : -1;
      timeline?.kill();
      timeline = gsap.timeline()
        .fromTo(panel,
          { opacity: 0, scaleY: 0.86, scaleX: 0.97, y: dir * -8, transformOrigin: `50% ${up ? '100%' : '0%'}` },
          { opacity: 1, scaleY: 1, scaleX: 1, y: 0, duration: 0.5, ease: 'back.out(1.5)', clearProps: 'transform,opacity' }, 0)
        .fromTo(options,
          { opacity: 0, y: dir * -10 },
          { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out', stagger: 0.04, clearProps: 'transform,opacity' }, 0.06);
    }

    function close(focusTrigger) {
      if (!field.isOpen()) return;
      trigger.setAttribute('aria-expanded', 'false');
      root.removeAttribute('data-open');
      if (openSelect === field) openSelect = null;
      if (focusTrigger) trigger.focus({ preventScroll: true });

      const done = () => {
        panel.hidden = true;
        options[active]?.removeAttribute('data-active');
        list.removeAttribute('aria-activedescendant');
        active = -1;
      };
      const gsap = motion();
      if (!gsap) return done();

      const up = panel.dataset.dir === 'up';
      timeline?.kill();
      timeline = gsap.timeline({ onComplete: () => { gsap.set(panel, { clearProps: 'all' }); done(); } })
        .to(panel, { opacity: 0, scaleY: 0.92, y: up ? 6 : -6, transformOrigin: `50% ${up ? '100%' : '0%'}`, duration: 0.2, ease: 'power2.in' }, 0);
    }

    function setActive(index, instant) {
      index = Math.max(0, Math.min(options.length - 1, index));
      options[active]?.removeAttribute('data-active');
      active = index;
      const option = options[index];
      option.setAttribute('data-active', '');
      list.setAttribute('aria-activedescendant', option.id);

      const y = option.offsetTop;
      const height = option.offsetHeight;
      const gsap = motion();
      if (!gsap) {
        pill.style.transform = `translateY(${y}px)`;
        pill.style.height = `${height}px`;
        pill.style.opacity = '1';
        return;
      }
      if (instant) {
        gsap.set(pill, { y, height });
        gsap.fromTo(pill, { opacity: 0, scaleX: 0.7 }, { opacity: 1, scaleX: 1, duration: 0.6, delay: 0.12, ease: 'elastic.out(1, 0.55)' });
        return;
      }
      gsap.to(pill, { y, height, duration: 0.5, ease: 'elastic.out(1, 0.75)', overwrite: 'auto' });
    }

    function choose(index) {
      const option = options[index];
      if (!option) return;
      const changed = select.value !== option.dataset.value;
      select.value = option.dataset.value;
      paintSelection();
      if (changed) swapLabel(option.dataset.label);
      close(true);
      if (changed) select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function swapLabel(text) {
      const gsap = motion();
      if (!gsap) return;
      gsap.timeline()
        .to(label, { yPercent: -110, opacity: 0, duration: 0.16, ease: 'power2.in' })
        .add(() => { label.textContent = text; })
        .fromTo(label, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.45, ease: 'back.out(2.2)', clearProps: 'transform,opacity' });
    }

    function onKey(event) {
      const key = event.key;
      // A space typed mid-search ("cmm s") belongs to the search; on its own it picks the active option.
      const searching = typed !== '' && Date.now() - typedAt < 600;
      if (key === 'ArrowDown') setActive(active + 1);
      else if (key === 'ArrowUp') setActive(active - 1);
      else if (key === 'Home') setActive(0);
      else if (key === 'End') setActive(options.length - 1);
      else if (key === 'Enter' || (key === ' ' && !searching)) choose(active);
      else if (key === 'Escape') close(true);
      else if (key === 'Tab') { close(false); return; }
      else if (key.length === 1 && (/\S/.test(key) || searching)) {
        const now = Date.now();
        typed = now - typedAt > 600 ? key : typed + key;
        typedAt = now;
        const match = options.findIndex(option => option.dataset.label.toLowerCase().startsWith(typed.toLowerCase()));
        if (match >= 0) setActive(match);
      } else return;
      event.preventDefault();
    }
  }
})();
