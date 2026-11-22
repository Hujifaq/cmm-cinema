(() => {
  'use strict';
  const root = document.querySelector('[data-profile-page]');
  if (!root) return;

  const { gsap, SplitText } = window;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const animate = () => Boolean(gsap) && !reduced.matches;
  const show = () => root.setAttribute('data-revealed', '');

  const tabs = [...root.querySelectorAll('[data-profile-tab]')];
  const panels = [...root.querySelectorAll('[data-profile-panel]')];
  const tabList = root.querySelector('[data-profile-tabs]');

  const enterPanel = panel => {
    if (!animate()) return;
    gsap.fromTo(panel.querySelectorAll(':scope > [data-profile-card]'),
      { y: 28, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.7, ease: 'power3.out', stagger: 0.08, clearProps: 'transform,opacity,visibility' });
  };

  const select = (key, { focus = false, scroll = false } = {}) => {
    const tab = tabs.find(t => t.dataset.profileTab === key);
    if (!tab) return;
    const changed = tab.getAttribute('aria-selected') !== 'true';
    tabs.forEach(t => {
      const active = t === tab;
      t.setAttribute('aria-selected', active ? 'true' : 'false');
      t.tabIndex = active ? 0 : -1;
    });
    panels.forEach(panel => { panel.hidden = panel.dataset.profilePanel !== key; });
    history.replaceState(null, '', key === 'profile' ? location.pathname + location.search : `#${key}`);
    if (focus) tab.focus();
    if (scroll) tabList.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
    if (changed) enterPanel(panels.find(panel => panel.dataset.profilePanel === key));
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab.dataset.profileTab));
    tab.addEventListener('keydown', event => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      select(next.dataset.profileTab, { focus: true });
    });
  });
  root.querySelectorAll('[data-profile-show]').forEach(link => {
    link.addEventListener('click', () => select(link.dataset.profileShow, { focus: true, scroll: true }));
  });
  const initial = location.hash.slice(1);
  if (tabs.some(t => t.dataset.profileTab === initial)) select(initial);

  root.querySelectorAll('[data-password-toggle]').forEach(button => {
    const input = document.getElementById(button.getAttribute('aria-controls'));
    const label = button.getAttribute('aria-label').replace(/^Show /, '');
    button.addEventListener('click', () => {
      const visible = input.type === 'password';
      input.type = visible ? 'text' : 'password';
      button.setAttribute('aria-pressed', String(visible));
      button.setAttribute('aria-label', `${visible ? 'Hide' : 'Show'} ${label}`);
    });
  });

  const faqs = [...root.querySelectorAll('[data-faq]')];
  const closeFaq = details => {
    const body = details.querySelector('[data-faq-body]');
    details.setAttribute('data-closing', '');
    gsap.to(body, {
      height: 0, autoAlpha: 0, duration: 0.35, ease: 'power2.inOut', overwrite: true,
      onComplete: () => {
        details.open = false;
        details.removeAttribute('data-closing');
        gsap.set(body, { clearProps: 'height,opacity,visibility' });
      }
    });
  };
  const openFaq = details => {
    const body = details.querySelector('[data-faq-body]');
    details.removeAttribute('data-closing');
    details.open = true;
    gsap.fromTo(body, { height: 0, autoAlpha: 0 }, { height: 'auto', autoAlpha: 1, duration: 0.55, ease: 'power3.out', overwrite: true, clearProps: 'height,opacity,visibility' });
  };
  faqs.forEach(details => {
    details.querySelector('summary').addEventListener('click', event => {
      if (!animate()) return;
      event.preventDefault();
      if (details.open && !details.hasAttribute('data-closing')) return closeFaq(details);
      faqs.forEach(other => { if (other !== details && other.open) closeFaq(other); });
      openFaq(details);
    });
  });

  const resetPasswordFields = form => {
    form.reset();
    form.querySelectorAll('[data-password-input]').forEach(input => { input.type = 'password'; });
    form.querySelectorAll('[data-password-toggle]').forEach(button => {
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', button.getAttribute('aria-label').replace(/^Hide /, 'Show '));
    });
  };
  root.querySelector('[data-profile-password]')?.addEventListener('ajax-form:success', event => resetPasswordFields(event.currentTarget));

  const prefs = root.querySelector('[data-profile-notifications]');
  if (prefs && window.fetch) {
    const status = prefs.querySelector('[data-form-status]');
    prefs.querySelector('[data-profile-notifications-submit]').hidden = true;
    const say = (message, tone) => {
      status.dataset.tone = tone;
      status.textContent = message;
      status.hidden = false;
    };
    let timer, pending = Promise.resolve();
    const save = () => {
      pending = pending.then(async () => {
        try {
          const response = await fetch(prefs.action, {
            method: 'POST',
            body: new FormData(prefs),
            headers: { Accept: 'application/json' },
            credentials: 'same-origin'
          });
          const data = response.headers.get('content-type')?.includes('json') ? await response.json() : null;
          if (response.ok && data?.redirect) return window.location.assign(data.redirect);
          if (response.ok) say(data?.message || 'Preferences saved.', 'success');
          else say(data?.errors?.join(' ') || 'Could not save your preferences. Please try again.', 'error');
        } catch {
          say('Could not reach the server. Check your connection and try again.', 'error');
        }
      });
    };
    prefs.addEventListener('change', () => {
      clearTimeout(timer);
      say('Saving…', 'pending');
      timer = setTimeout(save, 300);
    });
    prefs.addEventListener('submit', event => {
      event.preventDefault();
      save();
    });
  }

  if (!animate()) return show();

  let context, split, disposed = false;
  const revertText = () => { split?.revert(); split = undefined; };
  const finish = () => {
    disposed = true;
    context?.revert();
    revertText();
    show();
  };
  reduced.addEventListener('change', () => { if (reduced.matches) finish(); });
  window.addEventListener('pagehide', finish, { once: true });

  const reveal = () => {
    if (disposed || reduced.matches) return show();
    try {
      if (SplitText) gsap.registerPlugin(SplitText);
      context = gsap.context(() => {
        const title = root.querySelector('[data-reveal-chars]');
        if (SplitText) split = SplitText.create(title, { type: 'words,chars', mask: 'chars' });
        const cards = panels.find(panel => !panel.hidden)?.querySelectorAll(':scope > [data-profile-card]') ?? [];
        gsap.timeline({
          delay: document.documentElement.hasAttribute('data-page-arrived') ? 0.55 : 0.1,
          defaults: { ease: 'power4.out' },
          onComplete: revertText
        })
          .from(split ? split.chars : title, { yPercent: 110, duration: 0.8, stagger: 0.025, clearProps: 'transform' }, 0)
          .from('[data-reveal-up]', { y: 14, autoAlpha: 0, duration: 0.6, ease: 'power3.out', clearProps: 'transform,opacity,visibility' }, 0.2)
          .from(tabs, { y: 16, scale: 0.9, autoAlpha: 0, duration: 0.7, ease: 'back.out(1.8)', stagger: 0.06, clearProps: 'transform,opacity,visibility' }, 0.3)
          .from(cards, { y: 40, autoAlpha: 0, borderRadius: '44px', duration: 0.8, ease: 'power3.out', stagger: 0.1, clearProps: 'transform,opacity,visibility,borderRadius' }, 0.45);
      }, root);
      show();
    } catch {
      finish();
    }
  };
  (document.fonts?.ready ?? Promise.resolve()).then(() => requestAnimationFrame(reveal));
})();
