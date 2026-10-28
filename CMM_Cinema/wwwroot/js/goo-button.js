(() => {
  'use strict';
  const { gsap } = window;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (!gsap || reduced.matches) return;

  // Gooey buttons: an accent fill floods in from the pointer while a blob stretches out
  // of the pill towards it, bridged by the SVG goo filter, and snaps off on the way out.
  document.querySelectorAll('[data-goo-button]').forEach(button => {
    const fill = button.querySelector('[data-goo-fill]');
    const blob = button.querySelector('[data-goo-blob]');
    const layer = blob.parentElement;
    const label = button.querySelector('[data-goo-label]');
    const follow = (target, prop, duration) => gsap.quickTo(target, prop, { duration, ease: 'power3.out' });
    const blobX = follow(blob, 'x', 0.45), blobY = follow(blob, 'y', 0.45);
    const layerX = follow(layer, 'x', 0.6), layerY = follow(layer, 'y', 0.6);
    const labelX = follow(label, 'x', 0.6), labelY = follow(label, 'y', 0.6);
    let rect = null;

    gsap.set([fill, blob], { xPercent: -50, yPercent: -50, scale: 0 });
    const enabled = event => fine.matches && !reduced.matches && event.pointerType === 'mouse';
    const local = event => {
      rect = button.getBoundingClientRect();
      const x = event.clientX - rect.left, y = event.clientY - rect.top;
      return { x, y, dx: x - rect.width / 2, dy: y - rect.height / 2 };
    };
    const flood = (x, y) => {
      button.setAttribute('data-goo-active', '');
      gsap.set(fill, { x, y });
      gsap.to(fill, { scale: 1, duration: 0.6, ease: 'power3.out', overwrite: 'auto' });
    };
    const drain = (x, y) => {
      button.removeAttribute('data-goo-active');
      gsap.to(fill, { x, y, scale: 0, duration: 0.5, ease: 'power3.inOut', overwrite: 'auto' });
    };

    const move = event => {
      if (!rect || !enabled(event)) return;
      const { dx, dy } = local(event);
      // Overshoot the pointer so the blob bulges past the pill's edge.
      blobX(rect.width / 2 + dx * 1.15);
      blobY(rect.height / 2 + dy * 1.5);
      layerX(dx * 0.12); layerY(dy * 0.25);
      labelX(dx * 0.2); labelY(dy * 0.35);
    };

    button.addEventListener('pointerenter', event => {
      if (!enabled(event)) return;
      const { x, y } = local(event);
      flood(x, y);
      gsap.set(blob, { x, y });
      gsap.to(blob, { scale: 1, duration: 0.5, ease: 'back.out(2.2)', overwrite: 'auto' });
      move(event);
    });
    button.addEventListener('pointermove', move);
    button.addEventListener('pointerleave', event => {
      if (!rect) return;
      const { x, y, dx, dy } = local(event);
      const length = Math.hypot(dx, dy) || 1;
      rect = null;
      drain(x, y);
      // Pull the blob out past the exit point, then let it pinch off and vanish.
      blobX(x + dx / length * 28);
      blobY(y + dy / length * 28);
      gsap.to(blob, { scale: 0, duration: 0.35, delay: 0.12, ease: 'power2.in', overwrite: 'auto' });
      layerX(0); layerY(0); labelX(0); labelY(0);
      gsap.to(layer, { scaleX: 1, scaleY: 1, duration: 0.6, ease: 'elastic.out(1, 0.35)' });
    });

    button.addEventListener('pointerdown', event => {
      if (enabled(event)) gsap.to(layer, { scaleX: 1.06, scaleY: 0.88, duration: 0.15, ease: 'power2.out' });
    });
    button.addEventListener('pointerup', () => {
      gsap.to(layer, { scaleX: 1, scaleY: 1, duration: 0.6, ease: 'elastic.out(1, 0.35)' });
    });

    // Keyboard focus gets the same flood, from the centre.
    button.addEventListener('focus', () => {
      if (button.matches(':focus-visible')) flood(button.offsetWidth / 2, button.offsetHeight / 2);
    });
    button.addEventListener('blur', () => {
      if (!rect) drain(button.offsetWidth / 2, button.offsetHeight / 2);
    });
  });
})();
