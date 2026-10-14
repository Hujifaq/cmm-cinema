(() => {
  'use strict';
  if (!window.Swiper) return;

  document.querySelectorAll('[data-cinema-promos]').forEach(section => {
    const root = section.querySelector('[data-promo-swiper]');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const speed = () => motion.matches ? 0 : 700;
    const swiper = new Swiper(root, {
      speed: speed(),
      slidesPerView: 1.04,
      spaceBetween: 12,
      rewind: true,
      grabCursor: true,
      breakpoints: {
        640: { slidesPerView: 1.06, spaceBetween: 20 },
        1024: { slidesPerView: 1.08, spaceBetween: 24 }
      },
      navigation: {
        prevEl: section.querySelector('[data-promo-prev]'),
        nextEl: section.querySelector('[data-promo-next]')
      },
      a11y: {
        enabled: true,
        containerRoleDescriptionMessage: 'carousel',
        itemRoleDescriptionMessage: 'promotion',
        slideLabelMessage: '{{index}} of {{slidesLength}}',
        prevSlideMessage: 'Previous promotion',
        nextSlideMessage: 'Next promotion'
      },
      on: {
        touchStart(instance) { instance.params.speed = speed(); }
      }
    });

    section.querySelector('[data-promo-controls]').hidden = false;
    // Keyboard navigation is instant; dragging and pointer clicks keep the glide.
    section.addEventListener('click', event => {
      swiper.params.speed = event.detail === 0 ? 0 : speed();
    }, true);
    root.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'ArrowLeft') swiper.slidePrev(0);
      if (event.key === 'ArrowRight') swiper.slideNext(0);
      if (event.key === 'Home') swiper.slideTo(0, 0);
      if (event.key === 'End') swiper.slideTo(swiper.slides.length - 1, 0);
    });
    motion.addEventListener('change', () => {
      swiper.params.speed = speed();
      swiper.update();
    });
  });
})();
