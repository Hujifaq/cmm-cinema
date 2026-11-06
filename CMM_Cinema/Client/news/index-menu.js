// "Index" menu in the navigation: a list of every story. On the gallery page picking one moves
// the slider to that disc (news-disc-gallery.js listens for [data-disc-goto]); elsewhere it opens the story.
export function initIndexMenu() {
  document.querySelectorAll('[data-disc-index-menu]').forEach(menu => {
    if (menu.dataset.indexMenuInit === 'true') return;
    menu.dataset.indexMenuInit = 'true';
    const toggle = menu.querySelector('[data-disc-index-toggle]');
    const panel = menu.querySelector('[data-disc-index-panel]');
    if (!toggle || !panel) return;

    const setOpen = open => {
      toggle.setAttribute('aria-expanded', String(open));
      menu.toggleAttribute('data-open', open);
      panel.hidden = !open;
      if (open) {
        const current = panel.querySelector('[aria-current="true"]');
        if (current) current.scrollIntoView({ block: 'nearest' });
      }
    };
    setOpen(false);

    toggle.addEventListener('click', e => {
      e.preventDefault();
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    panel.addEventListener('click', e => {
      if (e.target instanceof Element && e.target.closest('a, button')) setOpen(false);
    });
    document.addEventListener('pointerdown', e => {
      if (toggle.getAttribute('aria-expanded') === 'true' && !menu.contains(e.target)) setOpen(false);
    });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || toggle.getAttribute('aria-expanded') !== 'true') return;
      setOpen(false);
      toggle.focus();
    });
  });
}
