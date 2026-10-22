(() => {
  'use strict';
  if (!window.Swiper) return;

  const colors = ['#fde047', '#f9a8d4', '#86efac', '#7dd3fc', '#fdba74', '#c4b5fd'];
  let last = '';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  document.querySelectorAll('[data-movie-swiper], [data-movie-grid]').forEach(root => {
    if (root.hasAttribute('data-movie-swiper')) new Swiper(root, {
      slidesPerView: 1.6,
      spaceBetween: 16,
      grabCursor: true,
      breakpoints: {
        640: { slidesPerView: 2.4 },
        1024: { slidesPerView: 3.4 }
      },
      a11y: {
        enabled: true,
        containerRoleDescriptionMessage: 'carousel',
        itemRoleDescriptionMessage: 'movie',
        slideLabelMessage: '{{index}} of {{slidesLength}}'
      }
    });

    root.querySelectorAll('[data-movie-poster]').forEach(poster => {
      const reset = () => ['--tilt-x', '--tilt-y'].forEach(name => poster.style.removeProperty(name));
      poster.addEventListener('pointermove', event => {
        if (event.pointerType !== 'mouse' || reduced.matches) return;
        const box = poster.getBoundingClientRect();
        const x = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
        const y = Math.min(1, Math.max(0, (event.clientY - box.top) / box.height));
        poster.style.setProperty('--tilt-x', `${((0.5 - y) * 2.4).toFixed(2)}deg`);
        poster.style.setProperty('--tilt-y', `${((x - 0.5) * 2.4).toFixed(2)}deg`);
        poster.style.setProperty('--glare-x', `${(x * 100).toFixed(1)}%`);
        poster.style.setProperty('--glare-y', `${(y * 100).toFixed(1)}%`);
      });
      poster.addEventListener('pointerleave', reset);
    });

    root.querySelectorAll('[data-movie-card]').forEach(card => {
      card.addEventListener('pointerenter', () => {
        const options = colors.filter(color => color !== last);
        last = options[Math.floor(Math.random() * options.length)];
        card.style.setProperty('--highlight-color', last);
      });
    });
  });
})();
