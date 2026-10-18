(() => {
  'use strict';
  if (!window.Lenis || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // A high lerp keeps the glide short so scrolling still feels immediate.
  window.lenis = new Lenis({ lerp: 0.14, wheelMultiplier: 1, autoRaf: true });
})();
