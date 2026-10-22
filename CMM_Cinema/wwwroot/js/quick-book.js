(() => {
  'use strict';
  // Quick Book listboxes: a gooey blob opens each menu, a cream pill with
  // lagging droplets tracks the active option, and the label swaps on pick.
  const form = document.querySelector('[data-qb-form]');
  if (!form) return;

  const gsap = window.gsap;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const animated = () => Boolean(gsap) && !reduced.matches;
  const fields = [...form.querySelectorAll('[data-qb-select]')].map(createField);
  let openField = null;

  document.addEventListener('pointerdown', event => {
    if (openField && !openField.root.contains(event.target)) openField.close(false);
  });

  function createField(root) {
    const trigger = root.querySelector('[data-qb-trigger]');
    const label = root.querySelector('[data-qb-label]');
    const input = root.querySelector('[data-qb-value]');
    const panel = root.querySelector('[data-qb-panel]');
    const blob = panel.querySelector('[data-qb-blob]');
    const drops = panel.querySelectorAll('[data-qb-drop]');
    const sheen = panel.querySelector('[data-qb-sheen]');
    const list = panel.querySelector('[role="listbox"]');
    const options = [...list.querySelectorAll('[role="option"]')];
    const pillLayer = panel.querySelector('[data-qb-pill-layer]');
    const pill = panel.querySelector('[data-qb-pill]');
    const tails = panel.querySelectorAll('[data-qb-tail]');
    let active = -1;
    let timeline = null;
    let typed = '';
    let typedAt = 0;

    const field = {
      root,
      trigger,
      close,
      get value() { return input.value; },
      isOpen: () => trigger.getAttribute('aria-expanded') === 'true'
    };

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

    function open(start) {
      if (openField && openField !== field) openField.close(false);
      openField = field;
      panel.hidden = false;

      const box = trigger.getBoundingClientRect();
      const below = window.innerHeight - box.bottom;
      const up = below < panel.offsetHeight + 16 && box.top > below;
      panel.dataset.dir = up ? 'up' : 'down';
      trigger.setAttribute('aria-expanded', 'true');
      root.setAttribute('data-open', '');
      list.focus({ preventScroll: true });

      const selected = options.findIndex(option => option.getAttribute('aria-selected') === 'true');
      setActive(start ?? (selected >= 0 ? selected : 0), true);
      if (!animated()) return;

      const dir = up ? 1 : -1;
      timeline?.kill();
      gsap.set(drops, { top: up ? 'auto' : 0, bottom: up ? 0 : 'auto' });
      timeline = gsap.timeline()
        .fromTo(blob,
          { scaleX: 0.5, scaleY: 0.06, transformOrigin: `50% ${up ? '100%' : '0%'}` },
          { scaleX: 1, scaleY: 1, duration: 0.85, ease: 'elastic.out(1, 0.55)' }, 0)
        .fromTo(drops,
          { y: 0, scale: 1 },
          { y: i => -dir * panel.offsetHeight * (0.55 + i * 0.3), scale: 0, duration: 0.7, ease: 'power2.out', stagger: 0.07 }, 0)
        .fromTo(sheen, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power1.out' }, 0.3)
        .fromTo(options,
          { opacity: 0, y: dir * 10, filter: 'blur(6px)' },
          { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.45, ease: 'power3.out', stagger: 0.035, clearProps: 'filter' }, 0.12);
    }

    function close(focusTrigger) {
      if (!field.isOpen()) return;
      trigger.setAttribute('aria-expanded', 'false');
      root.removeAttribute('data-open');
      if (openField === field) openField = null;
      if (focusTrigger) trigger.focus({ preventScroll: true });

      const done = () => {
        panel.hidden = true;
        options[active]?.removeAttribute('data-active');
        list.removeAttribute('aria-activedescendant');
        active = -1;
        pillLayer.style.opacity = '0';
      };
      if (!animated()) return done();

      const up = panel.dataset.dir === 'up';
      timeline?.kill();
      timeline = gsap.timeline({ onComplete: done })
        .to(options, { opacity: 0, y: up ? 6 : -6, duration: 0.15, ease: 'power1.in', stagger: { each: 0.015, from: 'end' } }, 0)
        .to([pillLayer, sheen], { opacity: 0, duration: 0.15 }, 0)
        .to(blob, { scaleX: 0.6, scaleY: 0.04, duration: 0.3, ease: 'power3.in' }, 0.05);
    }

    function setActive(index, instant) {
      index = Math.max(0, Math.min(options.length - 1, index));
      options[active]?.removeAttribute('data-active');
      active = index;
      const option = options[index];
      option.setAttribute('data-active', '');
      list.setAttribute('aria-activedescendant', option.id);

      const y = option.offsetTop;
      const h = option.offsetHeight;
      const tailY = tail => y + (h - tail.offsetHeight) / 2;
      if (!animated()) {
        pillLayer.style.opacity = '1';
        pill.style.transform = `translateY(${y}px)`;
        tails.forEach(tail => { tail.style.transform = `translateY(${tailY(tail)}px)`; });
        return;
      }
      if (instant) {
        gsap.set(pill, { y, height: h });
        tails.forEach(tail => gsap.set(tail, { y: tailY(tail) }));
        gsap.fromTo(pillLayer, { opacity: 0 }, { opacity: 1, duration: 0.3, delay: 0.2 });
        gsap.fromTo(pill, { scaleX: 0.4 }, { scaleX: 1, duration: 0.9, delay: 0.2, ease: 'elastic.out(1, 0.5)' });
        return;
      }
      gsap.to(pill, { y, height: h, duration: 0.55, ease: 'elastic.out(1, 0.75)', overwrite: 'auto' });
      tails.forEach((tail, k) => gsap.to(tail, { y: tailY(tail), duration: 0.5 + k * 0.18, ease: 'power3.out', overwrite: 'auto' }));
    }

    function choose(index) {
      const option = options[index];
      if (!option) return;
      options.forEach(item => item.setAttribute('aria-selected', String(item === option)));
      input.value = option.dataset.value;
      root.setAttribute('data-filled', '');
      swapLabel(option.dataset.label);
      close(true);
    }

    function swapLabel(text) {
      if (!animated()) { label.textContent = text; return; }
      gsap.timeline()
        .to(label, { yPercent: -110, opacity: 0, duration: 0.18, ease: 'power2.in' })
        .add(() => { label.textContent = text; })
        .fromTo(label, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.5, ease: 'back.out(2.2)' });
    }

    function onKey(event) {
      const key = event.key;
      if (key === 'ArrowDown') setActive(active + 1);
      else if (key === 'ArrowUp') setActive(active - 1);
      else if (key === 'Home') setActive(0);
      else if (key === 'End') setActive(options.length - 1);
      else if (key === 'Enter' || key === ' ') choose(active);
      else if (key === 'Escape') close(true);
      else if (key === 'Tab') { close(false); return; }
      else if (key.length === 1 && /\S/.test(key)) {
        const now = Date.now();
        typed = now - typedAt > 600 ? key : typed + key;
        typedAt = now;
        const match = options.findIndex(option => option.dataset.label.toLowerCase().startsWith(typed.toLowerCase()));
        if (match >= 0) setActive(match);
      } else return;
      event.preventDefault();
    }

    return field;
  }

  // Submit button: the arrow's ink circle floods the cream pill,
  // while the whole button leans toward the pointer.
  const submit = form.querySelector('[data-qb-submit]');
  const ink = submit.querySelector('[data-qb-ink]');
  const icon = submit.querySelector('[data-qb-submit-icon]');
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  let flood = null;

  const fill = () => {
    if (!animated()) return;
    const width = submit.offsetWidth;
    flood?.kill();
    flood = gsap.timeline()
      .to(ink, { scale: (width * 2.3) / ink.offsetWidth, duration: 0.6, ease: 'power3.inOut' }, 0)
      .to(form.querySelector('[data-qb-submit-label]'), { color: '#fffde6', duration: 0.25 }, 0.18)
      .to(icon, { rotate: -45, duration: 0.5, ease: 'back.out(3)' }, 0);
  };
  const drain = () => {
    if (!animated()) return;
    flood?.kill();
    flood = gsap.timeline()
      .to(ink, { scale: 1, duration: 0.55, ease: 'power3.inOut' }, 0)
      .to(form.querySelector('[data-qb-submit-label]'), { color: '#071c1e', duration: 0.25 }, 0.15)
      .to(icon, { rotate: 0, duration: 0.5, ease: 'back.out(3)' }, 0.1);
  };

  const leanX = gsap?.quickTo(submit, 'x', { duration: 0.5, ease: 'power3.out' });
  const leanY = gsap?.quickTo(submit, 'y', { duration: 0.5, ease: 'power3.out' });
  const iconX = gsap?.quickTo(icon, 'x', { duration: 0.4, ease: 'power3.out' });
  const iconY = gsap?.quickTo(icon, 'y', { duration: 0.4, ease: 'power3.out' });

  submit.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') fill(); });
  submit.addEventListener('pointerleave', event => {
    if (event.pointerType === 'mouse') drain();
    if (leanX) { leanX(0); leanY(0); iconX(0); iconY(0); }
  });
  submit.addEventListener('pointermove', event => {
    if (!leanX || !fine.matches || reduced.matches) return;
    const box = submit.getBoundingClientRect();
    const dx = (event.clientX - box.left) / box.width - 0.5;
    const dy = (event.clientY - box.top) / box.height - 0.5;
    leanX(dx * 10); leanY(dy * 6); iconX(dx * 8); iconY(dy * 8);
  });
  submit.addEventListener('focus', () => { if (submit.matches(':focus-visible')) fill(); });
  submit.addEventListener('blur', () => { if (!submit.matches(':hover')) drain(); });
  submit.addEventListener('pointerdown', () => { if (animated()) gsap.to(submit, { scale: 0.95, duration: 0.15, ease: 'power2.out' }); });
  const release = () => { if (animated()) gsap.to(submit, { scale: 1, duration: 0.7, ease: 'elastic.out(1.2, 0.4)' }); };
  submit.addEventListener('pointerup', release);
  submit.addEventListener('pointercancel', release);

  // Demo submit: wobble whatever is missing, otherwise send the arrow off.
  const submitLabel = form.querySelector('[data-qb-submit-label]');
  const arrow = form.querySelector('[data-qb-submit-arrow]');
  const status = form.querySelector('[data-qb-status]');
  const idleText = submitLabel.textContent;
  let resetTimer = 0;

  form.addEventListener('submit', event => {
    event.preventDefault();
    const missing = fields.filter(field => !field.value);
    if (missing.length) {
      status.textContent = 'Choose a cinema and a date first.';
      missing.forEach(field => {
        if (animated()) gsap.fromTo(field.trigger, { x: 0 }, { keyframes: { x: [-8, 7, -5, 3, 0] }, duration: 0.45, ease: 'power1.out' });
      });
      missing[0].trigger.focus();
      return;
    }

    status.textContent = 'Demo only: showtimes are coming soon.';
    clearTimeout(resetTimer);
    if (!animated()) { submitLabel.textContent = 'Coming soon'; }
    else {
      gsap.timeline()
        .to(arrow, { x: 28, opacity: 0, duration: 0.25, ease: 'power2.in' })
        .to(submitLabel, { yPercent: -120, opacity: 0, duration: 0.18 }, 0)
        .add(() => { submitLabel.textContent = 'Coming soon'; })
        .fromTo(submitLabel, { yPercent: 120 }, { yPercent: 0, opacity: 1, duration: 0.45, ease: 'back.out(2)' })
        .fromTo(arrow, { x: -28 }, { x: 0, opacity: 1, duration: 0.45, ease: 'back.out(2)' }, '<');
    }
    resetTimer = setTimeout(() => {
      submitLabel.textContent = idleText;
      status.textContent = '';
    }, 1800);
  });
})();
