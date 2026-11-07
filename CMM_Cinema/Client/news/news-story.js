
import { initIndexMenu } from './index-menu.js';

initIndexMenu();


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
    gsap.timeline({ delay: 0.1, defaults: { ease: 'power4.out' }, onComplete: () => splits.filter(result => !result.chars.length).forEach(result => result.revert()) })
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
    // The falling disc keeps its own layer through the page change, so it carries on falling over the gallery.
    const falling = story.hasAttribute('data-riding') ? story.querySelector('[data-story-rider]') : story.querySelector('[data-story-drop-disc]');
    if (falling) falling.style.viewTransitionName = 'news-disc';
    story.dispatchEvent(new CustomEvent('story:drop'));
    const url = `${back}${back.includes('?') ? '&' : '?'}story=${encodeURIComponent(index)}&arrive=drop`;
    setTimeout(() => {
      try { sessionStorage.setItem('cmm-news-handoff', 'drop'); } catch {}
      window.location.href = url;
    }, reduced ? 0 : 360);
  }

  function update() {
    const p = progress();
    story.style.setProperty('--drop', p.toFixed(4));
    if (p > 0.05 || zone.getBoundingClientRect().top <= innerHeight * 0.05) armed = true;
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
    story.querySelectorAll('[data-story-rider], [data-story-drop-disc]').forEach(el => { el.style.viewTransitionName = ''; });
    update();
  });
  update();
})();

// ---------- Scroll storytelling ----------
(() => {
  'use strict';
  const story = document.querySelector('[data-story]');
  const { gsap, ScrollTrigger, SplitText } = window;
  if (!story || !gsap || !ScrollTrigger || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  gsap.registerPlugin(ScrollTrigger);
  if (SplitText) gsap.registerPlugin(SplitText);
  if (window.lenis) window.lenis.on('scroll', ScrollTrigger.update);

  const $ = selector => story.querySelector(selector);
  const hero = $('[data-story-hero]');
  const heroInner = $('[data-story-hero-inner]');
  const float = $('[data-story-float]');
  const statement = $('[data-story-statement]');
  const statementText = $('[data-story-statement-text]');
  const chapters = $('[data-story-chapters]');
  const track = $('[data-story-track]');
  const cards = [...story.querySelectorAll('[data-story-card]')];
  const spotlight = $('[data-story-spotlight]');
  const disc = $('[data-story-spin]');
  const shadow = $('[data-story-spot-shadow]');
  const cta = $('[data-story-cta]');
  const marquees = [...story.querySelectorAll('[data-story-marquee]')];

  story.setAttribute('data-story-live', '');

  if (float) gsap.to(float, { y: -16, rotation: 1.2, duration: 3.2, ease: 'sine.inOut', yoyo: true, repeat: -1 });

  const words = statementText && SplitText ? SplitText.create(statementText, { type: 'words' }).words : [];

  const spotlightTimeline = pin => {
    if (!spotlight || !disc) return;
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: pin
        ? { trigger: spotlight, start: 'top top', end: '+=140%', pin: true, scrub: 1 }
        : { trigger: spotlight, start: 'top 80%', end: 'bottom 30%', scrub: 1 }
    });
    tl.fromTo(disc, { rotationY: -30, rotationX: 38, scale: 0.72 }, { rotationY: 520, rotationX: 14, scale: 1, duration: 1 }, 0);
    if (shadow) tl.fromTo(shadow, { scaleX: 0.6, autoAlpha: 0.4 }, { scaleX: 1, autoAlpha: 1, duration: 1 }, 0);
    marquees.forEach(row => {
      const dir = Number(row.dataset.storyMarquee) || 1;
      tl.fromTo(row, { xPercent: dir > 0 ? -30 : 0 }, { xPercent: dir > 0 ? 0 : -30, duration: 1 }, 0);
    });
    if (cta) tl.from(cta, { y: 60, autoAlpha: 0, duration: 0.3, ease: 'power3.out' }, 0.62);
  };

  const media = gsap.matchMedia();

  media.add('(min-width: 900px)', () => {
    if (hero && heroInner) {
      ScrollTrigger.create({ trigger: hero, start: 'top top', end: 'bottom top', pin: true, pinSpacing: false });
      gsap.to(heroInner, { scale: 0.86, yPercent: -4, autoAlpha: 0.3, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
    }

    if (words.length) {
      gsap.fromTo(words, { opacity: 0.12 }, {
        opacity: 1, stagger: 0.1, ease: 'none',
        scrollTrigger: { trigger: statement, start: 'top top', end: '+=90%', pin: true, scrub: true }
      });
    }

    if (chapters && track) {
      const distance = () => Math.max(0, track.scrollWidth - innerWidth);
      gsap.to(track, {
        x: () => -distance(), ease: 'none',
        scrollTrigger: { trigger: chapters, start: 'top top', end: () => '+=' + distance(), pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1 }
      });
    }

    spotlightTimeline(true);
  });

  media.add('(max-width: 899px)', () => {
    if (words.length) {
      gsap.fromTo(words, { opacity: 0.12 }, { opacity: 1, stagger: 0.1, ease: 'none', scrollTrigger: { trigger: statementText, start: 'top 80%', end: 'bottom 45%', scrub: true } });
    }
    cards.forEach(card => gsap.from(card, {
      y: 90, rotationX: 22, scale: 0.92, autoAlpha: 0, transformPerspective: 900, transformOrigin: '50% 100%',
      duration: 1, ease: 'back.out(1.4)', clearProps: 'transform',
      scrollTrigger: { trigger: card, start: 'top 90%', toggleActions: 'play none none reverse' }
    }));
    spotlightTimeline(false);
  });

  addEventListener('pageshow', e => { if (e.persisted) ScrollTrigger.refresh(); });
})();
