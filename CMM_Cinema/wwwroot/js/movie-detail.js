(() => {
  'use strict';
  const root = document.querySelector('[data-movie-detail]');
  if (!root) return;

  const { gsap, SplitText } = window;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const all = selector => [...root.querySelectorAll(selector)];
  const show = () => root.setAttribute('data-revealed', '');

  if (!gsap || reduced.matches) {
    show();
    return;
  }
  if (SplitText) gsap.registerPlugin(SplitText);

  // Masked lines and letters rise into place; the poster unmasks upward behind them.
  const reveal = () => {
    const splits = [];
    const split = (elements, type) => elements.flatMap(element => {
      if (!SplitText) return [element];
      const result = SplitText.create(element, { type: type === 'chars' ? 'words,chars' : type, mask: type });
      splits.push(result);
      return result[type];
    });
    const poster = root.querySelector('[data-detail-poster]');
    const titles = all('[data-reveal-chars]');
    const tl = gsap.timeline({
      // Arriving through the page swing: let the new page land first.
      delay: document.documentElement.hasAttribute('data-page-arrived') ? 0.55 : 0.1,
      defaults: { ease: 'power4.out' },
      onComplete: () => splits.forEach(result => result.revert())
    });

    tl.fromTo(poster,
      { clipPath: 'inset(100% 0% 0% 0% round 16px)' },
      { clipPath: 'inset(0% 0% 0% 0% round 16px)', duration: 1.1, ease: 'expo.out', clearProps: 'clipPath' }, 0)
      .from(poster.firstElementChild, { scale: 1.25, duration: 1.4, ease: 'expo.out', clearProps: 'transform' }, 0)
      .from(split(all('[data-reveal-lines]').slice(0, 1), 'lines'), { yPercent: 105, duration: 0.8 }, 0.1)
      .from(split(titles.slice(0, 1), 'chars'), { yPercent: 110, duration: 1, stagger: 0.025 }, 0.15)
      .from(all('[data-reveal-up]'), { y: 14, autoAlpha: 0, duration: 0.7, ease: 'power3.out', stagger: 0.06, clearProps: 'transform,opacity,visibility' }, 0.45)
      .from(split(all('[data-reveal-lines]').slice(1), 'lines'), { yPercent: 105, duration: 1, stagger: 0.08 }, 0.55)
      .from(all('[data-goo-button]'), { y: 18, autoAlpha: 0, duration: 0.8, ease: 'back.out(1.6)', stagger: 0.08, clearProps: 'transform,opacity,visibility' }, 0.6)
      .from(split(titles.slice(1), 'chars'), { yPercent: 110, duration: 0.9, stagger: 0.03 }, 0.8)
      .from(all('[data-reveal-cast] > :first-child'), { scale: 0, duration: 0.7, ease: 'back.out(2)', stagger: 0.08, clearProps: 'transform' }, 0.95)
      .from(all('[data-reveal-cast] > :last-child'), { x: -10, autoAlpha: 0, duration: 0.7, ease: 'power3.out', stagger: 0.08, clearProps: 'transform,opacity,visibility' }, 1);

    // The from() states are already applied, so lifting the CSS guard cannot flash the copy.
    show();
  };
  document.fonts.ready.then(() => requestAnimationFrame(reveal));
})();
