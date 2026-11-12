(() => {
  'use strict';

  function init() {
    const ticket = document.querySelector('[data-ticket-tear]');
    const gsap = window.gsap;
    if (!ticket || !gsap) return;

    const seam = ticket.querySelector('[data-ticket-seam]');
    const stub = ticket.querySelector('[data-ticket-stub]');
    if (!seam || !stub) return;

    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      let frame = 0;
      let active = true;

      function update() {
        frame = 0;
        if (!active) return;

        // Measure the stationary seam so moving the stub cannot feed back into scroll progress.
        const viewport = window.innerHeight;
        if (!viewport) return;
        const progress = Math.max(0, Math.min(1,
          (viewport * 0.78 - seam.getBoundingClientRect().bottom) / (viewport * 0.43)));

        ticket.style.setProperty('--ticket-tear-width', `${progress * 100}%`);
        gsap.set(stub, {
          y: progress * 14,
          rotation: progress * -0.7,
          transformOrigin: 'top right'
        });
      }

      function schedule() {
        if (active && !frame) frame = window.requestAnimationFrame(update);
      }

      ticket.setAttribute('data-ticket-tear-ready', '');
      window.addEventListener('scroll', schedule, { passive: true });
      window.addEventListener('resize', schedule);
      window.addEventListener('pageshow', schedule);
      const images = [...ticket.querySelectorAll('img')];
      images.forEach(image => image.addEventListener('load', schedule));
      document.fonts?.ready.then(schedule);
      schedule();

      return () => {
        active = false;
        window.cancelAnimationFrame(frame);
        window.removeEventListener('scroll', schedule);
        window.removeEventListener('resize', schedule);
        window.removeEventListener('pageshow', schedule);
        images.forEach(image => image.removeEventListener('load', schedule));
        ticket.removeAttribute('data-ticket-tear-ready');
        ticket.style.removeProperty('--ticket-tear-width');
        gsap.set(stub, { clearProps: 'transform,transformOrigin' });
      };
    });
  }

  // The shared layout loads GSAP after booking scripts; all deferred scripts
  // finish before DOMContentLoaded, so initialise once those dependencies exist.
  if (document.readyState === 'complete') init();
  else document.addEventListener('DOMContentLoaded', init, { once: true });
})();
