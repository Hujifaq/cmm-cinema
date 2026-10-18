(() => {
  'use strict';
  const colors = ['#34d399', '#f472b6', '#fb923c', '#60a5fa', '#a78bfa', '#facc15'];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const { gsap, SplitText } = window;
  if (gsap && SplitText) gsap.registerPlugin(SplitText);

  const FLY = 0.9;
  const fields = ['title', 'category', 'date', 'image', 'excerpt', 'url'];

  document.querySelectorAll('[data-news]').forEach(root => {
    const part = name => root.querySelector(`[data-news-${name}]`);
    const frame = part('frame');
    const image = part('image');
    const link = part('link');
    const wrapper = root.querySelector('[data-news-swiper] .swiper-wrapper');
    const lines = [part('meta'), part('title'), part('excerpt')];
    let current = Object.fromEntries(fields.map(key => [key, frame.dataset[key]]));
    let busy = false;

    let last = '';
    const randomize = () => {
      const options = colors.filter(color => color !== last);
      last = options[Math.floor(Math.random() * options.length)];
      link.style.setProperty('--highlight-color', last);
    };
    randomize();
    link.addEventListener('pointerenter', randomize);
    link.addEventListener('focus', randomize);

    const swiper = window.Swiper && new Swiper(root.querySelector('[data-news-swiper]'), {
      slidesPerView: 1.3,
      spaceBetween: 16,
      grabCursor: true,
      breakpoints: { 640: { slidesPerView: 2.2 }, 1024: { slidesPerView: 3 } },
      navigation: { prevEl: part('prev'), nextEl: part('next'), disabledClass: 'opacity-40' }
    });

    const writeText = story => {
      part('category').textContent = story.category;
      part('date').textContent = story.date;
      part('title').textContent = story.title;
      part('excerpt').textContent = story.excerpt;
      link.href = story.url;
    };

    const writeFeature = story => {
      image.src = story.image;
      image.alt = story.title;
    };

    // The story leaving the feature becomes a card again, reusing the clicked card's markup.
    const cardFor = (template, story) => {
      const slide = template.cloneNode(true);
      slide.removeAttribute('style');
      const thumb = slide.querySelector('[data-news-thumb]');
      fields.forEach(key => { thumb.dataset[key] = story[key]; });
      thumb.setAttribute('aria-label', `Show story: ${story.title}`);
      thumb.querySelector('img').src = story.image;
      return slide;
    };

    const replaceCard = (slide, fresh) => {
      if (swiper) {
        swiper.removeSlide(swiper.slides.indexOf(slide));
        swiper.prependSlide(fresh);
        swiper.slideTo(0, 0);
      } else {
        slide.remove();
        wrapper.prepend(fresh);
      }
    };

    // Old lines slide up out of their masks, then the new copy rises in line by line.
    const swapText = (tl, story) => {
      const outgoing = lines.map(el => SplitText.create(el, { type: 'lines', mask: 'lines' }));
      tl.to(outgoing.map(split => split.lines), {
        yPercent: -110, duration: 0.4, ease: 'power3.in', stagger: 0.04
      }, 0);
      tl.add(() => {
        outgoing.forEach(split => split.revert());
        writeText(story);
        const incoming = lines.map(el => SplitText.create(el, { type: 'lines', mask: 'lines' }));
        gsap.from(incoming.map(split => split.lines), {
          yPercent: 110, duration: 0.75, ease: 'power3.out', stagger: 0.06,
          onComplete: () => incoming.forEach(split => split.revert())
        });
      }, 0.45);
    };

    // The clicked card lifts out of the row and lands in the feature frame.
    const flyUp = (tl, thumb, story) => {
      const from = thumb.getBoundingClientRect();
      const to = frame.getBoundingClientRect();
      const clone = document.createElement('div');
      clone.className = 'pointer-events-none absolute z-50 overflow-hidden rounded-2xl shadow-2xl';
      clone.innerHTML = `<img class="size-full object-cover" alt="" src="${encodeURI(story.image)}">`;
      const place = rect => ({ left: rect.left + scrollX, top: rect.top + scrollY, width: rect.width, height: rect.height });
      gsap.set(clone, place(from));
      document.body.append(clone);
      tl.to(clone, { ...place(to), duration: FLY, ease: 'power3.inOut' }, 0);
      tl.to(image, { autoAlpha: 0.35, scale: 1.04, duration: FLY * 0.6, ease: 'power2.in' }, 0);
      tl.add(() => {
        writeFeature(story);
        gsap.set(image, { clearProps: 'opacity,visibility,transform' });
        clone.remove();
      }, FLY);
    };

    // Cards close the gap with FLIP, while the returning story enters from the left edge of the screen.
    const reflowRow = (tl, slide, fresh) => {
      const others = [...wrapper.children].filter(el => el !== slide);
      const before = new Map(others.map(el => [el, el.getBoundingClientRect().left]));
      replaceCard(slide, fresh);
      others.forEach(el => {
        const dx = before.get(el) - el.getBoundingClientRect().left;
        if (dx) tl.fromTo(el, { x: dx }, { x: 0, duration: 0.8, ease: 'power3.inOut', clearProps: 'transform' }, 0.1);
      });
      const offscreen = -(fresh.getBoundingClientRect().right + 40);
      tl.fromTo(fresh, { x: offscreen }, { x: 0, duration: 1, ease: 'power3.out', clearProps: 'transform' }, 0.25);
    };

    const show = thumb => {
      if (busy) return;
      const slide = thumb.closest('.swiper-slide');
      const story = Object.fromEntries(fields.map(key => [key, thumb.dataset[key]]));
      const fresh = cardFor(slide, current);
      current = story;
      fields.forEach(key => { frame.dataset[key] = story[key]; });

      if (!gsap || !SplitText || reduced.matches) {
        replaceCard(slide, fresh);
        writeFeature(story);
        writeText(story);
        return;
      }

      busy = true;
      const tl = gsap.timeline({ onComplete: () => { busy = false; } });
      flyUp(tl, thumb, story);
      reflowRow(tl, slide, fresh);
      swapText(tl, story);
    };

    wrapper.addEventListener('click', event => {
      const thumb = event.target.closest('[data-news-thumb]');
      if (thumb) show(thumb);
    });
  });
})();
