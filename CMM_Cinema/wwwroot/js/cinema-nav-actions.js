(() => {
  'use strict';
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  document.querySelectorAll('[data-nav-actions]').forEach(group => {
    const pill = group.querySelector('[data-nav-action-pill]');
    const buttons = [...group.querySelectorAll('[data-nav-action]')];
    let hovered = null, active = null, animation = null;

    const show = (button, animate = false) => {
      const box = button?.getBoundingClientRect();
      if (!box?.width || !box.height) {
        animation?.cancel();
        animation = null;
        active = null;
        pill.style.opacity = '0';
        buttons.forEach(item => item.removeAttribute('data-nav-action-active'));
        return;
      }
      const origin = group.getBoundingClientRect();
      // Capture the currently drawn shape before interrupting a previous move.
      const previous = active ? pill.getBoundingClientRect() : null;
      animation?.cancel();
      animation = null;
      const x = box.left - origin.left, y = box.top - origin.top;
      const transform = `translate(${x}px, ${y}px) scale(1, 1)`;
      pill.style.width = `${box.width}px`;
      pill.style.height = `${box.height}px`;
      pill.style.transform = transform;
      pill.style.opacity = '1';
      buttons.forEach(item => item.toggleAttribute('data-nav-action-active', item === button));
      active = button;

      // FLIP animates only transform; each target keeps its true capsule radius.
      if (animate && previous?.width && !reduce.matches && pill.animate) {
        animation = pill.animate([
          { transform: `translate(${previous.left - origin.left}px, ${previous.top - origin.top}px) scale(${previous.width / box.width}, ${previous.height / box.height})` },
          { transform }
        ], { duration: 240, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
      }
    };
    const focused = () => buttons.find(button => button === document.activeElement);
    buttons.forEach(button => {
      button.addEventListener('pointerenter', event => {
        if (!fine.matches || event.pointerType !== 'mouse') return;
        hovered = button;
        show(button, true);
      });
      button.addEventListener('focus', () => show(button));
    });
    group.addEventListener('pointerleave', () => {
      hovered = null;
      show(focused());
    });
    group.addEventListener('focusout', () => queueMicrotask(() => show(focused() || hovered)));
    const resize = new ResizeObserver(() => { if (active) show(active); });
    resize.observe(group);
    buttons.forEach(button => resize.observe(button));
    fine.addEventListener('change', () => { hovered = null; show(focused()); });
    reduce.addEventListener('change', () => show(focused() || hovered));
    window.addEventListener('pagehide', () => { hovered = null; show(null); });
    group.dataset.actionsReady = '';
  });
})();
