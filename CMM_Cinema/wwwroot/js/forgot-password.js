(() => {
  'use strict';
  const root = document.querySelector('[data-forgot-password-page], [data-reset-password-page]');
  if (!root) return;

  const { gsap, SplitText } = window;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const show = () => root.setAttribute('data-revealed', '');
  if (!gsap || reduced.matches) return show();

  let context, split, disposed = false;
  const revertText = () => { split?.revert(); split = undefined; };
  const finish = () => {
    disposed = true;
    context?.revert();
    revertText();
    reduced.removeEventListener('change', onMotionChange);
    show();
  };
  const onMotionChange = () => { if (reduced.matches) finish(); };
  reduced.addEventListener('change', onMotionChange);
  window.addEventListener('pagehide', finish, { once: true });

  const reveal = () => {
    if (disposed || reduced.matches) return show();
    try {
      if (SplitText) gsap.registerPlugin(SplitText);
      context = gsap.context(() => {
        const title = root.querySelector('[data-reveal-chars]');
        if (SplitText) split = SplitText.create(title, { type: 'words,chars', mask: 'chars' });
        gsap.timeline({
          delay: document.documentElement.hasAttribute('data-page-arrived') ? 0.55 : 0.1,
          defaults: { ease: 'power4.out' },
          onComplete: revertText
        })
          .from('[data-reset-card]', { y: 20, borderRadius: '44px', duration: 0.75, clearProps: 'transform,borderRadius' }, 0)
          .from(split ? split.chars : title, { yPercent: 110, duration: 0.55, stagger: 0.018, clearProps: 'transform' }, 0.12)
          .from('[data-reveal-up]', { y: 12, autoAlpha: 0, duration: 0.5, stagger: 0.06, clearProps: 'transform,opacity,visibility' }, 0.2);
      }, root);
      show();
    } catch {
      finish();
    }
  };
  (document.fonts?.ready ?? Promise.resolve()).then(() => requestAnimationFrame(reveal));
})();
