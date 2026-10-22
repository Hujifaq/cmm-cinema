(() => {
  'use strict';
  const root = document.querySelector('[data-tickets-page]');
  if (!root) return;

  const { gsap, SplitText } = window;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const animate = Boolean(gsap) && !reduced.matches;
  const tabList = root.querySelector('[data-tickets-tabs]');
  const indicator = root.querySelector('[data-tickets-indicator]');
  const tabs = [...root.querySelectorAll('[data-tickets-tab]')];
  const panels = [...root.querySelectorAll('[data-tickets-panel]')];
  const show = () => root.setAttribute('data-revealed', '');
  const cardsIn = panel => [...panel.querySelectorAll('[data-ticket-card]')];

  // The ink pill sits under the selected tab; switching stretches it across both tabs
  // like a drop of ink pulling itself over, then lets the trailing edge snap after it.
  const place = tab => ({ x: tab.offsetLeft, y: tab.offsetTop, width: tab.offsetWidth, height: tab.offsetHeight });
  const park = tab => {
    if (!indicator) return;
    const { x, y, width, height } = place(tab);
    if (gsap) gsap.set(indicator, { x, y, width, height });
    else Object.assign(indicator.style, { transform: `translate(${x}px, ${y}px)`, width: `${width}px`, height: `${height}px` });
  };
  const slide = (from, to) => {
    if (!animate || !indicator || from.offsetTop !== to.offsetTop) return park(to);
    const a = place(from), b = place(to);
    const left = Math.min(a.x, b.x), right = Math.max(a.x + a.width, b.x + b.width);
    gsap.timeline({ defaults: { overwrite: 'auto' } })
      .to(indicator, { x: left, width: right - left, scaleY: 0.86, duration: 0.22, ease: 'power2.in' })
      .to(indicator, { x: b.x, width: b.width, scaleY: 1, duration: 0.6, ease: 'elastic.out(1, 0.55)' });
    gsap.fromTo(to.querySelector('[data-tickets-count]'), { scale: 0.4 }, { scale: 1, duration: 0.6, ease: 'back.out(3)', delay: 0.15, clearProps: 'transform' });
  };

  const select = tab => {
    const current = tabs.find(t => t.getAttribute('aria-selected') === 'true');
    if (tab === current) return;
    tabs.forEach(t => {
      const active = t === tab;
      t.setAttribute('aria-selected', String(active));
      t.tabIndex = active ? 0 : -1;
    });
    slide(current, tab);
    panels.forEach(panel => {
      panel.hidden = panel.dataset.ticketsPanel !== tab.dataset.ticketsTab;
      if (!panel.hidden && animate) {
        gsap.fromTo(cardsIn(panel),
          { autoAlpha: 0, y: 32, rotate: 0.6 },
          { autoAlpha: 1, y: 0, rotate: 0, duration: 0.7, ease: 'power3.out', stagger: 0.07, clearProps: 'transform,opacity,visibility' });
      }
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

  const selected = () => tabs.find(t => t.getAttribute('aria-selected') === 'true') || tabs[0];
  if (indicator && tabList) {
    park(selected());
    tabList.setAttribute('data-tabs-ready', '');
    window.addEventListener('resize', () => park(selected()));
    document.fonts.ready.then(() => park(selected()));
  }

  if (!animate) {
    show();
    return;
  }
  if (SplitText) gsap.registerPlugin(SplitText);

  // Letters rise out of a mask, the tabs pop in, then each ticket slides up and its stub tears into place.
  const reveal = () => {
    const title = root.querySelector('[data-reveal-chars]');
    const split = SplitText ? SplitText.create(title, { type: 'words,chars', mask: 'chars' }) : null;
    const tl = gsap.timeline({
      delay: document.documentElement.hasAttribute('data-page-arrived') ? 0.55 : 0.1,
      defaults: { ease: 'power4.out' },
      onComplete: () => split && split.revert()
    });

    tl.from(split ? split.chars : title, { yPercent: 110, duration: 1, stagger: 0.03 }, 0)
      .from([indicator, ...tabs], { y: 16, scale: 0.9, autoAlpha: 0, duration: 0.7, ease: 'back.out(1.8)', stagger: 0.06, clearProps: 'scale,opacity,visibility' }, 0.3);

    cardsIn(panels.find(panel => !panel.hidden) || panels[0]).forEach((card, i) => {
      const at = 0.45 + i * 0.1;
      tl.from(card, { y: 48, autoAlpha: 0, duration: 0.9, ease: 'power3.out', clearProps: 'transform,opacity,visibility' }, at);
      const poster = card.querySelector('[data-ticket-poster]');
      if (poster) tl.fromTo(poster, { clipPath: 'inset(100% 0% 0% 0% round 16px)' }, { clipPath: 'inset(0% 0% 0% 0% round 16px)', duration: 1, ease: 'expo.out', clearProps: 'clipPath' }, at + 0.1);
      const stub = card.querySelector('[data-ticket-stub]');
      if (stub) tl.from(stub, { x: 24, rotate: 3, autoAlpha: 0, duration: 0.8, ease: 'back.out(1.6)', clearProps: 'transform,opacity,visibility' }, at + 0.25);
      const button = card.querySelector('[data-goo-button]');
      if (button) tl.from(button, { y: 14, autoAlpha: 0, duration: 0.7, ease: 'back.out(1.8)', clearProps: 'transform,opacity,visibility' }, at + 0.35);
    });

    // The from() states are already applied, so lifting the CSS guard cannot flash the content.
    show();
  };
  document.fonts.ready.then(() => requestAnimationFrame(reveal));
})();
