(() => {
  'use strict';
  const sections = document.querySelectorAll('[data-movie-swiper]');
  const { gsap } = window;
  if (!sections.length || !gsap || matchMedia('(prefers-reduced-motion: reduce)').matches || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const pill = document.createElement('div');
  pill.className = 'movie-cursor';
  pill.setAttribute('aria-hidden', 'true');
  pill.textContent = 'View more';
  document.body.append(pill);

  gsap.set(pill, { x: innerWidth / 2, y: innerHeight / 2, scale: 0.2, rotation: 0 });
  const toX = gsap.quickTo(pill, 'x', { duration: 0.35, ease: 'power3.out' });
  const toY = gsap.quickTo(pill, 'y', { duration: 0.35, ease: 'power3.out' });
  const toTilt = gsap.quickTo(pill, 'rotation', { duration: 0.5, ease: 'power3.out' });
  let shown = false;
  let lastX = 0;
  let lastT = 0;

  const move = e => {
    if (e.pointerType !== 'mouse') return;
    const now = performance.now();
    const speed = (e.clientX - lastX) / Math.max(16, now - lastT);
    lastX = e.clientX;
    lastT = now;
    if (!shown) {
      shown = true;
      gsap.set(pill, { x: e.clientX, y: e.clientY, rotation: 0 });
      gsap.to(pill, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2)', overwrite: 'auto' });
    }
    toX(e.clientX);
    toY(e.clientY);
    toTilt(gsap.utils.clamp(-6, 6, speed * 5));
  };
  const hide = () => {
    if (!shown) return;
    shown = false;
    toTilt(0);
    gsap.to(pill, { autoAlpha: 0, scale: 0.2, duration: 0.3, ease: 'power3.in', overwrite: 'auto' });
  };

  sections.forEach(section => {
    section.addEventListener('pointerover', e => {
      if (e.target instanceof Element && e.target.closest('[data-movie-card] a')) move(e);
    });
    section.addEventListener('pointermove', e => {
      if (e.target instanceof Element && e.target.closest('[data-movie-card] a')) move(e);
      else hide();
    });
    section.addEventListener('pointerleave', hide);
    section.addEventListener('pointerdown', e => {
      if (shown && e.target instanceof Element && e.target.closest('[data-movie-card] a')) gsap.to(pill, { scale: 0.9, duration: 0.15, ease: 'power2.out' });
    });
    section.addEventListener('pointerup', () => { if (shown) gsap.to(pill, { scale: 1, duration: 0.3, ease: 'back.out(2)' }); });
  });
  addEventListener('scroll', () => {
    if (shown && ![...sections].some(s => s.querySelector('[data-movie-card] a:hover'))) hide();
  }, { passive: true });
  addEventListener('pagehide', () => { shown = false; gsap.set(pill, { autoAlpha: 0, scale: 0.2 }); });
})();
