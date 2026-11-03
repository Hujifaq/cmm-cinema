(() => {
  'use strict';

  const mount = nav => {
    const toggle = nav.querySelector('[data-nav-toggle]');
    const panel = nav.querySelector('[data-mobile-menu]');
    const content = nav.querySelector('[data-mobile-menu-content]');
    const stage = nav.querySelector('[data-gooey-nav]');
    const rows = [...panel.querySelectorAll('[data-mobile-index]')];
    const labels = [...panel.querySelectorAll('[data-menu-label]')];
    const layers = [...panel.querySelectorAll('[data-menu-layer]')];
    const surfaces = [...layers, content];
    const desktopButtons = [...stage.querySelectorAll('button')];
    const mobile = window.matchMedia('(max-width: 767px)');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const gsap = window.gsap;
    let open = false;
    let animation;
    let disposed = false;

    const alignPanel = () => {
      if (!mobile.matches || panel.hidden) return;
      panel.style.setProperty('--nav-viewport-top', `${nav.getBoundingClientRect().top}px`);
    };
    const stop = () => { animation?.kill(); animation = null; };
    const clearSurface = () => {
      if (gsap) {
        gsap.set(surfaces, { clearProps: 'transform,borderRadius' });
        gsap.set(labels, { clearProps: 'transform' });
      } else {
        surfaces.forEach(surface => {
          surface.style.removeProperty('transform');
          surface.style.removeProperty('border-radius');
        });
        labels.forEach(label => label.style.removeProperty('transform'));
      }
    };
    const reset = () => {
      stop();
      open = false;
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
      panel.hidden = true;
      panel.inert = true;
      clearSurface();
      delete nav.dataset.menuOpen;
    };
    const setOpen = (next, { immediate = false, restoreFocus = false } = {}) => {
      next = Boolean(next && mobile.matches);
      if (next === open && !immediate) return;
      stop();
      open = next;
      if (restoreFocus && mobile.matches) toggle.focus({ preventScroll: true });
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      nav.toggleAttribute('data-menu-open', open);

      if (immediate || motion.matches || !gsap || document.hidden) {
        panel.hidden = !open;
        panel.inert = !open;
        alignPanel();
        clearSurface();
        return;
      }

      if (open && panel.hidden) {
        panel.hidden = false;
        // Rounded color sheets arrive first; labels rise through their own masks.
        gsap.set(surfaces, { xPercent: 100, scaleX: 0.82, borderRadius: '50% 0px 0px 50%' });
        gsap.set(labels, { yPercent: 140, rotation: 8 });
      }
      panel.inert = !open;
      alignPanel();
    
      animation = gsap.timeline({ onComplete: () => {
        if (!open) panel.hidden = true;
        clearSurface();
        animation = null;
      } });
      animation
        .to(open ? surfaces : [...surfaces].reverse(), {
          xPercent: open ? 0 : 100, scaleX: open ? 1 : 0.82,
          borderRadius: open ? '32px 0px 0px 32px' : '50% 0px 0px 50%',
          duration: open ? 0.7 : 0.38, stagger: open ? 0.075 : 0.045,
          ease: open ? 'power4.out' : 'power3.inOut' }, 0)
        .to(labels, { yPercent: open ? 0 : 140, rotation: open ? 0 : 8,
          duration: open ? 0.72 : 0.22, stagger: open ? 0.085 : 0.025,
          ease: open ? 'power4.out' : 'power2.in' }, open ? 0.3 : 0);
    };
    const synchronize = index => {
      rows.forEach((row, i) => row.setAttribute('aria-pressed', String(index === i)));
      desktopButtons.forEach((button, i) => button.setAttribute('aria-pressed', String(index === i)));
    };
    const onToggle = () => setOpen(!open);
    const onSelect = event => {
      const row = event.target.closest('[data-mobile-index]');
      if (!row || !panel.contains(row)) return;
      const index = Number(row.dataset.mobileIndex);
      synchronize(index);
      stage.dispatchEvent(new CustomEvent('cinema:select', { detail: { index } }));
      setOpen(false, { restoreFocus: true });
    };
    const onSelection = event => synchronize(event.detail.index);
    const onOutside = event => { if (open && !nav.contains(event.target)) setOpen(false); };
    const onKey = event => {
      if (event.key === 'Escape' && open) {
        event.preventDefault();
        setOpen(false, { restoreFocus: true });
      }
    };
    const onNavKey = event => {
      if (!mobile.matches) return;
      if (event.target === toggle && event.key === 'ArrowDown') {
        event.preventDefault();
        setOpen(true, { immediate: true });
        rows[0].focus();
        return;
      }
      const index = rows.indexOf(event.target.closest('[data-mobile-index]'));
      if (index < 0 || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
      animation?.progress(1);
      rows[next].focus();
    };
    const onFocusOut = () => queueMicrotask(() => {
      if (!disposed && open && !nav.contains(document.activeElement)) setOpen(false);
    });
    const onBreakpoint = () => {
      if (!mobile.matches && (panel.contains(document.activeElement) || document.activeElement === toggle)) {
        desktopButtons[rows.findIndex(row => row.getAttribute('aria-pressed') === 'true')]?.focus();
      } else if (mobile.matches && stage.contains(document.activeElement)) {
        toggle.focus({ preventScroll: true });
      }
      reset();
    };
    const onMotion = () => setOpen(open, { immediate: true });
    const onHidden = () => {
      if (document.hidden) setOpen(open, { immediate: true });
    };
    reset();
    nav.dataset.mobileReady = '';
    toggle.addEventListener('click', onToggle);
    panel.addEventListener('click', onSelect);
    stage.addEventListener('cinema:selection', onSelection);
    nav.addEventListener('keydown', onNavKey);
    nav.addEventListener('focusout', onFocusOut);
    document.addEventListener('pointerdown', onOutside);
    document.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onHidden);
    mobile.addEventListener('change', onBreakpoint);
    motion.addEventListener('change', onMotion);
    window.addEventListener('scroll', alignPanel, { passive: true });
    window.addEventListener('resize', alignPanel);

    return () => {
      disposed = true;
      reset();
      toggle.removeEventListener('click', onToggle);
      panel.removeEventListener('click', onSelect);
      stage.removeEventListener('cinema:selection', onSelection);
      nav.removeEventListener('keydown', onNavKey);
      nav.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('pointerdown', onOutside);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onHidden);
      mobile.removeEventListener('change', onBreakpoint);
      motion.removeEventListener('change', onMotion);
      window.removeEventListener('scroll', alignPanel);
      window.removeEventListener('resize', alignPanel);
      delete nav.dataset.mobileReady;
    };
  };

  let cleanups = [];
  const initialize = () => {
    cleanups = [...document.querySelectorAll('[data-cinema-nav]')].map(mount);
  };
  initialize();
  window.addEventListener('pagehide', () => { cleanups.forEach(cleanup => cleanup()); cleanups = []; });
  window.addEventListener('pageshow', event => { if (event.persisted) initialize(); });
})();
