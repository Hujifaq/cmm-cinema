(() => {
  const hero = document.querySelector(".cinema-hero");
  if (!hero || !window.gsap) return;

  const gsap = window.gsap;
  const media = gsap.matchMedia();
  const images = [
    ...hero.querySelectorAll("img"),
    ...[...hero.querySelectorAll(".hero-line image")].map(node => {
      const image = new Image();
      image.src = node.href.baseVal;
      return image;
    })
  ];
  let disposed = false;

  if (!document.hidden && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    hero.setAttribute("data-entering", "");
  }

  const artworkReady = Promise.allSettled([
    ...images.map(image => image.decode()),
    document.fonts.ready
  ]);

  const SVG_NS = "http://www.w3.org/2000/svg";

  const splitRow = (row, context) => {
    const text = row.querySelector("text");
    const letters = [...text.textContent];
    const layer = document.createElementNS(SVG_NS, "g");
    row.append(layer);
    context.add(() => () => layer.remove());

    const baseline = text.y.baseVal[0].value;
    const targetWidth = text.textLength.baseVal.value;
    const cells = letters.map(letter => {
      const glyph = text.cloneNode(false);
      ["x", "y", "textLength", "lengthAdjust", "text-anchor"].forEach(name => glyph.removeAttribute(name));
      glyph.setAttribute("x", "0");
      glyph.setAttribute("y", "0");
      glyph.textContent = letter;
      const inner = document.createElementNS(SVG_NS, "g");
      inner.setAttribute("class", "hero-title__char");
      inner.append(glyph);
      const outer = document.createElementNS(SVG_NS, "g");
      outer.append(inner);
      layer.append(outer);
      return { outer, inner, advance: glyph.getComputedTextLength() };
    });

    const natural = cells.reduce((sum, cell) => sum + cell.advance, 0);
    const scale = natural ? targetWidth / natural : 1;
    let x = text.x.baseVal[0].value - targetWidth / 2;
    const chars = cells.map(cell => {
      cell.outer.setAttribute("transform", `translate(${x} ${baseline}) scale(${scale} 1)`);
      x += cell.advance * scale;
      return cell.inner;
    });

    gsap.set(text, { visibility: "hidden" });
    return { chars };
  };

  const fitMasksToHero = context => {
    const bounds = hero.getBoundingClientRect();
    hero.querySelectorAll(".hero-line svg").forEach(svg => {
      const matrix = svg.getScreenCTM();
      if (!matrix) return;
      const inverse = matrix.inverse();
      const topLeft = new DOMPoint(bounds.left, bounds.top).matrixTransform(inverse);
      const bottomRight = new DOMPoint(bounds.right, bounds.bottom).matrixTransform(inverse);
      const pad = 4;
      svg.querySelectorAll("mask").forEach(mask => {
        const original = ["x", "y", "width", "height"].map(name => [name, mask.getAttribute(name)]);
        context.add(() => () => original.forEach(([name, value]) => mask.setAttribute(name, value)));
        mask.setAttribute("x", String(topLeft.x - pad));
        mask.setAttribute("y", String(topLeft.y - pad));
        mask.setAttribute("width", String(bottomRight.x - topLeft.x + pad * 2));
        mask.setAttribute("height", String(bottomRight.y - topLeft.y + pad * 2));
      });
    });
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
      fitMasksToHero(context);

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
