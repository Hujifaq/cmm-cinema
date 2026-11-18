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
      delay: document.documentElement.hasAttribute('data-page-arrived') ? 0.3 : 0.03,
      defaults: { ease: 'power4.out' },
      onComplete: () => splits.forEach(result => result.revert())
    });

    tl.fromTo(poster,
      { clipPath: 'inset(100% 0% 0% 0% round 16px)' },
      { clipPath: 'inset(0% 0% 0% 0% round 16px)', duration: 0.8, ease: 'expo.out', clearProps: 'clipPath' }, 0)
      .from(poster.firstElementChild, { scale: 1.25, duration: 1, ease: 'expo.out', clearProps: 'transform' }, 0)
      .from(split(all('[data-reveal-lines]').slice(0, 1), 'lines'), { yPercent: 105, duration: 0.55 }, 0.05)
      .from(split(titles.slice(0, 1), 'chars'), { yPercent: 110, duration: 0.7, stagger: 0.02 }, 0.08)
      .from(all('[data-reveal-up]'), { y: 14, autoAlpha: 0, duration: 0.5, ease: 'power3.out', stagger: 0.04, clearProps: 'transform,opacity,visibility' }, 0.25)
      .from(split(all('[data-reveal-lines]').slice(1), 'lines'), { yPercent: 105, duration: 0.7, stagger: 0.05 }, 0.3)
      .from(split(titles.slice(1), 'chars'), { yPercent: 110, duration: 0.65, stagger: 0.02 }, 0.45)
      .from(all('[data-reveal-cast] > :first-child'), { scale: 0, duration: 0.5, ease: 'back.out(2)', stagger: 0.05, clearProps: 'transform' }, 0.55)
      .from(all('[data-reveal-cast] > :last-child'), { x: -10, autoAlpha: 0, duration: 0.5, ease: 'power3.out', stagger: 0.05, clearProps: 'transform,opacity,visibility' }, 0.6);

    // Upcoming movies have no booking buttons, so there is nothing to animate for them.
    const buttons = all('[data-goo-button]');
    if (buttons.length) tl.from(buttons, { y: 18, autoAlpha: 0, duration: 0.55, ease: 'back.out(1.6)', stagger: 0.06, clearProps: 'transform,opacity,visibility' }, 0.35);

    // The trailer frame waits masked and unmasks upward when it scrolls into view, like the poster,
    // after the opening sequence has finished. The dark frame wipes in first and the video settles from a slight zoom.
    const trailer = root.querySelector('[data-reveal-trailer]');
    if (trailer) {
      const video = trailer.firstElementChild;
      gsap.set(trailer, { clipPath: 'inset(100% 0% 0% 0% round 16px)' });
      if (video) gsap.set(video, { scale: 1.15 });

      const play = () => gsap.timeline({ defaults: { ease: 'expo.out' } })
        .to(trailer, { clipPath: 'inset(0% 0% 0% 0% round 16px)', duration: 0.8, clearProps: 'clipPath' }, 0)
        .to(video || trailer, { scale: 1, duration: 1, clearProps: 'transform' }, 0);
      // Starts as soon as it is in view, overlapping the end of the opening sequence rather than waiting for all of it.
      const start = () => gsap.delayedCall(Math.max(0, (tl.totalDuration() - tl.time()) * 0.4), play);

      // Browsers treat an element hidden by its own clip-path as off-screen, so an unclipped wrapper is observed instead.
      if ('IntersectionObserver' in window) {
        const watcher = new IntersectionObserver(entries => {
          if (!entries.some(entry => entry.isIntersecting)) return;
          watcher.disconnect();
          start();
        }, { threshold: 0.12 });
        watcher.observe(trailer.closest('[data-trailer-watch]') || trailer.parentElement);
      } else {
        start();
      }
    }

    // The from() states are already applied, so lifting the CSS guard cannot flash the copy.
    show();
  };
  document.fonts.ready.then(() => requestAnimationFrame(reveal));
})();
