(() => {
  'use strict';
  
  const GOOEY_MS = 650;
  const mobile = window.matchMedia('(max-width: 767px)');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let timer = 0;
  let navigating = false;

  const hrefFor = (stage, index) => {
    const href = stage.querySelectorAll('[data-gooey-index] button')[index]?.dataset.href;
    if (!href) return null;
    const url = new URL(href, window.location.origin);
    return url.pathname === window.location.pathname && url.search === window.location.search ? null : url.href;
  };
  const navigate = href => {
    if (navigating) return;
    navigating = true;
    window.location.assign(href);
  };

  document.querySelectorAll('[data-gooey-nav]').forEach(stage => {
    stage.addEventListener('cinema:selection', event => {
      const href = hrefFor(stage, event.detail.index);
      clearTimeout(timer);
      if (!href) return;
      if (mobile.matches || motion.matches) navigate(href);
      else timer = setTimeout(() => navigate(href), GOOEY_MS);
    });

    // Navigate straight from the mobile menu rows, independent of the gooey pill.
    const nav = stage.closest('[data-cinema-nav]');
    nav?.querySelector('[data-mobile-menu]')?.addEventListener('click', event => {
      const row = event.target.closest('[data-mobile-index]');
      if (!row || !mobile.matches) return;
      const href = hrefFor(stage, Number(row.dataset.mobileIndex));
      if (href) navigate(href);
    });
  });

  window.addEventListener('pageshow', () => { navigating = false; });
})();
