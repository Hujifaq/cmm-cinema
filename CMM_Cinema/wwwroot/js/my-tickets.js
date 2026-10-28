(() => {
  'use strict';
  const root = document.querySelector('[data-tickets-page]');
  if (!root) return;

  const { gsap, SplitText } = window;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const animate = Boolean(gsap) && !reduced.matches;
  const tabs = [...root.querySelectorAll('[data-tickets-tab]')];
  const panels = [...root.querySelectorAll('[data-tickets-panel]')];
  const show = () => root.setAttribute('data-revealed', '');
  const cardsIn = panel => [...panel.querySelectorAll('[data-ticket-card]')];

  // Each ticket slides up, its poster wipes in from the bottom, then the stub tears into place and the button pops.
  // Shared by the page reveal and by tab switches so every card opens the same way.
  const enter = (tl, cards, start) => cards.forEach((card, i) => {
    const at = start + i * 0.1;
    const poster = card.querySelector('[data-ticket-poster]');
    const stub = card.querySelector('[data-ticket-stub]');
    const button = card.querySelector('[data-goo-button]');
    gsap.killTweensOf([card, poster, stub, button].filter(Boolean));
    tl.fromTo(card, { y: 48, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, ease: 'power3.out', clearProps: 'transform,opacity,visibility', immediateRender: true }, at);
    if (poster) tl.fromTo(poster, { clipPath: 'inset(100% 0% 0% 0% round 16px)' }, { clipPath: 'inset(0% 0% 0% 0% round 16px)', duration: 1, ease: 'expo.out', clearProps: 'clipPath', immediateRender: true }, at + 0.1);
    if (stub) tl.fromTo(stub, { x: 24, rotate: 3, autoAlpha: 0 }, { x: 0, rotate: 0, autoAlpha: 1, duration: 0.8, ease: 'back.out(1.6)', clearProps: 'transform,opacity,visibility', immediateRender: true }, at + 0.25);
    if (button) tl.fromTo(button, { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7, ease: 'back.out(1.8)', clearProps: 'transform,opacity,visibility', immediateRender: true }, at + 0.35);
  });

  const select = tab => {
    const current = tabs.find(t => t.getAttribute('aria-selected') === 'true');
    if (tab === current) return;
    tabs.forEach(t => {
      const active = t === tab;
      t.setAttribute('aria-selected', String(active));
      t.tabIndex = active ? 0 : -1;
    });
    if (animate) gsap.fromTo(tab.querySelector('[data-tickets-count]'), { scale: 0.4 }, { scale: 1, duration: 0.6, ease: 'back.out(3)', delay: 0.15, clearProps: 'transform' });
    panels.forEach(panel => {
      panel.hidden = panel.dataset.ticketsPanel !== tab.dataset.ticketsTab;
      if (!panel.hidden && animate) enter(gsap.timeline(), cardsIn(panel), 0);
    });
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      next.focus();
      select(next);
    });
  });

  // Each hover paints the title highlight in a new marker colour (never the one it just had).
  const markers = ['#fde047', '#6fd8e4', '#f9a8d4', '#86efac', '#fdba74', '#c4b5fd', '#fca5a5'];
  root.querySelectorAll('[data-ticket-card]').forEach(card => {
    let last = '';
    card.addEventListener('pointerenter', event => {
      if (event.pointerType === 'touch') return;
      const options = markers.filter(color => color !== last);
      last = options[Math.floor(Math.random() * options.length)];
      card.style.setProperty('--highlight-color', last);
    });
  });

  if (!animate) {
    show();
    return;
  }
  if (SplitText) gsap.registerPlugin(SplitText);

  // Letters rise out of a mask, the tabs pop in, then the tickets open.
  const reveal = () => {
    const title = root.querySelector('[data-reveal-chars]');
    const split = SplitText ? SplitText.create(title, { type: 'words,chars', mask: 'chars' }) : null;
    const tl = gsap.timeline({
      delay: document.documentElement.hasAttribute('data-page-arrived') ? 0.55 : 0.1,
      defaults: { ease: 'power4.out' },
      onComplete: () => split && split.revert()
    });

    tl.from(split ? split.chars : title, { yPercent: 110, duration: 1, stagger: 0.03 }, 0)
      .from(tabs, { y: 16, scale: 0.9, autoAlpha: 0, duration: 0.7, ease: 'back.out(1.8)', stagger: 0.06, clearProps: 'scale,opacity,visibility' }, 0.3);

    enter(tl, cardsIn(panels.find(panel => !panel.hidden) || panels[0]), 0.45);

    // The from() states are already applied, so lifting the CSS guard cannot flash the content.
    show();
  };
  document.fonts.ready.then(() => requestAnimationFrame(reveal));
})();
