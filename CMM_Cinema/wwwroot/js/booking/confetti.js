(() => {
  'use strict';

  // One confetti burst over Booking Summary when it is reached from the seat loader.
  const host = document.querySelector('[data-confetti]');
  if (!host) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !window.lottie) {
    host.remove();
    return;
  }

  const animation = window.lottie.loadAnimation({
    container: host,
    renderer: 'svg',
    loop: false,
    autoplay: true,
    path: host.dataset.confetti,
    rendererSettings: { preserveAspectRatio: 'xMidYMid slice' }
  });

  const finish = () => {
    animation.destroy();
    host.remove();
  };
  animation.addEventListener('complete', finish);
  animation.addEventListener('data_failed', finish);
})();
