// Home page promotions: the 3D "ribbon" card carousel, adapted to live inside one section.
// Cards wrap endlessly and bend on a curved ribbon drawn with WebGL (CSS 3D when WebGL is missing).
// Drag, swipe, sideways trackpad scroll, the arrow buttons and the page scroll all move it.
(() => {
  const SMALL = 0;
  // How much of the original 3D shaping to keep: 1 = the full ribbon, 0 = completely flat cards.
  const EMBOSS = 0.3;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  const CFG = {
    ease: 0.1,          // how quickly the strip catches up (per 60fps frame)
    dragSpeed: 1.5,     // drag distance multiplier
    flingSpeed: 12,     // extra push when a drag is released while moving
    flingWindow: 100,   // ms: a release counts as a fling within this time
    dragThreshold: 10,  // px before a press becomes a drag
    leash: 1,           // the target may run at most this many screen widths ahead
    fov: 75, camZ: 27,  // camera
    depth: 0.2 * EMBOSS,         // how far the ribbon dives, share of the half-width
    speedDepth: 1.1 * EMBOSS,    // extra dive at full speed
    span: 1.15,         // how much of the frame the curve spans
    door: -0.12 * EMBOSS,        // the whole ribbon turns like a door by this much
    shadeSpread: 1,
    speedNorm: 550,     // px of lag that counts as "fast"
    speedNormSmall: 245,
    dent: 0.1 * EMBOSS,          // hover: how far the middle bows back, share of height
    floorDrop: 0.06,    // floor sits this far below the cards (share of half-height)
    reflection: 0.5,
    intro: { at: 0.1, dur: 1.25, stagger: 0.05, from: 0.5 },
  };

  // The ribbon's fixed shape constants
  const SHEET = { bank: -0.16 * EMBOSS, diag: 0.03 * EMBOSS, rearY: 0.1 * EMBOSS, rearZ: 0.2 * EMBOSS, vtwist: 1.8 * EMBOSS, tail: 1, shift: -0.2 };

  const lerp = (a, b, t) => a + (b - a) * t;
  const damp = (a, b, t, dt) => lerp(a, b, 1 - Math.pow(1 - t, dt * 60));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const wrap = (min, max, v) => { const r = max - min; return r <= 0 ? min : min + ((((v - min) % r) + r) % r); };
  const expoOut = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
  const remPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 10;
  const isMouse = matchMedia("(hover: hover) and (pointer: fine)");

  const ARROW_SVG = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 8h11M9 4l4 4-4 4"/></svg>';

  /* ---------------- The ribbon maths (shared by WebGL and CSS) ---------------- */
  function shape(q, c) {
    return lerp(1 - q * q, Math.sin(Math.PI * q), c) * Math.exp(-SHEET.tail * q * q);
  }
  function shapeSlope(q, c) {
    const g = Math.exp(-SHEET.tail * q * q);
    const bowl = -2 * q * (1 + SHEET.tail * (1 - q * q));
    const ess = Math.PI * Math.cos(Math.PI * q) - 2 * SHEET.tail * q * Math.sin(Math.PI * q);
    return lerp(bowl, ess, c) * g;
  }
  const leanRamp = (s) => { s = clamp(s, -1, 1); return s * (1.5 - 0.5 * s * s); };
  const leanSlope = (s) => { s = Math.min(Math.abs(s), 1); return 1.5 * (1 - s * s); };

  /* ---------------- Carousel ---------------- */
  class Carousel {
    constructor(root) {
      this.root = root;
      this.track = root.querySelector("[data-track]");
      this.originals = [...this.track.querySelectorAll("[data-card]")];
      this.cards = [];
      this.originals.forEach((el, i) => this.adopt(el, i));

      this.target = 0;
      this.current = 0;
      this.max = 0;
      this.period = 0;
      this.speed = 0;      // 0..1, smoothed scroll speed for the ribbon
      this.started = 0;
      this.ground = 0;

      this.gl = Renderer.create(this);
      if (this.gl) root.classList.add("is-gl");

      this.bindInput();
      this.measure(true);
      window.addEventListener("resize", () => this.measure(false));

      this.visible = false;
      this.introDone = false;
      this.last = performance.now();
      this.started = Infinity;
      new IntersectionObserver(([entry]) => {
        this.visible = entry.isIntersecting;
        if (this.visible && !this.introDone) {
          this.introDone = true;
          this.started = performance.now();
          this.introOrder();
        }
      }, { rootMargin: "100px 0px" }).observe(root);
      requestAnimationFrame((t) => this.tick(t));
    }

    /* Prepare one card: its picture (video or placeholder), arrow and hover. */
    adopt(el, index) {
      const media = el.querySelector(".card-media");
      const ratio = this.ratio(el);
      let source = media.querySelector("video, canvas, img");

      if (!source) {
        const src = el.dataset.video;
        if (src) {
          source = document.createElement("video");
          source.src = src;
          source.muted = true;
          source.loop = true;
          source.playsInline = true;
          source.autoplay = true;
          source.preload = "auto";
          source.crossOrigin = "anonymous";
          if (el.dataset.poster) source.poster = el.dataset.poster;
          source.setAttribute("muted", "");
          source.setAttribute("playsinline", "");
        } else if (window.CardPlaceholder) {
          source = window.CardPlaceholder.create(Number(el.dataset.seed ?? index), ratio);
        }
        if (source) media.appendChild(source);
      }
      if (source && source.tagName === "VIDEO") {
        const play = () => source.play().catch(() => {});
        play();
        document.addEventListener("pointerdown", play, { once: true });
      }

      const arrow = el.querySelector(".card-arrow");
      if (arrow && !arrow.children.length) arrow.innerHTML = `<i>${ARROW_SVG}</i><i>${ARROW_SVG}</i>`;

      const card = {
        el, media, source, ratio,
        title: el.querySelector(".card-title")?.textContent.trim() || "",
        base: null, rect: { left: 0, top: 0, width: 0, height: 0 },
        hover: 0, hoverTarget: 0, ox: 0, alpha: 0, delay: 0, introFrom: 0,
        mx: 0, my: 0, tmx: 0, tmy: 0, // pointer over the card, -1..1 (no-WebGL hover)
      };
      el.addEventListener("pointermove", (e) => {
        if (e.pointerType !== "mouse") return;
        const r = el.getBoundingClientRect();
        card.tmx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
        card.tmy = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
      });
      el.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") card.hoverTarget = 1; });
      el.addEventListener("pointerleave", () => { card.hoverTarget = 0; });
      el.addEventListener("click", (e) => {
        if (this.suppress) { e.preventDefault(); return; }
        const href = el.dataset.href;
        if (href && href !== "#") window.location.href = href;
      });
      this.cards.push(card);
      return card;
    }

    ratio(el) {
      const r = el.dataset.ratio || "16/10";
      const [a, b] = r.split("/").map(Number);
      el.style.aspectRatio = `${a} / ${b || 1}`;
      return a / (b || 1);
    }

    /* Read where CSS put each card, and how long one lap of the row is. */
    measure(first) {
      const box = this.root.getBoundingClientRect();
      const ww = box.width;
      const wh = box.height;
      const small = ww < SMALL;
      const wasSmall = this.small;
      // remember which card was in the middle, to keep it there after the resize
      const keep = first ? 0 : this.nearest();
      this.small = small;
      this.ww = ww;
      this.wh = wh;
      this.rem = remPx();
      this.radius = ww < 768 ? 16 : 28;

      const read = () => {
        for (const c of this.cards) c.el.style.transform = "";
        const outer = this.root.getBoundingClientRect();
        this.outer = outer;
        for (const c of this.cards) {
          const r = c.el.getBoundingClientRect();
          const left = r.left - outer.left, top = r.top - outer.top;
          c.base = { left, top, width: r.width, height: r.height, right: left + r.width, bottom: top + r.height };
        }
      };
      read();

      if (!small) {
        // Make sure one lap is wider than the screen, so the loop never shows a gap.
        const maxW = Math.max(...this.cards.map((c) => c.base.width));
        let guard = 0;
        while (this.lap() < ww * 1.5 + maxW * 2 && guard++ < 6) {
          this.originals.forEach((el, i) => {
            const clone = el.cloneNode(true);
            const cloneMedia = clone.querySelector(".card-media");
            if (!cloneMedia.querySelector("img")) cloneMedia.innerHTML = "";
            clone.setAttribute("aria-hidden", "true");
            clone.dataset.clone = "";
            clone.dataset.seed = el.dataset.seed ?? i;
            this.track.appendChild(clone);
            const c = this.adopt(clone, i);
            if (!first) { c.alpha = 1; c.done = true; } // late clones skip the intro
          });
          read();
        }
        this.period = this.lap();
      } else {
        const cs = getComputedStyle(this.track);
        const pad = parseFloat(cs.paddingBottom) || 0;
        const bottom = Math.max(...this.cards.filter((c) => !c.el.hasAttribute("data-clone")).map((c) => c.base.bottom));
        this.max = Math.max(0, bottom - this.outer.top + pad + this.rem * 2 - this.outer.height);
      }

      // Hide clones on phones (the list is finite there).
      for (const c of this.cards) {
        if (c.el.hasAttribute("data-clone")) c.el.style.display = small ? "none" : "";
      }
      if (small !== wasSmall && wasSmall !== undefined) read();

      if (first || small !== wasSmall) this.center(0);
      else if (!small && Math.abs(ww - this.lastW) > 0.5) this.center(keep);
      this.lastW = ww;
      this.gl?.resize();
      this.layout();
    }

    nearest() {
      if (this.small) return 0;
      let best = 0, dist = Infinity;
      this.cards.forEach((c, i) => {
        if (!c.base || c.el.style.display === "none") return;
        const d = Math.abs(c.rect.left + c.rect.width / 2 - this.ww / 2);
        if (d < dist) { dist = d; best = i; }
      });
      return best;
    }

    lap() {
      const shown = this.cards.filter((c) => c.el.style.display !== "none");
      if (!shown.length) return 0;
      const gap = parseFloat(getComputedStyle(this.track).columnGap) || 0;
      const first = shown[0].base;
      const last = shown[shown.length - 1].base;
      return last.right + gap - first.left;
    }

    /* Put card i in the middle of the screen (or at the top on phones). */
    center(i) {
      const c = this.cards[i];
      if (!c) return;
      if (this.small) {
        this.target = this.current = 0;
      } else {
        this.target = this.current = c.base.left + c.base.width / 2 - this.ww / 2;
      }
    }

    /* ---------------- Input ---------------- */
    push(delta) {
      if (this.glide) { this.target = this.current; this.glide = null; }
      if (this.small) {
        this.target = clamp(this.target + delta, 0, this.max);
      } else {
        this.target += delta;
        // Keep the target on a leash so a huge flick can't run away.
        const t = this.ww * CFG.leash;
        this.target = this.current + Math.tanh((this.target - this.current) / t) * t;
      }
    }

    /* One arrow press: land the next card exactly in the middle. Every promo card has the same width,
       so card centres sit on an even grid and repeated presses keep adding up. */
    go(dir) {
      const [a, b] = this.cards;
      if (!a?.base || !b?.base) return;
      const pitch = b.base.left - a.base.left;
      const first = a.base.left + a.base.width / 2;
      const from = this.glide ? this.glide.to : this.target;
      const x = (from + this.ww / 2 - first) / pitch;
      const k = dir > 0 ? Math.floor(x + 0.25) + 1 : Math.ceil(x - 0.25) - 1;
      const to = first + k * pitch - this.ww / 2;
      this.glide = { from: this.current, to, start: performance.now(), dur: reducedMotion.matches ? 1 : 850 };
    }

    bindInput() {
      const root = this.root;

      // Sideways trackpad / shift-wheel over the carousel moves it; ordinary vertical wheel keeps scrolling the page.
      root.addEventListener("wheel", (e) => {
        if (e.ctrlKey) return;
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.wh : 1;
        const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
        if (Math.abs(dx) <= Math.abs(e.deltaY) && !e.shiftKey) return;
        e.preventDefault();
        this.push(dx * unit);
      }, { passive: false });

      // Scrolling the page past the section nudges the ribbon along with it.
      let lastY = window.scrollY;
      window.addEventListener("scroll", () => {
        const y = window.scrollY;
        const d = y - lastY;
        lastY = y;
        if (!this.visible || reducedMotion.matches || !d) return;
        if (this.glide) { this.glide.from += d * 0.6; this.glide.to += d * 0.6; }
        else this.push(d * 0.6);
      }, { passive: true });

      root.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); this.go(1); }
        if (e.key === "ArrowLeft") { e.preventDefault(); this.go(-1); }
      });

      root.classList.add("grabbable");
      let down = false, dragging = false, sx = 0, sy = 0, last = 0, f = 0, ft = 0;

      const move = (e) => {
        if (!dragging) {
          const dx = Math.abs(e.clientX - sx);
          const dy = Math.abs(e.clientY - sy);
          if (dx <= CFG.dragThreshold || dx <= dy) {
            if (dy > CFG.dragThreshold && dy > dx) end(e, false);
            return;
          }
          dragging = true;
          this.suppress = true;
          root.classList.add("grabbing");
          last = e.clientX;
        }
        e.preventDefault();
        const p = e.clientX;
        f = (last - p) * CFG.dragSpeed;
        ft = e.timeStamp;
        last = p;
        if (f) this.push(f);
      };
      const end = (e, fling) => {
        down = false;
        if (dragging) {
          dragging = false;
          root.classList.remove("grabbing");
          if (fling && f && e.timeStamp - ft < CFG.flingWindow) this.push(f * CFG.flingSpeed);
          setTimeout(() => (this.suppress = false), 0);
        }
        f = 0;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", cancel);
      };
      const up = (e) => end(e, true);
      const cancel = (e) => end(e, false);

      root.addEventListener("pointerdown", (e) => {
        if (down || e.button !== 0) return;
        down = true;
        sx = e.clientX;
        sy = e.clientY;
        f = 0;
        this.suppress = false;
        window.addEventListener("pointermove", move, { passive: false });
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", cancel);
      });
    }

    /* ---------------- Intro: cards slide in from the side and fade up ---------------- */
    introOrder() {
      const mid = this.ww / 2;
      const shown = this.cards.filter((c) => !c.done && c.el.style.display !== "none");
      const onScreen = shown
        .map((c) => ({ c, d: c.rect.left + c.rect.width / 2 - mid }))
        .filter(({ c }) => c.rect.left < this.ww && c.rect.left + c.rect.width > 0 && c.rect.top < this.wh && c.rect.top + c.rect.height > 0)
        .sort((a, b) => Math.abs(a.d) - Math.abs(b.d));
      const from = this.small ? 0 : CFG.intro.from;
      onScreen.forEach(({ c, d }, i) => {
        c.delay = CFG.intro.at + i * CFG.intro.stagger;
        c.introFrom = Math.sign(d || 1) * (this.ww / 2) * from;
      });
      for (const c of shown) if (!onScreen.find((o) => o.c === c)) { c.delay = 0; c.introFrom = 0; c.alpha = 1; c.done = true; }
    }

    /* ---------------- Every frame ---------------- */
    tick(now) {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;

      if (this.glide) {
        const g = this.glide;
        const p = clamp((now - g.start) / g.dur, 0, 1);
        const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        this.current = this.target = g.from + (g.to - g.from) * e;
        if (p >= 1) this.glide = null;
      } else {
        this.current = damp(this.current, this.target, CFG.ease, dt);
        this.current = Math.round(this.current * 100) / 100;
      }

      const lag = this.target - this.current;
      const norm = this.small ? CFG.speedNormSmall : CFG.speedNorm;
      const t = Math.tanh(lag / norm);
      this.speed = Math.min(1, Math.abs(t * Math.abs(t)));

      const since = Math.max(0, (now - this.started) / 1000);
      for (const c of this.cards) {
        c.hover = damp(c.hover, c.hoverTarget, 0.12, dt);
        c.mx = damp(c.mx, c.hoverTarget ? c.tmx : 0, 0.12, dt);
        c.my = damp(c.my, c.hoverTarget ? c.tmy : 0, 0.12, dt);
        if (!c.done) {
          const p = clamp((since - c.delay) / CFG.intro.dur, 0, 1);
          c.ox = c.introFrom * (1 - expoOut(p));
          c.alpha = clamp((since - c.delay) / (CFG.intro.dur * 0.5), 0, 1);
          c.alpha = 1 - (1 - c.alpha) * (1 - c.alpha);
          if (p >= 1) { c.done = true; c.ox = 0; c.alpha = 1; }
        }
      }
      this.ground = clamp((since - 0.15) / 1.1, 0, 1);

      if (this.visible) {
        this.layout();
        if (this.gl) this.gl.render(now / 1000);
      }
      requestAnimationFrame((n) => this.tick(n));
    }

    /* Move every card to where the current position says it should be. */
    layout() {
      const persp = (this.wh / 2) / Math.tan((CFG.fov * Math.PI) / 360);
      if (!this.gl) this.root.style.perspective = `${persp}px`;

      for (const c of this.cards) {
        if (!c.base || c.el.style.display === "none") continue;
        let x = 0, y = 0;
        if (this.small) {
          y = this.current;
        } else {
          const end = c.base.right;
          x = wrap(-(this.period - end), end, this.current);
        }
        c.rect.left = c.base.left - x;
        c.rect.top = c.base.top - y;
        c.rect.width = c.base.width;
        c.rect.height = c.base.height;

        if (this.gl || this.small) {
          c.el.style.transform = `translate3d(${-x}px, ${-y}px, 0)`;
        } else {
          c.el.style.transform = this.cssPose(c, x, persp);
          // the hover without WebGL: the card gives under the pointer like cloth
          c.el.style.setProperty("--hover", c.hover.toFixed(3));
          c.el.style.setProperty("--mx", `${((c.mx + 1) * 50).toFixed(1)}%`);
          c.el.style.setProperty("--my", `${((c.my + 1) * 50).toFixed(1)}%`);
        }
        if (!this.gl) {
          c.el.style.opacity = c.alpha;
          if (this.small) c.el.style.transform = `translate3d(${c.ox}px, ${-y}px, 0)`;
        }
      }
    }

    /* The CSS stand-in for the ribbon: each card is placed and turned rigidly
       to follow the curve at its centre (used only when WebGL is missing). */
    cssPose(c, x, persp) {
      const ww = this.ww, wh = this.wh;
      const H = Math.tan((CFG.fov * Math.PI) / 360) * CFG.camZ;
      const k = (2 * H) / wh;                     // world units per px
      const W = H * (ww / wh);
      const D = W * CFG.depth * (1 + CFG.speedDepth * this.speed);
      const A = W * CFG.door;
      const cx = (c.rect.left + c.rect.width / 2 + c.ox - ww / 2) * k;
      const half = (c.rect.width / 2) * k;
      // depth of the ribbon at a world x, including the rear-up with speed
      const zAt = (wx) => {
        const q = (wx / W) * CFG.span + SHEET.shift;
        const m = 1 - smooth(-1, 0.3, wx / W);
        return -D * shape(q, 1) + A * leanRamp(wx / W) + SHEET.rearZ * W * this.speed * m;
      };
      // a flat card can't bend, so lay it on the chord between its two edges
      const zl = zAt(cx - half);
      const zr = zAt(cx + half);
      const z = Math.min((zl + zr) / 2 * 0.6 + zAt(cx) * 0.4, CFG.camZ * 0.5);
      const angle = Math.atan2(zr - zl, half * 2);
      const q = (cx / W) * CFG.span + SHEET.shift;
      const qe = cx / W;
      let roll = (SHEET.bank * shapeSlope(q, 1)) / Math.PI;
      roll += SHEET.vtwist * this.speed * smooth(0.3, 0.9, Math.abs(qe)) * Math.sign(qe) * 0.35;
      const lift = SHEET.diag * cx + SHEET.rearY * W * this.speed * (1 - smooth(-1, 0.3, qe));
      return `translate3d(${-x + c.ox}px, ${-lift / k}px, ${z / k}px) rotateZ(${-Math.atan(SHEET.diag)}rad) rotateY(${-angle}rad) rotateX(${-roll}rad)` +
        ` rotateY(${c.mx * 7 * c.hover}deg) rotateX(${-c.my * 7 * c.hover}deg) translateZ(${-c.hover * c.rect.height * CFG.dent * 0.5}px)`;
    }
  }

  function smooth(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

  /* ==========================================================================
     WebGL renderer
     ========================================================================== */
  const VERT = `
precision highp float;
attribute vec2 a_pos;
uniform mat4 u_proj;
uniform mat4 u_view;
uniform vec4 u_rect;      // centre x, centre y, width, height (world units)
uniform float u_sheetW;   // frustum half-width at z=0 (0 = ribbon off)
uniform float u_sheetD;   // depth of the dive
uniform float u_sheetT;   // span
uniform float u_sheetV;   // speed 0..1
uniform float u_leanA;    // door depth at the frame edge
uniform float u_hover;
uniform float u_dent;
uniform float u_mirror;
uniform float u_floorY;
varying vec2 vUv;
varying vec3 vFlat;

const float PI = 3.141592653589793;
const float BANK = ${SHEET.bank.toFixed(3)};
const float DIAG = ${SHEET.diag.toFixed(3)};
const float REAR_Y = ${SHEET.rearY.toFixed(3)};
const float REAR_Z = ${SHEET.rearZ.toFixed(3)};
const float VTWIST = ${SHEET.vtwist.toFixed(3)};
const float TAIL = ${SHEET.tail.toFixed(3)};
const float SHIFT = ${SHEET.shift.toFixed(3)};

float sheetQ(float wx) { return wx / max(u_sheetW, 0.0001) * u_sheetT + SHIFT; }
float shapeS(float q) { return sin(PI * q) * exp(-TAIL * q * q); }
float shapeSlope(float q) {
  return (PI * cos(PI * q) - 2.0 * TAIL * q * sin(PI * q)) * exp(-TAIL * q * q);
}
float leanRamp(float s) { s = clamp(s, -1.0, 1.0); return s * (1.5 - 0.5 * s * s); }
float dome(vec2 uv) { vec2 q = uv * 2.0 - 1.0; return (1.0 - q.x * q.x) * (1.0 - q.y * q.y); }

void main() {
  vUv = a_pos + 0.5;
  vec4 w = vec4(u_rect.x + a_pos.x * u_rect.z, u_rect.y + a_pos.y * u_rect.w, 0.0, 1.0);
  vFlat = w.xyz;

  // the hover bows the middle of the card back
  w.z -= u_hover * u_dent * u_rect.w * dome(vUv);

  if (u_sheetW > 0.001) {
    // bank with the curve, and wring the outer cards while moving fast
    float a = BANK * shapeSlope(sheetQ(w.x)) / PI;
    if (u_sheetV > 0.001) {
      float qe = w.x / u_sheetW;
      a += VTWIST * u_sheetV * smoothstep(0.3, 0.9, abs(qe)) * sign(qe);
    }
    float s = sin(a);
    float c = cos(a);
    w = vec4(w.x, w.y * c - w.z * s, w.y * s + w.z * c, 1.0);

    // the S in depth: near on the left, far on the right
    w.z += -u_sheetD * shapeS(sheetQ(w.x));

    // a whisper of a diagonal, and the left side rearing up with speed
    float qw = w.x / u_sheetW;
    w.y += DIAG * w.x;
    if (u_sheetV > 0.001) {
      float m = 1.0 - smoothstep(-1.0, 0.3, qw);
      w.y += REAR_Y * u_sheetW * u_sheetV * m;
      w.z += REAR_Z * u_sheetW * u_sheetV * m;
    }

    // the whole strip turns slightly, like a door
    w.z += u_leanA * leanRamp(w.x / u_sheetW);
  }

  if (u_mirror > 0.5) w.y = 2.0 * u_floorY - w.y;

  gl_Position = u_proj * u_view * w;
}`;

  const FRAG = `
#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform sampler2D u_tex;
uniform sampler2D u_label;
uniform vec2 u_size;      // picture size in px, for the cover fit
uniform vec4 u_rect;
uniform float u_alpha;
uniform float u_corner;   // corner radius / height
uniform float u_labelH;   // label strip height / card height
uniform float u_hasLabel;
uniform float u_mirror;
uniform float u_reflect;
uniform float u_sheetW;
uniform float u_sheetD;
uniform float u_sheetT;
uniform float u_leanA;
uniform float u_hover;
uniform float u_dent;
uniform float u_shadeS;
uniform vec3 u_cam;
varying vec2 vUv;
varying vec3 vFlat;

const float PI = 3.141592653589793;
const float BANK = ${SHEET.bank.toFixed(3)};
const float TAIL = ${SHEET.tail.toFixed(3)};
const float SHIFT = ${SHEET.shift.toFixed(3)};
const vec3 LIGHT_DIR = normalize(vec3(-0.4, 0.5, 1.0));
const float LIGHT_GLOSS = 48.0;
const float LIGHT_SPEC = ${(0.35 * EMBOSS).toFixed(4)};
const float LIGHT_DIFF = ${(0.12 * EMBOSS).toFixed(4)};

float sheetQ(float wx) { return wx / max(u_sheetW, 0.0001) * u_sheetT + SHIFT; }
float shapeS(float q) { return sin(PI * q) * exp(-TAIL * q * q); }
float shapeSlope(float q) {
  return (PI * cos(PI * q) - 2.0 * TAIL * q * sin(PI * q)) * exp(-TAIL * q * q);
}
float sheetZ(float wx) { return -u_sheetD * shapeS(sheetQ(wx)); }
float leanRamp(float s) { s = clamp(s, -1.0, 1.0); return s * (1.5 - 0.5 * s * s); }
float leanSlope(float s) { s = min(abs(s), 1.0); return 1.5 * (1.0 - s * s); }
float dome(vec2 uv) { vec2 q = uv * 2.0 - 1.0; return (1.0 - q.x * q.x) * (1.0 - q.y * q.y); }

vec2 uvCover(vec2 res, vec2 size, vec2 uv) {
  float rp = res.x / max(res.y, 0.0001);
  float ri = size.x / max(size.y, 0.0001);
  vec2 s = rp > ri ? vec2(1.0, ri / rp) : vec2(rp / ri, 1.0);
  return (uv - 0.5) * s + 0.5;
}

float roundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 res = u_rect.zw;
  vec3 col = texture2D(u_tex, uvCover(res, u_size, vUv)).rgb;

  if (u_sheetW > 0.001 && u_sheetD > 0.001) {
    // the far side of the ribbon falls into shadow
    float depth = clamp((u_sheetD - sheetZ(vFlat.x)) / (2.0 * u_sheetD), 0.0, 1.0);
    depth += (u_hover * u_dent * res.y * dome(vUv)) / (2.0 * u_sheetD);
    depth = clamp(depth, 0.0, 1.0);
    col = mix(col, vec3(0.059), ${(0.8 * EMBOSS).toFixed(4)} * pow(depth, u_shadeS));

    // a soft sheen from the surface's own slope
    float dzdx = -u_sheetD * shapeSlope(sheetQ(vFlat.x)) * u_sheetT / u_sheetW;
    dzdx += (u_leanA / u_sheetW) * leanSlope(vFlat.x / u_sheetW);
    float dzdy = 0.0;
    if (u_hover > 0.0001) {
      vec2 q = vUv * 2.0 - 1.0;
      float a = u_hover * u_dent;
      dzdx += 4.0 * a * res.y * q.x * (1.0 - q.y * q.y) / max(res.x, 0.0001);
      dzdy += 4.0 * a * q.y * (1.0 - q.x * q.x);
    }
    vec3 n = normalize(vec3(-dzdx, -dzdy, 1.0));
    float ang = BANK * shapeSlope(sheetQ(vFlat.x)) / PI;
    float s = sin(ang), c = cos(ang);
    n = vec3(n.x, n.y * c - n.z * s, n.y * s + n.z * c);
    vec3 p = vFlat + vec3(0.0, 0.0, sheetZ(vFlat.x) + u_leanA * leanRamp(vFlat.x / u_sheetW));
    vec3 v = normalize(u_cam - p);
    float d = dot(n, LIGHT_DIR) * 0.5 + 0.5;
    col *= 1.0 - LIGHT_DIFF * (1.0 - d);
    vec3 h = normalize(LIGHT_DIR + v);
    col += pow(max(dot(n, h), 0.0), LIGHT_GLOSS) * LIGHT_SPEC;
  }

  // the title and arrow, printed on the card
  if (u_hasLabel > 0.5 && vUv.y < u_labelH) {
    vec4 L = texture2D(u_label, vec2(vUv.x, vUv.y / u_labelH));
    col = mix(col, L.rgb, L.a);
  }

  vec2 sz = vec2(res.x / max(res.y, 0.0001), 1.0);
  vec2 mid = sz * 0.5;
  float r = min(u_corner, min(mid.x, mid.y));
  float dist = roundedBox(vUv * sz - mid, mid, r);
  float aa = max(fwidth(dist), 0.0001);
  float alpha = u_alpha * (1.0 - smoothstep(-aa, aa, dist));

  if (u_mirror > 0.5) {
    alpha *= u_reflect * (1.0 - smoothstep(0.0, 0.55, vUv.y));
  }

  gl_FragColor = vec4(col, alpha);
}`;

  const FLOOR_VERT = `
precision highp float;
attribute vec2 a_pos;
uniform mat4 u_proj;
uniform mat4 u_view;
uniform vec4 u_box;   // x half-width, near z, far z, y
uniform float u_run;
varying vec2 vUv;
varying float vFar;
void main() {
  vUv = a_pos + 0.5;
  float x = a_pos.x * 2.0 * u_box.x;
  float z = mix(u_box.y, u_box.z, vUv.y);
  vFar = -z / u_run;
  gl_Position = u_proj * u_view * vec4(x, u_box.w, z, 1.0);
}`;

  const FLOOR_FRAG = `
#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform float u_alpha;
uniform float u_grid;
uniform vec2 u_gridF;
varying vec2 vUv;
varying float vFar;
void main() {
  float fade = 1.0 - smoothstep(0.2, 0.95, vFar);
  vec2 g = vec2(vUv.x * u_gridF.x, vFar * u_gridF.y);
  vec2 gf = abs(fract(g) - 0.5);
  vec2 gw = fwidth(g) * 1.5;
  vec2 lines = vec2(1.0) - smoothstep(vec2(0.0), gw, gf);
  float line = max(lines.x, lines.y);
  vec3 col = vec3(line * u_grid * fade);
  gl_FragColor = vec4(col, u_alpha * 0.9);
}`;

  /* ---- The "fabric": the pointer paints a soft height field as it moves, and
     the finished picture is pushed along that field's slope and lit by it,
     so the page bulges like cloth over the path the cursor just took. ---- */
  const FABRIC = {
    size: 256,        // trail buffer width
    radius: 0.04,     // splat radius, share of the width
    decay: 4,         // how fast the bulge settles (per second)
    diffuse: 40,      // how fast it spreads out (per second)
    follow: 7,        // how quickly the ball chases the pointer
    dead: 0.025,      // pointer lead (share of width) before anything happens
    full: 0.08,       // lead at which the splat reaches full strength
    warp: -0.045 * EMBOSS,     // how hard the slope pushes the picture
    shade: -1.2 * EMBOSS,      // how hard the slope is lit
    edge: [0.22, 0.5] // full strength inside .x of the centre, gone past .y
  };

  const QUAD_VERT = `
precision highp float;
attribute vec2 a_pos;
varying vec2 vUv;
void main() {
  vUv = a_pos + 0.5;
  gl_Position = vec4(a_pos * 2.0, 0.0, 1.0);
}`;

  const TRAIL_FRAG = `
precision highp float;
uniform sampler2D u_prev;
uniform vec2 u_texel;
uniform float u_decay;
uniform float u_diff;
uniform vec2 u_pos;
uniform float u_amp;
uniform float u_rad;
uniform float u_aspect;
uniform float u_bias;
varying vec2 vUv;
void main() {
  float c = texture2D(u_prev, vUv).r;
  float n = texture2D(u_prev, vUv + vec2(u_texel.x, 0.0)).r
    + texture2D(u_prev, vUv - vec2(u_texel.x, 0.0)).r
    + texture2D(u_prev, vUv + vec2(0.0, u_texel.y)).r
    + texture2D(u_prev, vUv - vec2(0.0, u_texel.y)).r;
  float h = mix(c, n * 0.25, u_diff) * u_decay;
  h = max(h - u_bias, 0.0);
  vec2 d = vUv - u_pos;
  vec2 q = vec2(d.x, d.y / u_aspect);
  h += u_amp * exp(-dot(q, q) / (u_rad * u_rad));
  gl_FragColor = vec4(min(h, 1.5), 0.0, 0.0, 1.0);
}`;

  const POST_FRAG = `
precision highp float;
uniform sampler2D u_scene;
uniform sampler2D u_trail;
uniform vec2 u_trailTexel;
uniform float u_aspect;
uniform float u_ballA;
uniform float u_warp;
uniform float u_shade;
uniform vec2 u_edge;
varying vec2 vUv;
void main() {
  vec4 page = texture2D(u_scene, vUv);
  if (u_ballA > 0.001) {
    vec2 e = u_trailTexel * 1.5;
    vec2 g = vec2(
      texture2D(u_trail, vUv + vec2(e.x, 0.0)).r - texture2D(u_trail, vUv - vec2(e.x, 0.0)).r,
      texture2D(u_trail, vUv + vec2(0.0, e.y)).r - texture2D(u_trail, vUv - vec2(0.0, e.y)).r
    );
    vec2 pw = vec2(vUv.x - 0.5, (vUv.y - 0.5) / u_aspect);
    float edge = 1.0 - smoothstep(u_edge.x, u_edge.y, length(pw));
    vec2 off = g * u_warp * u_ballA * edge;
    vec2 buv = clamp(vUv + off, 0.0, 1.0);
    float m = smoothstep(0.0, 0.002, length(off));
    vec3 warped = texture2D(u_scene, buv).rgb;
    float shade = dot(-g, normalize(vec2(-0.3, 1.0))) * u_shade * u_ballA * edge;
    float lum = dot(warped, vec3(0.2126, 0.7152, 0.0722));
    float head = 1.0 - smoothstep(0.7, 0.95, lum);
    warped *= 1.0 + clamp(shade, -0.5, 0.5) * head;
    page = mix(page, vec4(warped, 1.0), m);
  }
  gl_FragColor = page;
}`;

  const Renderer = {
    create(carousel) {
      const canvas = document.createElement("canvas");
      let gl = null;
      try {
        gl = canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: false });
      } catch (e) { gl = null; }
      if (!gl || !gl.getExtension("OES_standard_derivatives")) return null;

      const wrapEl = document.createElement("div");
      wrapEl.className = "gl";
      wrapEl.appendChild(canvas);
      carousel.root.appendChild(wrapEl);

      const r = new GLRenderer(carousel, gl, canvas);
      if (!r.ok) { wrapEl.remove(); return null; }
      return r;
    },
  };

  class GLRenderer {
    constructor(carousel, gl, canvas) {
      this.c = carousel;
      this.gl = gl;
      this.canvas = canvas;
      this.ok = false;
      this.card = this.program(VERT, FRAG);
      this.floor = this.program(FLOOR_VERT, FLOOR_FRAG);
      if (!this.card || !this.floor) return;
      this.trailProg = this.program(QUAD_VERT, TRAIL_FRAG);
      this.post = this.program(QUAD_VERT, POST_FRAG);
      this.fabric = !!(this.trailProg && this.post);
      this.ball = { p: 0, seen: false, tx: 0, ty: 0, sx: 0, sy: 0, e: 0 };
      if (this.fabric) {
        // the height field wants fractions; fall back to bytes where needed
        const half = gl.getExtension("OES_texture_half_float");
        gl.getExtension("EXT_color_buffer_half_float");
        const halfLinear = gl.getExtension("OES_texture_half_float_linear");
        this.trailType = half ? half.HALF_FLOAT_OES : gl.UNSIGNED_BYTE;
        this.trailFilter = half && halfLinear ? gl.LINEAR : half ? gl.NEAREST : gl.LINEAR;
        const point = (e) => {
          if (e.pointerType !== "mouse") return;
          const b = this.ball;
          const r = carousel.root.getBoundingClientRect();
          b.tx = e.clientX - r.left;
          b.ty = e.clientY - r.top;
          if (!b.seen) { b.sx = b.tx; b.sy = b.ty; b.seen = true; }
          b.p = 1;
        };
        carousel.root.addEventListener("pointermove", point, { passive: true });
        carousel.root.addEventListener("pointerdown", point, { passive: true });
        carousel.root.addEventListener("pointerleave", () => { this.ball.p = 0; });
      }

      // a 24 × 24 grid, so the ribbon can bend each card smoothly
      const N = 24;
      const pos = [];
      const idx = [];
      for (let y = 0; y <= N; y++) for (let x = 0; x <= N; x++) pos.push(x / N - 0.5, y / N - 0.5);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = y * (N + 1) + x;
        idx.push(i, i + 1, i + N + 1, i + 1, i + N + 2, i + N + 1);
      }
      this.grid = { vbo: this.buffer(new Float32Array(pos)), ibo: this.buffer(new Uint16Array(idx), gl.ELEMENT_ARRAY_BUFFER), count: idx.length };
      this.quad = { vbo: this.buffer(new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5])) };

      this.blank = this.texture();
      gl.bindTexture(gl.TEXTURE_2D, this.blank);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([17, 17, 17, 255]));

      canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); this.lost = true; });
      this.ok = true;
    }

    program(vs, fs) {
      const gl = this.gl;
      const make = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; }
        return s;
      };
      const v = make(gl.VERTEX_SHADER, vs);
      const f = make(gl.FRAGMENT_SHADER, fs);
      if (!v || !f) return null;
      const p = gl.createProgram();
      gl.attachShader(p, v);
      gl.attachShader(p, f);
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(p)); return null; }
      const u = {};
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(p, i);
        u[info.name] = gl.getUniformLocation(p, info.name);
      }
      return { p, u, a: gl.getAttribLocation(p, "a_pos") };
    }

    buffer(data, target = this.gl.ARRAY_BUFFER) {
      const gl = this.gl;
      const b = gl.createBuffer();
      gl.bindBuffer(target, b);
      gl.bufferData(target, data, gl.STATIC_DRAW);
      return b;
    }

    texture() {
      const gl = this.gl;
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }

    resize() {
      const c = this.c;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.round(c.ww * this.dpr);
      this.canvas.height = Math.round(c.wh * this.dpr);
      const aspect = c.ww / c.wh;
      const f = 1 / Math.tan((CFG.fov * Math.PI) / 360);
      const near = 0.1, far = 400;
      this.proj = new Float32Array([
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) / (near - far), -1,
        0, 0, (2 * far * near) / (near - far), 0,
      ]);
      this.view = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -CFG.camZ, 1]);
      this.H = Math.tan((CFG.fov * Math.PI) / 360) * CFG.camZ;
      this.W = this.H * aspect;
      this.k = (2 * this.H) / c.wh;
      for (const card of c.cards) card.labelKey = null; // redraw labels at the new size
      if (this.fabric) this.fabricResize();
    }

    /* An off-screen picture of the scene, and two trail buffers to ping-pong. */
    target(w, h, type, filter) {
      const gl = this.gl;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, type, null);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return ok ? { tex, fb, w, h } : null;
    }

    fabricResize() {
      const gl = this.gl;
      const drop = (t) => { if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); } };
      drop(this.scene);
      (this.trail || []).forEach(drop);
      this.scene = this.target(this.canvas.width, this.canvas.height, gl.UNSIGNED_BYTE, gl.LINEAR);
      const tw = FABRIC.size;
      const th = Math.max(1, Math.round((FABRIC.size * this.c.wh) / this.c.ww));
      let make = () => [0, 1].map(() => this.target(tw, th, this.trailType, this.trailFilter));
      let trail = make();
      if (trail.some((t) => !t) && this.trailType !== gl.UNSIGNED_BYTE) {
        trail.forEach(drop);
        this.trailType = gl.UNSIGNED_BYTE;
        this.trailFilter = gl.LINEAR;
        trail = make();
      }
      this.trail = trail.every(Boolean) ? trail : null;
      this.trailSide = 0;
      if (!this.scene || !this.trail) this.fabric = false;
    }

    /* Move the ball toward the pointer and paint this frame's splat. */
    fabricStep(dt) {
      const gl = this.gl;
      const b = this.ball;
      const ww = this.c.ww, wh = this.c.wh;
      b.e *= Math.exp(-FABRIC.decay * dt);
      let amp = 0;
      if (b.p > 0.001 && b.seen && isMouse.matches) {
        const k = 1 - Math.exp(-FABRIC.follow * dt);
        b.sx += (b.tx - b.sx) * k;
        b.sy += (b.ty - b.sy) * k;
        const lead = Math.hypot(b.tx - b.sx, b.ty - b.sy) / ww;
        const p = Math.tanh(Math.max(0, lead - FABRIC.dead) / FABRIC.full);
        amp = p * p;
      }
      b.e = Math.max(b.e, amp);
      this.fabricOn = b.e > 0.004;
      if (!this.fabricOn) return;

      const P = this.trailProg;
      const from = this.trail[this.trailSide];
      const to = this.trail[1 - this.trailSide];
      gl.bindFramebuffer(gl.FRAMEBUFFER, to.fb);
      gl.viewport(0, 0, to.w, to.h);
      gl.disable(gl.BLEND);
      gl.useProgram(P.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad.vbo);
      gl.enableVertexAttribArray(P.a);
      gl.vertexAttribPointer(P.a, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, from.tex);
      gl.uniform1i(P.u.u_prev, 0);
      gl.uniform2f(P.u.u_texel, 1 / to.w, 1 / to.h);
      gl.uniform1f(P.u.u_decay, Math.exp(-FABRIC.decay * dt));
      gl.uniform1f(P.u.u_diff, 1 - Math.exp(-FABRIC.diffuse * dt));
      gl.uniform2f(P.u.u_pos, b.tx / ww, 1 - b.ty / wh);
      gl.uniform1f(P.u.u_amp, amp);
      gl.uniform1f(P.u.u_rad, FABRIC.radius);
      gl.uniform1f(P.u.u_aspect, ww / wh);
      gl.uniform1f(P.u.u_bias, this.trailType === gl.UNSIGNED_BYTE ? 1 / 255 : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      this.trailSide = 1 - this.trailSide;
    }

    /* Draw the scene picture to the screen, warped and lit by the trail. */
    fabricPost() {
      const gl = this.gl;
      const P = this.post;
      const tr = this.trail[this.trailSide];
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.disable(gl.BLEND);
      gl.useProgram(P.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad.vbo);
      gl.enableVertexAttribArray(P.a);
      gl.vertexAttribPointer(P.a, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.scene.tex);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, tr.tex);
      gl.uniform1i(P.u.u_scene, 0);
      gl.uniform1i(P.u.u_trail, 1);
      gl.uniform2f(P.u.u_trailTexel, 1 / tr.w, 1 / tr.h);
      gl.uniform1f(P.u.u_aspect, this.c.ww / this.c.wh);
      gl.uniform1f(P.u.u_ballA, this.fabricOn ? this.ball.p : 0);
      gl.uniform1f(P.u.u_warp, FABRIC.warp);
      gl.uniform1f(P.u.u_shade, FABRIC.shade);
      gl.uniform2f(P.u.u_edge, FABRIC.edge[0], FABRIC.edge[1]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    /* The title strip at the bottom of a card, drawn once into its own texture. */
    label(card) {
      const c = this.c;
      const rem = c.rem;
      const w = card.rect.width;
      const h = Math.ceil(rem * 5);
      const hv = Math.round(card.hover * 40) / 40;
      const key = `${w}|${h}|${hv}|${c.small}`;
      if (card.labelKey === key) return;
      card.labelKey = key;

      const dpr = this.dpr;
      const cv = card.labelCanvas || (card.labelCanvas = document.createElement("canvas"));
      cv.width = Math.max(1, Math.round(w * dpr));
      cv.height = Math.round(h * dpr);
      const ctx = cv.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const inset = (c.small ? 1 : 2) * rem;
      const bottom = rem;
      const pill = 2.5 * rem;
      const size = (c.small ? 1.6 : 1.8) * rem;
      const font = getComputedStyle(document.body).fontFamily;

      ctx.fillStyle = "#fff";
      ctx.font = `400 ${size}px ${font}`;
      if ("letterSpacing" in ctx) ctx.letterSpacing = `${-0.05 * size}px`;
      ctx.textBaseline = "alphabetic";
      ctx.fillText(card.title, inset, h - bottom - size * 0.3);

      const cx = w - inset - pill / 2;
      const cy = h - bottom - pill / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, pill / 2, 0, Math.PI * 2);
      ctx.fillStyle = "#000";
      ctx.fill();
      ctx.clip();
      const e = expoOut(hv);
      const drawArrow = (ox) => {
        const s = pill * 0.42;
        const x = cx + ox - s / 2;
        const y = cy;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = Math.max(1, pill * 0.042);
        ctx.lineCap = "butt";
        ctx.beginPath();
        ctx.moveTo(x + s * 0.125, y);
        ctx.lineTo(x + s * 0.8125, y);
        ctx.moveTo(x + s * 0.5625, y - s * 0.25);
        ctx.lineTo(x + s * 0.8125, y);
        ctx.lineTo(x + s * 0.5625, y + s * 0.25);
        ctx.stroke();
      };
      drawArrow(e * pill);
      drawArrow(-pill + e * pill);
      ctx.restore();

      const gl = this.gl;
      card.labelTex = card.labelTex || this.texture();
      gl.bindTexture(gl.TEXTURE_2D, card.labelTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
      card.labelH = h / card.rect.height;
    }

    /* Copy the card's current video frame (or placeholder) to the GPU. */
    picture(card) {
      const gl = this.gl;
      const s = card.source;
      if (!s) return false;
      let w = 0, h = 0;
      if (s.tagName === "VIDEO") {
        if (s.readyState < 2) return false;
        w = s.videoWidth; h = s.videoHeight;
      } else if (s.tagName === "IMG") {
        if (!s.complete || !s.naturalWidth) return false;
        if (card.picTex && card.picStatic) return true;
        w = s.naturalWidth; h = s.naturalHeight;
        card.picStatic = true;
      } else {
        w = s.width; h = s.height;
      }
      if (!w || !h) return false;
      card.picTex = card.picTex || this.texture();
      gl.bindTexture(gl.TEXTURE_2D, card.picTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, s);
      } catch (e) {
        return false; // e.g. a video from another site without permission
      }
      card.picSize = [w, h];
      return true;
    }

    render(time) {
      const gl = this.gl;
      const c = this.c;
      if (this.lost) return;
      const dt = Math.min(0.1, Math.max(0, time - (this.lastTime ?? time)));
      this.lastTime = time;
      // with the fabric on, draw into an off-screen picture first
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fabric ? this.scene.fb : null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(0, 0, 0, this.fabric ? 1 : 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.DEPTH_TEST);

      const k = this.k;
      const ribbon = !c.small;
      const W = this.W, H = this.H;
      const D = ribbon ? W * CFG.depth * (1 + CFG.speedDepth * c.speed) : 0;
      const A = ribbon ? W * CFG.door : 0;

      const visible = [];
      const margin = c.ww * 0.5;
      for (const card of c.cards) {
        if (!card.base || card.el.style.display === "none") continue;
        const r = card.rect;
        if (r.left + card.ox > c.ww + margin || r.left + card.ox + r.width < -margin) continue;
        if (r.top > c.wh + 50 || r.top + r.height < -50) continue;
        visible.push(card);
      }

      const pose = (card) => [
        (card.rect.left + card.rect.width / 2 + card.ox - c.ww / 2) * k,
        -(card.rect.top + card.rect.height / 2 - c.wh / 2) * k,
        card.rect.width * k,
        card.rect.height * k,
      ];

      // the floor sits just under the cards (wide screens only)
      let floorY = 0;
      if (ribbon && visible.length) {
        const p = pose(visible[0]);
        floorY = p[1] - p[3] / 2 - H * CFG.floorDrop;
      }

      for (const card of visible) {
        if (!this.picture(card) && !card.picTex) card.picSize = [1, 1];
      }

      // 1. floor
      if (ribbon && c.ground > 0) {
        const P = this.floor;
        gl.useProgram(P.p);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quad.vbo);
        gl.enableVertexAttribArray(P.a);
        gl.vertexAttribPointer(P.a, 2, gl.FLOAT, false, 0, 0);
        const run = H * 6;
        const l = CFG.camZ;
        const near = Math.min(l * (1 - Math.abs(floorY) / H) + H * 0.2, l * 0.8);
        gl.uniformMatrix4fv(P.u.u_proj, false, this.proj);
        gl.uniformMatrix4fv(P.u.u_view, false, this.view);
        gl.uniform4f(P.u.u_box, W * 4, near, -run, floorY);
        gl.uniform1f(P.u.u_run, run);
        const cell = H * 0.22;
        gl.uniform2f(P.u.u_gridF, (W * 8) / cell, run / cell);
        gl.uniform1f(P.u.u_grid, 0.08);
        gl.uniform1f(P.u.u_alpha, c.ground * c.ground * (3 - 2 * c.ground));
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }

      // 2. reflections, then 3. the cards themselves
      const P = this.card;
      gl.useProgram(P.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.grid.vbo);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.grid.ibo);
      gl.enableVertexAttribArray(P.a);
      gl.vertexAttribPointer(P.a, 2, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(P.u.u_proj, false, this.proj);
      gl.uniformMatrix4fv(P.u.u_view, false, this.view);
      gl.uniform1i(P.u.u_tex, 0);
      gl.uniform1i(P.u.u_label, 1);
      gl.uniform3f(P.u.u_cam, 0, 0, CFG.camZ);
      gl.uniform1f(P.u.u_sheetW, ribbon ? W : 0);
      gl.uniform1f(P.u.u_sheetD, D);
      gl.uniform1f(P.u.u_sheetT, CFG.span);
      gl.uniform1f(P.u.u_sheetV, ribbon ? c.speed : 0);
      gl.uniform1f(P.u.u_leanA, A);
      gl.uniform1f(P.u.u_shadeS, CFG.shadeSpread);
      gl.uniform1f(P.u.u_dent, CFG.dent);
      gl.uniform1f(P.u.u_floorY, floorY);
      gl.uniform1f(P.u.u_reflect, CFG.reflection * c.ground);

      const passes = ribbon && c.ground > 0 ? [1, 0] : [0];
      for (const mirror of passes) {
        gl.uniform1f(P.u.u_mirror, mirror);
        for (const card of visible) {
          const p = pose(card);
          gl.uniform4f(P.u.u_rect, p[0], p[1], p[2], p[3]);
          gl.uniform1f(P.u.u_alpha, card.alpha);
          gl.uniform1f(P.u.u_hover, ribbon || isMouse.matches ? card.hover : 0);
          const radius = c.radius;
          gl.uniform1f(P.u.u_corner, radius / card.rect.height);
          gl.uniform2f(P.u.u_size, card.picSize?.[0] || 1, card.picSize?.[1] || 1);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, card.picTex || this.blank);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, card.labelTex || this.blank);
          gl.uniform1f(P.u.u_hasLabel, 0);
          gl.uniform1f(P.u.u_labelH, card.labelH || 0);
          gl.drawElements(gl.TRIANGLES, this.grid.count, gl.UNSIGNED_SHORT, 0);
        }
      }

      if (this.fabric) {
        this.fabricStep(dt);
        this.fabricPost();
      }
    }
  }

  function boot() {
    document.querySelectorAll("[data-promo-ribbon]").forEach((el) => {
      if (el._carousel) return;
      const carousel = (el._carousel = new Carousel(el));
      const section = el.closest("[data-promo-section]");
      section?.querySelector("[data-promo-prev]")?.addEventListener("click", () => carousel.go(-1));
      section?.querySelector("[data-promo-next]")?.addEventListener("click", () => carousel.go(1));
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
