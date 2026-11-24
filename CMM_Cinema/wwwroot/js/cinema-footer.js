(() => {
  'use strict';
  const footer = document.querySelector('[data-cinema-footer]');
  if (!footer) return;

  const $ = selector => footer.querySelector(selector);
  const reveal = () => footer.setAttribute('data-footer-revealed', '');

  // Run the prop float only while the footer is on screen.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      entries.forEach(entry => footer.toggleAttribute('data-footer-visible', entry.isIntersecting));
    }).observe(footer);
  } else {
    footer.setAttribute('data-footer-visible', '');
  }

  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  // Without GSAP the footer is simply shown as it is.
  if (!gsap || !ScrollTrigger) { reveal(); return; }

  gsap.registerPlugin(ScrollTrigger);
  window.lenis?.on('scroll', ScrollTrigger.update);

  const card = $('[data-footer-card]');
  const clay = $('[data-footer-clay]');
  const popcorn = $('[data-footer-popcorn]');
  const props = [...footer.querySelectorAll('[data-footer-prop], [data-footer-popcorn]')];
  const items = [...footer.querySelectorAll('[data-footer-reveal]')];
  const mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    // 1. The card rises and settles to full size as the footer scrolls in.
    gsap.fromTo(card,
      { yPercent: 6, scale: 0.94, transformOrigin: '50% 100%' },
      {
        yPercent: 0, scale: 1, ease: 'none',
        scrollTrigger: { trigger: footer, start: 'top bottom', end: 'top 30%', scrub: 0.6 }
      });

    // 2. Depth: the ribbon, star and popcorn drift at different speeds. The
    //    popcorn travels furthest and lands in its corner as the page ends.
    const pass = { trigger: footer, start: 'top bottom', end: 'bottom top', scrub: true };
    gsap.fromTo(clay, { yPercent: -10, rotation: -8 }, { yPercent: 6, rotation: 4, ease: 'none', scrollTrigger: pass });
    gsap.fromTo('[data-footer-prop]', { yPercent: 40 }, { yPercent: -30, ease: 'none', scrollTrigger: { ...pass } });
    gsap.fromTo(popcorn, { yPercent: 45 }, {
      yPercent: 0, ease: 'none',
      scrollTrigger: { trigger: footer, start: 'top bottom', end: 'bottom bottom', scrub: 0.4 }
    });

    // 3. Logo, columns and legal bar rise in once, staggered.
    gsap.set(items, { y: 40, autoAlpha: 0 });
    gsap.set(props, { autoAlpha: 0 });
    reveal();
    ScrollTrigger.create({
      trigger: footer,
      start: 'top 70%',
      once: true,
      onEnter: () => {
        gsap.to(items, { y: 0, autoAlpha: 1, duration: 0.9, ease: 'power3.out', stagger: 0.08, clearProps: 'y' });
        // The props pop in like the hero's: from small and tilted, with a little overshoot.
        gsap.fromTo(props, { scale: 0.4, rotation: -25, autoAlpha: 0 }, {
          scale: 1, rotation: 0, autoAlpha: 1, duration: 1.1, ease: 'back.out(1.7)', stagger: 0.12, delay: 0.25
        });
      }
    });

    // Carousels and images above can change the page height after load.
    let pending = 0;
    const observer = new ResizeObserver(() => {
      window.clearTimeout(pending);
      pending = window.setTimeout(() => ScrollTrigger.refresh(), 200);
    });
    observer.observe(document.body);
    return () => { observer.disconnect(); window.clearTimeout(pending); };
  });

  // 4. With a mouse, the artwork leans toward the pointer, nearer layers more:
  //    the popcorn, in front of everything, moves most.
  mm.add('(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)', () => {
    const layers = [[clay, 16], ...footer.querySelectorAll('[data-footer-prop]')].map(l => Array.isArray(l) ? l : [l, 30]);
    if (popcorn) layers.push([popcorn, 56]);
    const movers = layers.map(([el, depth]) => ({
      depth,
      x: gsap.quickTo(el, 'x', { duration: 1.2, ease: 'power3.out' }),
      y: gsap.quickTo(el, 'y', { duration: 1.2, ease: 'power3.out' })
    }));
    const lean = (nx, ny) => movers.forEach(m => { m.x(nx * m.depth); m.y(ny * m.depth); });
    const move = event => {
      if (event.pointerType !== 'mouse') return;
      const rect = footer.getBoundingClientRect();
      lean((event.clientX - rect.left) / rect.width - 0.5, (event.clientY - rect.top) / rect.height - 0.5);
    };
    const leave = () => lean(0, 0);
    footer.addEventListener('pointermove', move);
    footer.addEventListener('pointerleave', leave);
    return () => {
      footer.removeEventListener('pointermove', move);
      footer.removeEventListener('pointerleave', leave);
    };
  });

  // Reduced motion: everything stays put and visible.
  mm.add('(prefers-reduced-motion: reduce)', () => { reveal(); });

  window.addEventListener('pagehide', () => mm.revert(), { once: true });
})();
