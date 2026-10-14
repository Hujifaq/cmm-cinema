(() => {
  'use strict';

  document.querySelectorAll('[data-marquee]').forEach(marquee => {
    const toggle = marquee.querySelector('[data-marquee-toggle]');
    const pauseIcon = toggle.querySelector('[data-marquee-pause-icon]');
    const playIcon = toggle.querySelector('[data-marquee-play-icon]');
    toggle.hidden = false;
    toggle.addEventListener('click', () => {
      const paused = marquee.toggleAttribute('data-paused');
      toggle.setAttribute('aria-pressed', String(paused));
      toggle.setAttribute('aria-label', paused ? 'Resume promotions' : 'Pause promotions');
      pauseIcon.toggleAttribute('hidden', paused);
      playIcon.toggleAttribute('hidden', !paused);
    });
  });
})();
