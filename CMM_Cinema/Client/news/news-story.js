// Single news story: reaching the very bottom of the page drops back to the disc gallery,
// where this story's disc falls in with a little loop (news-disc-gallery.js reads ?story=&arrive=drop).
import { initIndexMenu } from './index-menu.js';

initIndexMenu();

// Masked lines and letters rise into place, the same reveal the movie pages use for their titles.
(() => {
  const story = document.querySelector('[data-story]');
  if (!story) return;
  const show = () => story.setAttribute('data-revealed', '');
  const { gsap, SplitText } = window;
  if (!gsap || !SplitText || matchMedia('(prefers-reduced-motion: reduce)').matches) { show(); return; }
  gsap.registerPlugin(SplitText);

  const reveal = () => {
    const splits = [];
    const split = (selector, type) => [...story.querySelectorAll(selector)].flatMap(element => {
      const result = SplitText.create(element, { type: type === 'chars' ? 'words,chars' : type, mask: type });
      splits.push(result);
      return result[type];
    });
    gsap.timeline({ delay: 0.1, defaults: { ease: 'power4.out' }, onComplete: () => splits.forEach(result => result.revert()) })
      .from(split('[data-reveal-lines]', 'lines'), { yPercent: 105, duration: 0.8 }, 0.1)
      .from(split('[data-reveal-chars]', 'chars'), { yPercent: 110, duration: 1, stagger: 0.025 }, 0.15);
    show();
  };
  document.fonts.ready.then(() => requestAnimationFrame(reveal));
})();

(() => {
  'use strict';
  const story = document.querySelector('[data-story]');
  const zone = story && story.querySelector('[data-story-drop]');
  if (!zone) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const back = story.dataset.backUrl || '/';
  const index = story.dataset.storyIndex || '0';
  let dropped = false;
  let armed = false;      // only after the reader has scrolled into the drop zone themselves
  let holdTimer = 0;

  const progress = () => {
    const r = zone.getBoundingClientRect();
    const travel = Math.max(1, zone.offsetHeight - innerHeight);
    return Math.min(1, Math.max(0, -r.top / travel));
  };
  const atBottom = () => innerHeight + scrollY >= document.documentElement.scrollHeight - 2;

  function drop() {
    if (dropped) return;
    dropped = true;
    story.classList.add('is-dropping');
    const url = `${back}${back.includes('?') ? '&' : '?'}story=${encodeURIComponent(index)}&arrive=drop`;
    setTimeout(() => {
      try { sessionStorage.setItem('cmm-news-handoff', 'drop'); } catch {}
      window.location.href = url;
    }, reduced ? 0 : 700);
  }

  function update() {
    const p = progress();
    story.style.setProperty('--drop', p.toFixed(4));
    if (p > 0.05) armed = true;
    clearTimeout(holdTimer);
    if (armed && atBottom()) holdTimer = setTimeout(() => { if (atBottom()) drop(); }, 160);
  }

  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  // Still scrolling down at the very bottom (the page can't move any further): drop right away.
  addEventListener('wheel', e => { if (armed && e.deltaY > 0 && atBottom()) drop(); }, { passive: true });
  let touchY = 0;
  addEventListener('touchstart', e => { touchY = e.touches[0].clientY; }, { passive: true });
  addEventListener('touchmove', e => { if (armed && touchY - e.touches[0].clientY > 24 && atBottom()) drop(); }, { passive: true });
  // Back from the gallery with the browser's back button: put the page back as it was.
  addEventListener('pageshow', e => {
    if (!e.persisted) return;
    dropped = false;
    armed = false;
    story.classList.remove('is-dropping');
    update();
  });
  update();
})();
