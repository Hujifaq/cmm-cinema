(() => {
  'use strict';
  const root = document.querySelector('[data-signup-page]');
  if (!root) return;

  // This is a UI preview: validate locally and never send or store credentials.
  const form = root.querySelector('[data-signup-form]');
  const password = form.elements.password;
  const confirmation = form.elements.confirmPassword;
  const name = form.elements.name;
  const status = form.querySelector('[data-signup-status]');
  const loginForm = root.querySelector('[data-login-form]');
  const loginPassword = loginForm?.elements.password;
  const passwordFields = [password, confirmation, loginPassword].filter(Boolean);
  const forms = [form, loginForm].filter(Boolean);
  const validate = () => {
    name.setCustomValidity(name.value && !name.value.trim() ? 'Please enter your name.' : '');
    confirmation.setCustomValidity(confirmation.value && confirmation.value !== password.value ? 'Your passwords do not match.' : '');
  };
  form.addEventListener('input', () => {
    validate();
    status.hidden = true;
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    validate();
    if (!form.reportValidity()) return;
    status.textContent = 'Account registration is not available yet. Please check back soon.';
    status.hidden = false;
  });
  if (loginForm) {
    const loginStatus = loginForm.querySelector('[data-login-status]');
    loginForm.addEventListener('input', () => { loginStatus.hidden = true; });
    loginForm.addEventListener('submit', event => {
      event.preventDefault();
      if (!loginForm.reportValidity()) return;
      loginStatus.textContent = 'Login is not available yet. Please check back soon.';
      loginStatus.hidden = false;
    });
    loginForm.querySelector('[data-login-submit]').disabled = false;
  }
  root.querySelectorAll('[data-password-toggle]').forEach(button => {
    const input = document.getElementById(button.getAttribute('aria-controls'));
    const label = input === confirmation ? 'confirm password' : 'password';
    button.hidden = false;
    button.addEventListener('click', () => {
      const visible = input.type === 'password';
      input.type = visible ? 'text' : 'password';
      button.textContent = visible ? 'Hide' : 'Show';
      button.setAttribute('aria-label', `${visible ? 'Hide' : 'Show'} ${label}`);
      button.setAttribute('aria-pressed', String(visible));
    });
  });
  form.querySelector('[data-signup-submit]').disabled = false;

  const { gsap, SplitText } = window;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  const card = root.querySelector('[data-signup-card]');
  const switchButton = root.querySelector('[data-auth-switch]');
  const views = [...root.querySelectorAll('[data-auth-view]')];
  const poster = (() => {
    const art = root.querySelector('[data-signup-art]');
    const surface = root.querySelector('[data-auth-forms]');
    const body = root.querySelector('[data-mascot-body]');
    const bodyLayers = [...root.querySelectorAll('[data-mascot-body]')];
    const ray = root.querySelector('[data-poster-ray]');
    if (!card || !art || !surface || !body || !ray) return { change() {} };
    const wide = window.matchMedia('(min-width: 1024px)');
    const cupDetails = [...root.querySelectorAll('[data-mascot-cup-details]')];
    const popcornDetails = root.querySelector('[data-mascot-popcorn-details]');
    const paints = [...root.querySelectorAll('[data-poster-paint]')];
    const transitionLayer = root.querySelector('[data-mascot-transition]');
    const idleLayer = root.querySelector('[data-mascot-idle]');
    const straw = root.querySelector('[data-cup-straw]');
    const script = root.querySelector('[data-poster-script]');
    const title = root.querySelector('[data-poster-title]');
    const tagline = root.querySelector('[data-poster-tagline]');
    const text = [script, title, tagline];
    let motion, idle;

    const stopIdle = () => {
      idle?.kill();
      idle = null;
      if (gsap) gsap.set(idleLayer, { clearProps: 'transform' });
    };
    const startIdle = () => {
      stopIdle();
      if (!gsap || reduced.matches || document.hidden || card.dataset.authMode !== 'register') return;
      idle = gsap.to(idleLayer, {
        y: -4, rotation: 1.2, transformOrigin: '50% 90%',
        duration: 2.1, repeat: -1, yoyo: true, ease: 'sine.inOut'
      });
    };
    const setCopy = mode => {
      const cup = mode === 'register';
      script.textContent = cup ? 'ice cold' : 'freshly';
      const word = cup ? 'DRINKS' : 'POPPED';
      title.querySelectorAll('span').forEach((letter, index) => { letter.textContent = word[index]; });
      title.setAttribute('aria-label', word);
      tagline.textContent = cup ? 'take a little break.' : 'made for movie nights.';
      art.setAttribute('aria-label', cup ? 'Your water cup movie buddy' : 'Your popcorn movie buddy');
      root.querySelector('[data-mascot-title]').textContent = cup
        ? 'A friendly water cup mascot with a striped straw'
        : 'Poppy, a friendly fluffy popcorn mascot';
    };
    const settle = (resumeIdle = true) => {
      motion?.kill();
      motion = null;
      stopIdle();
      const mode = card.dataset.authMode;
      const cup = mode === 'register';
      art.toggleAttribute('data-soda-paused', !resumeIdle || document.hidden);
      setCopy(mode);
      bodyLayers.forEach(layer => layer.setAttribute('d', body.dataset[cup ? 'shapeRegister' : 'shapeLogin']));
      ray.setAttribute('d', ray.dataset[cup ? 'shapeRegister' : 'shapeLogin']);
      cupDetails.forEach(part => {
        part.style.opacity = cup ? '1' : '0';
        part.style.visibility = cup ? 'visible' : 'hidden';
      });
      popcornDetails.style.opacity = cup ? '0' : '1';
      popcornDetails.style.visibility = cup ? 'hidden' : 'visible';
      paints.forEach(paint => { paint.style.opacity = paint.dataset.posterPaint === mode ? '1' : '0'; });
      art.style.removeProperty('border-radius');
      if (gsap) {
        gsap.set([transitionLayer, straw, ...text], { clearProps: 'transform,opacity,visibility' });
        if (!reduced.matches) {
          card.setAttribute('data-auth-gsap', '');
          gsap.set(art, { xPercent: wide.matches && cup ? 100 : 0 });
          gsap.set(surface, { xPercent: wide.matches && cup ? -100 : 0 });
        } else {
          gsap.set([art, surface], { clearProps: 'transform' });
          card.removeAttribute('data-auth-gsap');
        }
      }
      if (resumeIdle) startIdle();
    };
    const change = (mode, animate) => {
      if (!gsap || reduced.matches || document.hidden || !animate) return settle();
      motion?.kill();
      stopIdle();
      setCopy(mode);
      card.setAttribute('data-auth-gsap', '');
      const cup = mode === 'register';
      const shape = cup ? 'shapeRegister' : 'shapeLogin';
      gsap.set(transitionLayer, { transformOrigin: '50% 75%' });
      motion = gsap.timeline({ defaults: { ease: 'power3.out' }, onComplete: () => settle() });
      motion
        .to(art, { xPercent: wide.matches && cup ? 100 : 0, duration: 0.9, ease: 'power3.inOut' }, 0)
        .to(surface, { xPercent: wide.matches && cup ? -100 : 0, duration: 0.9, ease: 'power3.inOut' }, 0)
        .to(art, { borderRadius: cup ? '28px 80px 80px 28px' : '80px 28px 28px 80px', duration: 0.3, ease: 'power2.inOut' }, 0)
        .to(art, { borderRadius: '0px', duration: 0.6, ease: 'power3.out' }, 0.3)
        // Both paths have matching command topology: real SVG morphs using GSAP core.
        .to(ray, { attr: { d: ray.dataset[shape] }, duration: 0.9, ease: 'power3.inOut' }, 0)
        .to(bodyLayers, { attr: { d: body.dataset[shape] }, duration: 0.72, ease: 'power3.inOut' }, 0.08)
        .to(transitionLayer, { scaleX: 0.88, scaleY: 1.1, rotation: cup ? 6 : -6, duration: 0.24, ease: 'power2.in' }, 0)
        .to(transitionLayer, { scaleX: 1, scaleY: 1, rotation: 0, duration: 0.65, ease: 'back.out(1.6)' }, 0.24)
        .to(popcornDetails, { autoAlpha: cup ? 0 : 1, duration: 0.32 }, cup ? 0 : 0.3)
        .to(cupDetails, { autoAlpha: cup ? 1 : 0, duration: 0.38 }, cup ? 0.28 : 0)
        .fromTo(text, { y: 8, opacity: 0.35 }, { y: 0, opacity: 1, duration: 0.55, stagger: 0.035, ease: 'power3.out' }, 0.18);
      paints.forEach(paint => {
        motion.to(paint, { opacity: paint.dataset.posterPaint === mode ? 1 : 0, duration: 0.75, ease: 'power2.inOut' }, 0.06);
      });
      if (cup) motion.fromTo(straw, { rotation: -12, transformOrigin: '244px 124px' }, { rotation: 0, duration: 0.65, ease: 'back.out(2)' }, 0.25);
    };
    const syncLayout = () => settle();
    const syncVisibility = () => settle(!document.hidden);
    const bind = () => {
      wide.addEventListener('change', syncLayout);
      reduced.addEventListener('change', syncLayout);
      document.addEventListener('visibilitychange', syncVisibility);
    };
    bind();
    window.addEventListener('pagehide', () => {
      wide.removeEventListener('change', syncLayout);
      reduced.removeEventListener('change', syncLayout);
      document.removeEventListener('visibilitychange', syncVisibility);
      settle(false);
    });
    window.addEventListener('pageshow', event => {
      if (event.persisted) { bind(); settle(); }
    });
    return { change };
  })();
  if (card && switchButton && views.length === 2) {
    const switchMode = (mode, announce = true) => {
      if (mode !== 'login' && mode !== 'register') return;
      const previousMode = card.dataset.authMode;
      const outgoing = views.find(view => view.hasAttribute('data-active'));
      // Move focus before making an outgoing form inert; never discard field values.
      if (outgoing?.contains(document.activeElement)) switchButton.focus({ preventScroll: true });
      root.querySelectorAll('[data-password-toggle]').forEach(button => {
        document.getElementById(button.getAttribute('aria-controls')).type = 'password';
        button.textContent = 'Show';
        button.setAttribute('aria-label', button.getAttribute('aria-controls') === confirmation.id ? 'Show confirm password' : 'Show password');
        button.setAttribute('aria-pressed', 'false');
      });
      views.forEach(view => {
        const active = view.dataset.authView === mode;
        view.toggleAttribute('data-active', active);
        view.toggleAttribute('inert', !active);
        view.setAttribute('aria-hidden', String(!active));
      });
      card.dataset.authMode = mode;
      poster.change(mode, announce && previousMode !== mode);
      const next = mode === 'login' ? 'register' : 'login';
      const label = next === 'register' ? 'Register' : 'Login';
      switchButton.dataset.authSwitch = next;
      switchButton.querySelector('[data-auth-switch-label]').textContent = label;
      switchButton.setAttribute('aria-label', `Switch to ${label}`);
      if (announce) root.querySelector('[data-auth-announcement]').textContent = `${mode === 'login' ? 'Login' : 'Register'} form`;
      root.dispatchEvent(new Event('cinema:authchange'));
    };
    switchButton.addEventListener('click', () => switchMode(switchButton.dataset.authSwitch));
    switchButton.hidden = false;
    switchMode('login', false);
    card.setAttribute('data-auth-ready', '');
  }

  // Form reactions remain usable when GSAP is unavailable or motion is reduced.
  const setupMascot = () => {
    const mascot = root.querySelector('[data-popcorn-mascot]');
    if (!mascot) return () => {};
    const gazeAnchor = mascot.closest('[data-auth-scene]') || mascot;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const events = new AbortController();
    const options = { signal: events.signal };
    let errorTimer;
    let blinkTimer, reopenTimer;
    let focused = null;
    const neutral = () => {
      ['--poppy-look-x', '--poppy-look-y', '--poppy-eye-x', '--poppy-eye-y', '--poppy-highlight-x', '--poppy-highlight-y', '--poppy-tilt', '--poppy-nod'].forEach(property => mascot.style.removeProperty(property));
    };
    const lookAt = (x, y) => {
      if (reduced.matches || document.hidden || mascot.hasAttribute('data-mascot-private')) return neutral();
      // The wrapper stays still as the face moves, avoiding feedback jitter.
      const box = gazeAnchor.getBoundingClientRect();
      const xDirection = (x - box.left - box.width / 2) / Math.max(160, box.width);
      const yDirection = (y - box.top - box.height * 0.51) / Math.max(160, box.height);
      const distance = Math.max(1, Math.hypot(xDirection, yDirection));
      const dx = xDirection / distance, dy = yDirection / distance;
      // Nested depth planes: subtle eye shell, trailing dark pupil, leading white glint.
      mascot.style.setProperty('--poppy-eye-x', `${dx * 2.5}px`);
      mascot.style.setProperty('--poppy-eye-y', `${dy * 1.5}px`);
      mascot.style.setProperty('--poppy-look-x', `${dx * 6}px`);
      mascot.style.setProperty('--poppy-look-y', `${dy * 4.5}px`);
      mascot.style.setProperty('--poppy-highlight-x', `${dx * 9}px`);
      mascot.style.setProperty('--poppy-highlight-y', `${dy * 11}px`);
      mascot.style.setProperty('--poppy-tilt', `${dx * 4}deg`);
      mascot.style.setProperty('--poppy-nod', `${dy * 3}px`);
    };
    const stopBlinking = () => {
      window.clearTimeout(blinkTimer);
      window.clearTimeout(reopenTimer);
      blinkTimer = reopenTimer = undefined;
      mascot.removeAttribute('data-mascot-blinking');
    };
    const scheduleBlink = () => {
      if (reduced.matches || document.hidden || mascot.hasAttribute('data-mascot-private') || blinkTimer !== undefined || reopenTimer !== undefined) return;
      blinkTimer = window.setTimeout(() => {
        blinkTimer = undefined;
        mascot.setAttribute('data-mascot-blinking', '');
        reopenTimer = window.setTimeout(() => {
          reopenTimer = undefined;
          mascot.removeAttribute('data-mascot-blinking');
          scheduleBlink();
        }, 160);
      }, 3200 + Math.random() * 2800);
    };
    const sync = () => {
      const privateMode = passwordFields.some(input => input.type === 'text');
      mascot.toggleAttribute('data-mascot-private', privateMode);
      if (privateMode || reduced.matches || document.hidden) {
        neutral();
        stopBlinking();
      } else {
        if (focused) {
          const box = focused.getBoundingClientRect();
          lookAt(box.left + box.width / 2, box.top + box.height / 2);
        }
        scheduleBlink();
      }
    };
    const clearError = () => {
      window.clearTimeout(errorTimer);
      mascot.removeAttribute('data-mascot-error');
    };
    const rejectPassword = input => {
      if (!passwordFields.includes(input) || input.closest('[inert]') || mascot.hasAttribute('data-mascot-error')) return;
      mascot.setAttribute('data-mascot-error', '');
      sync();
      errorTimer = window.setTimeout(() => { clearError(); sync(); }, 750);
    };
    root.addEventListener('pointermove', event => {
      if (!fine.matches || event.pointerType !== 'mouse') return;
      lookAt(event.clientX, event.clientY);
    }, { ...options, passive: true });
    root.addEventListener('pointerleave', () => { if (focused) sync(); else neutral(); }, options);
    const isFormInput = element => forms.some(item => item.contains(element)) && !element.closest('[inert]') && element.matches('input:not([type="checkbox"])');
    root.addEventListener('focusin', event => {
      focused = isFormInput(event.target) ? event.target : null;
      sync();
    }, options);
    root.addEventListener('focusout', event => {
      // React after a completed field, not on every mismatching keystroke.
      if (event.target.value && !event.target.validity?.valid) rejectPassword(event.target);
      queueMicrotask(() => {
        if (events.signal.aborted) return;
        focused = isFormInput(document.activeElement) ? document.activeElement : null;
        if (!focused) neutral();
        sync();
      });
    }, options);
    root.addEventListener('input', () => { clearError(); sync(); }, options);
    root.addEventListener('invalid', event => rejectPassword(event.target), { ...options, capture: true });
    // The button's own handler changes the input type before this bubbles here.
    root.addEventListener('click', event => { if (event.target.closest('[data-password-toggle]')) sync(); }, options);
    root.addEventListener('cinema:authchange', () => {
      focused = null;
      clearError();
      neutral();
      sync();
    }, options);
    reduced.addEventListener('change', sync);
    fine.addEventListener('change', neutral);
    document.addEventListener('visibilitychange', sync, options);
    sync();
    return () => {
      events.abort();
      reduced.removeEventListener('change', sync);
      fine.removeEventListener('change', neutral);
      clearError();
      stopBlinking();
      neutral();
    };
  };
  const setupClayScene = () => {
    const scene = root.querySelector('[data-auth-scene]');
    if (!scene) return () => {};
    const artwork = scene.closest('[data-signup-art]') || scene;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const events = new AbortController();
    const properties = [
      '--auth-clay-back-x', '--auth-clay-back-y', '--auth-clay-back-rotate',
      '--auth-clay-front-x', '--auth-clay-front-y', '--auth-clay-front-rotate',
      '--auth-clay-character-x', '--auth-clay-character-y'
    ];
    const reset = () => properties.forEach(property => artwork.style.removeProperty(property));
    root.addEventListener('pointermove', event => {
      if (event.pointerType !== 'mouse' || !fine.matches || reduced.matches || document.hidden) return;
      const box = scene.getBoundingClientRect();
      const x = (event.clientX - box.left - box.width / 2) / Math.max(180, box.width);
      const y = (event.clientY - box.top - box.height / 2) / Math.max(180, box.height);
      const distance = Math.max(1, Math.hypot(x, y));
      const dx = x / distance, dy = y / distance;
      // Swirl, Poppy, and sparkles sit on separate, softly eased depth planes.
      artwork.style.setProperty('--auth-clay-back-x', `${-dx * 6}px`);
      artwork.style.setProperty('--auth-clay-back-y', `${-dy * 4}px`);
      artwork.style.setProperty('--auth-clay-back-rotate', `${-dx}deg`);
      artwork.style.setProperty('--auth-clay-front-x', `${dx * 9}px`);
      artwork.style.setProperty('--auth-clay-front-y', `${dy * 6}px`);
      artwork.style.setProperty('--auth-clay-front-rotate', `${dx * 1.2}deg`);
      artwork.style.setProperty('--auth-clay-character-x', `${dx * 3}px`);
      artwork.style.setProperty('--auth-clay-character-y', `${dy * 2}px`);
    }, { signal: events.signal, passive: true });
    root.addEventListener('pointerleave', reset, { signal: events.signal });
    root.addEventListener('cinema:authchange', reset, { signal: events.signal });
    document.addEventListener('visibilitychange', reset, { signal: events.signal });
    reduced.addEventListener('change', reset);
    fine.addEventListener('change', reset);
    return () => {
      events.abort();
      reduced.removeEventListener('change', reset);
      fine.removeEventListener('change', reset);
      reset();
    };
  };
  let disposeMascot = setupMascot();
  let disposeClayScene = setupClayScene();
  window.addEventListener('pagehide', () => { disposeMascot(); disposeClayScene(); });
  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      disposeMascot = setupMascot();
      disposeClayScene = setupClayScene();
    }
  });

  const show = () => root.setAttribute('data-revealed', '');
  if (!gsap || reduced.matches) {
    show();
    return;
  }

  let context;
  let disposed = false;
  const clayTubes = [...root.querySelectorAll('[data-auth-clay]')];
  const unmaskClay = () => clayTubes.forEach(svg => {
    const drawing = svg.querySelector('[data-auth-clay-drawing]');
    if (!drawing) return;
    drawing.removeAttribute('mask');
    drawing.style.removeProperty('opacity');
  });
  const splits = [];
  const revertText = () => splits.splice(0).forEach(split => split.revert());
  const finish = () => {
    disposed = true;
    context?.revert();
    unmaskClay();
    revertText();
    show();
  };
  const motionChange = () => { if (reduced.matches) finish(); };
  reduced.addEventListener('change', motionChange);
  window.addEventListener('pagehide', () => {
    finish();
    reduced.removeEventListener('change', motionChange);
  }, { once: true });

  const reveal = () => {
    if (disposed || reduced.matches) return show();
    try {
      if (SplitText) gsap.registerPlugin(SplitText);
      context = gsap.context(() => {
        const chars = [...root.querySelectorAll('[data-reveal-chars]')].flatMap(element => {
          if (!SplitText) return [element];
          const split = SplitText.create(element, { type: 'words,chars', mask: 'chars' });
          splits.push(split);
          return split.chars;
        });
        const intro = gsap.timeline({
          delay: document.documentElement.hasAttribute('data-page-arrived') ? 0.55 : 0.1,
          defaults: { ease: 'power4.out' },
          onComplete: () => { revertText(); unmaskClay(); }
        });
        intro
          .from('[data-signup-card]', { y: 30, borderRadius: '64px', duration: 0.9, clearProps: 'transform,borderRadius' }, 0.08)
          .from(chars, { yPercent: 110, duration: 0.75, stagger: 0.012 }, 0.17)
          .from('[data-reveal-up]', { y: 14, autoAlpha: 0, duration: 0.65, stagger: 0.055, clearProps: 'transform,opacity,visibility' }, 0.28)
          .from('[data-mascot-entrance]', { y: 24, scale: 0.85, duration: 0.9, ease: 'back.out(1.8)', clearProps: 'transform' }, 0.3);
        clayTubes.forEach(svg => {
          const front = svg.dataset.authClay === 'front';
          const at = front ? 0.97 : 0.1;
          const duration = front ? 0.65 : 1.45;
          const drawing = svg.querySelector('[data-auth-clay-drawing]');
          const trace = svg.querySelector('[data-auth-clay-trace]');
          if (!drawing || !trace) return;
          gsap.set(trace, { attr: { 'stroke-dasharray': '1000 1000', 'stroke-dashoffset': 1000 } });
          gsap.set(drawing, { opacity: 0, attr: { mask: `url(#${svg.dataset.authClayMask})` } });
          intro
            .set(drawing, { opacity: 1 }, at)
            .to(trace, { attr: { 'stroke-dashoffset': 0 }, duration, ease: 'power2.out' }, at)
            .set(drawing, { attr: { mask: 'none' } }, at + duration);
        });
      }, root);
    } catch {
      finish();
    }
    show();
  };
  (document.fonts?.ready || Promise.resolve()).then(() => requestAnimationFrame(reveal)).catch(finish);
})();
