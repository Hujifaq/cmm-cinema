(() => {
  'use strict';
  if (!window.Swiper) return;

  const colors = ['#fde047', '#f9a8d4', '#86efac', '#7dd3fc', '#fdba74', '#c4b5fd'];
  let last = '';
  let carouselCount = 0;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  document.querySelectorAll('[data-movie-swiper], [data-movie-grid]').forEach(root => {
    if (root.hasAttribute('data-movie-swiper')) {
      const wrap = root.closest('[data-carousel]');
      // Swiper's wheel option takes a selector, so each wrapper gets an id to be found by.
      if (wrap && !wrap.id) wrap.id = `movie-carousel-${++carouselCount}`;
      const prev = wrap?.querySelector('[data-carousel-prev]');
      const next = wrap?.querySelector('[data-carousel-next]');
      new Swiper(root, {
        slidesPerView: 1.6,
        spaceBetween: 16,
        grabCursor: true,
        // Trackpad two-finger swipes (and shift + wheel) glide the cards with momentum. Only sideways wheel movement is
        // taken, so ordinary vertical page scrolling is untouched, and it hands back to the page at either end. The whole
        // hover area listens, so a swipe works with the pointer over an arrow too.
        freeMode: { enabled: true, momentum: true, momentumRatio: 0.9, momentumVelocityRatio: 0.8 },
        mousewheel: { eventsTarget: wrap ? `#${wrap.id}` : root, forceToAxis: true, releaseOnEdges: true, sensitivity: 1 },
        navigation: prev && next ? { prevEl: prev, nextEl: next } : false,
        breakpoints: {
          640: { slidesPerView: 2.4 },
          1024: { slidesPerView: 3.4 }
        },
        a11y: {
          enabled: true,
          containerRoleDescriptionMessage: 'carousel',
          itemRoleDescriptionMessage: 'movie',
          slideLabelMessage: '{{index}} of {{slidesLength}}',
          prevSlideMessage: 'Previous movies',
          nextSlideMessage: 'Next movies'
        }
      });

      // The arrows sit level with the middle of the posters, whatever the card width is.
      const poster = root.querySelector('[data-movie-poster]');
      if (wrap && poster) {
        const place = () => {
          const box = poster.getBoundingClientRect();
          wrap.style.setProperty('--arrow-top', `${(box.top - wrap.getBoundingClientRect().top + box.height / 2).toFixed(1)}px`);
        };
        place();
        new ResizeObserver(place).observe(poster);
      }
    }

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
