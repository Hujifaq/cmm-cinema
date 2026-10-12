(() => {
  const hero = document.querySelector(".cinema-hero");
  if (!hero || !window.gsap) return;

  const gsap = window.gsap;
  const SplitText = window.SplitText;
  if (SplitText) gsap.registerPlugin(SplitText);
  const media = gsap.matchMedia();
  const images = [...hero.querySelectorAll("img")];
  let disposed = false;

  if (!document.hidden && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    hero.setAttribute("data-entering", "");
  }

  const artworkReady = Promise.allSettled([
    ...images.map(image => image.decode()),
    document.fonts.ready
  ]);

  const splitRow = (row, context) => {
    const text = row.querySelector("text");
    const svg = text.ownerSVGElement;
    const layer = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
    layer.setAttribute("x", "0");
    layer.setAttribute("y", String(text.y.baseVal[0].value - 200));
    layer.setAttribute("width", String(svg.viewBox.baseVal.width));
    layer.setAttribute("height", "260");
    layer.classList.add("overflow-visible");

    const fit = document.createElement("div");
    fit.className = "hero-title__split absolute left-1/2 top-0 w-max whitespace-nowrap text-[200px] leading-none font-black tracking-[-12px] text-cinema-cream";
    const word = document.createElement("span");
    word.className = "inline-block";
    word.textContent = text.textContent;
    const baseline = document.createElement("span");
    baseline.className = "inline-block h-0 w-0";
    fit.append(word, baseline);
    layer.append(fit);
    row.append(layer);
    // Register cleanup before splitting so failed initialization also restores
    // the original SVG, as do pagehide and reduced-motion preference changes.
    context.add(() => () => layer.remove());

    const split = SplitText.create(word, { type: "chars", aria: "none", charsClass: "hero-title__char" });
    const svgScale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
    const width = word.getBoundingClientRect().width / svgScale;
    const baselineY = (baseline.getBoundingClientRect().top - fit.getBoundingClientRect().top) / svgScale;
    fit.style.transform = `translate(-50%, ${200 - baselineY}px) scaleX(${text.textLength.baseVal.value / width})`;
    gsap.set(text, { visibility: "hidden" });
    return split;
  };

  const start = () => {
    if (disposed || document.hidden) {
      hero.removeAttribute("data-entering");
      return;
    }

    media.add({
      motion: "(prefers-reduced-motion: no-preference)",
      reduced: "(prefers-reduced-motion: reduce)"
    }, context => {
      
      if (context.conditions.reduced) return;

      const cmmRows = hero.querySelectorAll(".hero-title__row--cmm");
      const cinemaRows = hero.querySelectorAll(".hero-title__row--cinema");
      const props = hero.querySelectorAll(".hero-prop");
      let stopPhysics = () => {};

      const intro = gsap.timeline({ defaults: { ease: "power3.out" } });

      // The large crossing consists of two complete, independent tubes.
      // Rear draws upward; front starts separately and draws down, then right.
      hero.querySelectorAll("[data-independent-reveal]").forEach(artwork => {
        const maskId = artwork.dataset.independentReveal;
        const trace = hero.querySelector(`#${maskId} .hero-line__independent-trace`);
        const duration = Number(trace.dataset.duration);
        const delay = Number(trace.dataset.delay);

        gsap.set(trace, { attr: { "stroke-dasharray": "1000 1000", "stroke-dashoffset": 1000 } });
        gsap.set(artwork, { opacity: 0, attr: { mask: `url(#${maskId})` } });
        intro
          .set(artwork, { opacity: 1 }, delay)
          .to(trace, { attr: { "stroke-dashoffset": 0 }, duration, ease: "power2.out" }, delay)
          .set(artwork, { attr: { mask: "none" } }, delay + duration);
      });

      hero.querySelectorAll("svg[data-line-duration]").forEach(svg => {
        const traces = [...svg.querySelectorAll(".hero-line__trace")];
        const artwork = [...svg.querySelectorAll("[data-reveal-mask]")];
        const duration = Number(svg.dataset.lineDuration);
        const delay = Number(svg.dataset.lineDelay);
        const progress = { value: 0 };

        traces.forEach(path => {
          gsap.set(path, { attr: { "stroke-dasharray": "1000 1000", "stroke-dashoffset": 1000 } });
        });
        artwork.forEach(node => {
          gsap.set(node, { opacity: 0, attr: { mask: `url(#${node.dataset.revealMask})` } });
        });

        // One continuous distance drives both parts. Their separate vector regions
        // prevent the rear stroke from revealing the front at a self-intersection.
        intro.to(progress, {
          value: 1,
          duration,
          ease: "power2.out",
          onUpdate: () => traces.forEach((path, index) => {
            const start = Number(path.dataset.start);
            const end = Number(path.dataset.end);
            const local = gsap.utils.clamp(0, 1, (progress.value - start) / (end - start));
            path.setAttribute("stroke-dashoffset", String(1000 * (1 - local)));
            artwork[index].style.opacity = local > 0 ? "1" : "0";
          })
        }, delay)
          // Resting artwork never depends on the reveal mask's bounds.
          .set(artwork, { opacity: 1, attr: { mask: "none" } }, delay + duration);
      });

      if (SplitText) {
        [[cmmRows, 0.18], [cinemaRows, 0.32]].forEach(([rows, start]) => {
          const layers = [...rows].map(row => splitRow(row, context));
          layers[0].chars.forEach((_, index) => {
            // Tween each fill/outline pair together, staggering by letter rather
            // than by layer so the foreground outline never drifts from its fill.
            const pair = layers.map(layer => layer.chars[index]);
            const at = start + index * 0.065;
            intro
              .from(pair, { scale: 0.1, transformOrigin: "50% 75%", duration: 1.15, ease: "elastic.out(1, 0.45)" }, at)
              .from(pair, { opacity: 0, duration: 0.18, ease: "power1.out" }, at);
          });
        });
      } else {
        // Keep the original whole-word entrance if the optional plugin fails.
        intro
          .from(cmmRows, { scale: 0.45, opacity: 0, svgOrigin: "395 72.5", duration: 1.2, ease: "elastic.out(1, 0.5)" }, 0.18)
          .from(cinemaRows, { scale: 0.45, opacity: 0, svgOrigin: "395 237.5", duration: 1.2, ease: "elastic.out(1, 0.5)" }, 0.32);
      }
      
      const propsStart = Math.max(0, intro.duration() - 1);
      if (window.CinemaHeroPhysics) {
        gsap.set(props, { visibility: "hidden" });
        intro.call(() => {
          if (disposed) return;
         
          stopPhysics = window.CinemaHeroPhysics.mount(hero, [...props], { throwIn: true });
        }, null, propsStart)
          .set(props, { visibility: "visible" }, propsStart);
      } else {
        intro.from(props, {
          x: (_, prop) => {
            const radius = Math.hypot(prop.offsetWidth, prop.offsetHeight);
            return prop.offsetLeft < hero.clientWidth / 2
              ? -prop.offsetLeft - radius - 24
              : hero.clientWidth - prop.offsetLeft + radius + 24;
          },
          y: () => hero.clientHeight * 0.1,
          rotation: (_, prop) => prop.offsetLeft < hero.clientWidth / 2 ? -65 : 65,
          duration: 1.6, ease: "back.out(1.4)", stagger: 0.09
        }, propsStart);
      }

      // Stop the simulation when leaving the page or changing motion preference.
      return () => stopPhysics();
    }, hero);
  };

  // A failed or slow asset must never leave the page hidden or block the reveal.
  let timeout;
  const deadline = new Promise(resolve => { timeout = window.setTimeout(resolve, 1600); });
  Promise.race([artworkReady, deadline]).then(() => {
    window.clearTimeout(timeout);
    try {
      start();
    } catch (error) {
      media.revert();
      console.error("The cinema entrance could not start.", error);
    } finally {
      hero.removeAttribute("data-entering");
    }
  });

  window.addEventListener("pagehide", () => {
    disposed = true;
    window.clearTimeout(timeout);
    media.revert();
    hero.removeAttribute("data-entering");
  }, { once: true });
})();
