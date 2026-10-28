(() => {
  'use strict';
  const gsap = window.gsap;
  if (!gsap) return;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const enabled = () => fine.matches && !reduce.matches;

  // Magnetic button: the cream surface leans toward the pointer and the arrow leans a little further.
  // overwrite: 'auto' lets each new tween kill only the overlapping x/y of the one still running,
  // so moving, leaving and re-entering hand off smoothly instead of stacking.
  document.querySelectorAll('[data-magnetic-arrow]').forEach(button => {
    const visual = button.querySelector('[data-magnetic-visual]');
    const icon = button.querySelector('[data-magnetic-icon]');

    const move = event => {
      if (!enabled() || event.pointerType !== 'mouse' || button.disabled) return;
      const rect = button.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;
      gsap.to(visual, { x: x * 0.5, y: y * 0.5, duration: 0.4, ease: 'power3.out', overwrite: 'auto' });
      gsap.to(icon, { x: x * 0.25, y: y * 0.25, duration: 0.4, ease: 'power3.out', overwrite: 'auto' });
    };
    const release = () => {
      gsap.to([visual, icon], { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, 0.3)', overwrite: 'auto' });
    };
    const reset = () => gsap.set([visual, icon], { clearProps: 'transform' });

    button.addEventListener('pointermove', move);
    button.addEventListener('pointerleave', release);
    button.addEventListener('pointercancel', release);
    fine.addEventListener('change', reset);
    reduce.addEventListener('change', reset);
  });
})();
