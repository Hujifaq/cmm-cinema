
import { initIndexMenu } from './index-menu.js';

const STACKED = '(max-width: 899px), (max-aspect-ratio: 799/1000)';
const SPLIT = '(min-width: 900px) and (min-aspect-ratio: 4/5)';

initIndexMenu();


(() => {
  const story = document.querySelector('[data-story]');
  if (!story) return;
  const show = () => story.setAttribute('data-revealed', '');
  const { gsap, SplitText } = window;
  if (!gsap || !SplitText || matchMedia('(prefers-reduced-motion: reduce)').matches || matchMedia(STACKED).matches) { show(); return; }
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
      .from(split('[data-reveal-chars]', 'chars'), { yPercent: 110, duration: 1, stagger: 0.025 }, 0.15)
      .from(story.querySelectorAll('[data-reveal-up]'), { y: 14, autoAlpha: 0, duration: 0.8, ease: 'power3.out', stagger: 0.06 }, 0.5);
    show();
  };
  document.fonts.ready.then(() => requestAnimationFrame(reveal));
})();

// ---------- Up next: keep scrolling past the end and the News page takes over ----------
(() => {
  'use strict';
  const story = document.querySelector('[data-story]');
  const zone = story && story.querySelector('[data-story-next]');
  if (!zone || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const index = story.dataset.storyIndex || '0';
  const url = `/News?story=${encodeURIComponent(index)}&arrive=story`;
  let left = false;
  let armed = false;
  let frame = 0;

  const progress = () => {
    const r = zone.getBoundingClientRect();
    return Math.min(1, Math.max(0, -r.top / Math.max(1, zone.offsetHeight - innerHeight)));
  };

  const leave = () => {
    if (left) return;
    left = true;
    zone.style.setProperty('--p', '1');
    zone.style.setProperty('--c', '1');
    try { sessionStorage.setItem('cmm-news-handoff', 'story'); } catch {}
    window.location.href = url;
  };

  const update = () => {
    frame = 0;
    if (left) return;
    const p = progress();
    zone.style.setProperty('--p', p.toFixed(4));
    zone.style.setProperty('--c', Math.min(1, p / 0.85).toFixed(4));
    if (p > 0.04 && p < 0.9) armed = true;
    if (armed && p >= 0.985) leave();
  };
  const queue = () => { if (!frame) frame = requestAnimationFrame(update); };

  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  if (window.lenis) window.lenis.on('scroll', queue);
  zone.querySelector('[data-story-next-link]')?.addEventListener('click', e => { e.preventDefault(); leave(); });

  const rewind = () => {
    if (progress() < 0.5) return;
    const top = zone.getBoundingClientRect().top + scrollY - innerHeight * 0.6;
    if (window.lenis) window.lenis.scrollTo(top, { immediate: true }); else scrollTo(0, top);
  };

  addEventListener('pageshow', e => {
    if (!e.persisted) return;
    left = false;
    armed = false;
    rewind();
    update();
  });
  rewind();
  update();
})();

// ---------- More stories: a pill follows the mouse over the cards ----------
(() => {
  'use strict';
  const cards = document.querySelector('[data-case-cards]');
  const pill = document.querySelector('[data-case-cursor]');
  const { gsap } = window;
  if (!cards || !pill || !gsap || matchMedia('(prefers-reduced-motion: reduce)').matches || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  gsap.set(pill, { x: innerWidth / 2, y: innerHeight / 2, scale: 0.2, rotation: 0 });
  const toX = gsap.quickTo(pill, 'x', { duration: 0.35, ease: 'power3.out' });
  const toY = gsap.quickTo(pill, 'y', { duration: 0.35, ease: 'power3.out' });
  const toTilt = gsap.quickTo(pill, 'rotation', { duration: 0.5, ease: 'power3.out' });
  let shown = false;
  let lastX = 0;
  let lastT = 0;

  const move = e => {
    if (e.pointerType !== 'mouse') return;
    const now = performance.now();
    const speed = (e.clientX - lastX) / Math.max(16, now - lastT);
    lastX = e.clientX;
    lastT = now;
    if (!shown) {
      shown = true;
      gsap.set(pill, { x: e.clientX, y: e.clientY, rotation: 0 });
      gsap.to(pill, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2)', overwrite: 'auto' });
    }
    toX(e.clientX);
    toY(e.clientY);
    toTilt(gsap.utils.clamp(-6, 6, speed * 5));
  };
  const hide = () => {
    if (!shown) return;
    shown = false;
    toTilt(0);
    gsap.to(pill, { autoAlpha: 0, scale: 0.2, duration: 0.3, ease: 'power3.in', overwrite: 'auto' });
  };

  cards.querySelectorAll('.case-card__link').forEach(link => {
    link.addEventListener('pointerenter', move);
    link.addEventListener('pointermove', move);
    link.addEventListener('pointerleave', e => {
      const next = e.relatedTarget;
      if (!(next instanceof Element) || !next.closest('.case-card__link')) hide();
    });
    link.addEventListener('pointerdown', () => gsap.to(pill, { scale: 0.9, duration: 0.15, ease: 'power2.out' }));
  });
  addEventListener('scroll', () => {
    if (shown && !cards.matches(':hover')) hide();
  }, { passive: true });
  addEventListener('pagehide', () => { shown = false; gsap.set(pill, { autoAlpha: 0, scale: 0.2 }); });
})();

// ---------- Trailer: the cover swaps for the player only when asked, so nothing loads from YouTube/Vimeo until then ----------
(() => {
  'use strict';
  document.querySelectorAll('[data-trailer]').forEach(frame => {
    const play = frame.querySelector('[data-trailer-play]');
    if (!play) return;
    play.addEventListener('click', () => {
      if (frame.hasAttribute('data-playing')) return;
      const src = new URL(frame.dataset.trailerSrc, location.href);
      src.searchParams.set('autoplay', '1');
      src.searchParams.set('rel', '0');
      const player = document.createElement('iframe');
      player.src = src.toString();
      player.title = frame.dataset.trailerTitle || 'Trailer';
      player.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      player.allowFullscreen = true;
      player.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.append(player);
      frame.setAttribute('data-playing', '');
      player.focus();
    });
  });
})();

// ---------- Scroll motion ----------
(() => {
  'use strict';
  const story = document.querySelector('[data-story]');
  const { gsap, ScrollTrigger } = window;
  if (!story || !gsap || !ScrollTrigger || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  gsap.registerPlugin(ScrollTrigger);
  if (window.lenis) window.lenis.on('scroll', ScrollTrigger.update);

  const split = story.querySelector('.case');
  const stage = story.querySelector('[data-case-stage]');
  const media = gsap.matchMedia();

  media.add(SPLIT, () => {
    if (split && stage) {
      gsap.to(stage, {
        scale: 0.92, autoAlpha: 0.5, ease: 'none',
        scrollTrigger: { trigger: split, start: 'bottom bottom', end: 'bottom top', scrub: true }
      });
    }

    story.querySelectorAll('[data-case-text]').forEach(block => {
      gsap.fromTo(block, { autoAlpha: 1 }, {
        autoAlpha: 0.2, ease: 'none',
        scrollTrigger: { trigger: block, start: 'bottom 40%', end: 'bottom top', scrub: true }
      });
    });
  });

  const video = story.querySelector('[data-case-video] .case-video__frame');
  if (video) {
    gsap.fromTo(video, { scale: 0.84, borderRadius: 56 }, {
      scale: 1, borderRadius: 28, ease: 'none', clearProps: 'borderRadius',
      scrollTrigger: { trigger: video, start: 'top bottom', end: 'top 25%', scrub: true }
    });
  }

  // Text and cards only animate in on the wide split layout; phones and tablets show them straight away.
  media.add(SPLIT, () => {
    story.querySelectorAll('[data-case-text]:not([data-reveal-up]) > *').forEach(line => {
      if (line.closest('.case-row--intro')) return;
      gsap.from(line, {
        y: 40, autoAlpha: 0, duration: 1, ease: 'power3.out', clearProps: 'transform,opacity,visibility',
        scrollTrigger: { trigger: line, start: 'top 88%', toggleActions: 'play none none reverse' }
      });
    });

    story.querySelectorAll('[data-case-head]').forEach(head => {
      gsap.from(head, {
        y: 60, autoAlpha: 0, duration: 1.1, ease: 'power4.out', clearProps: 'transform,opacity,visibility',
        scrollTrigger: { trigger: head, start: 'top 85%', toggleActions: 'play none none reverse' }
      });
    });

    story.querySelectorAll('[data-case-card]').forEach((card, i) => {
      gsap.from(card, {
        y: 120, rotation: i % 2 ? 4 : -4, autoAlpha: 0, duration: 1.1, ease: 'back.out(1.1)', delay: i * 0.08,
        clearProps: 'transform,opacity,visibility',
        scrollTrigger: { trigger: card, start: 'top 92%', toggleActions: 'play none none reverse' }
      });
    });
  });

  addEventListener('pageshow', e => { if (e.persisted) ScrollTrigger.refresh(); });
})();
