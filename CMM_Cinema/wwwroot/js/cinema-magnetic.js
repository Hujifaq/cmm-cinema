(() => {
  'use strict';
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const enabled = () => fine.matches && !reduce.matches;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  document.querySelectorAll('[data-magnetic-arrow]').forEach(button => {
    const visual = button.querySelector('[data-magnetic-visual]');
    const body = button.querySelector('[data-magnetic-body]');
    const icon = button.querySelector('[data-magnetic-icon]');
    // A damped spring retains its velocity when a gesture reverses.
    // mass: 1, stiffness: 100, damping: 10.
    const axes = ['x', 'y', 'scale', 'squash', 'rotation'];
    const value = { x: 0, y: 0, scale: 1, squash: 0, rotation: 0 };
    const velocity = { x: 0, y: 0, scale: 0, squash: 0, rotation: 0 };
    const target = { ...value };
    let frame = 0, previous = 0, rect, inside = false;
    let direction = { x: 1, y: 0 };

    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
      inside = false;
      axes.forEach(axis => {
        value[axis] = target[axis] = axis === 'scale' ? 1 : 0;
        velocity[axis] = 0;
      });
      [visual, body, icon].forEach(element => element.style.removeProperty('transform'));
      button.toggleAttribute('data-magnetic-ready', enabled());
    };

    const draw = now => {
      frame = 0;
      let remaining = previous ? Math.min((now - previous) / 1000, .032) : 1 / 60;
      previous = now;
      while (remaining > 0) {
        const dt = Math.min(remaining, 1 / 120);
        axes.forEach(axis => {
          velocity[axis] += ((target[axis] - value[axis]) * 100 - velocity[axis] * 10) * dt;
          value[axis] += velocity[axis] * dt;
        });
        remaining -= dt;
      }
      const { x, y, scale, squash, rotation } = value;
      const stretch = 1 + Math.min(.13, Math.hypot(x, y) / 110) + squash * .12;
      const angle = Math.atan2(y, x) * 180 / Math.PI;
      visual.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
      body.style.transform = `rotate(${angle}deg) scale(${stretch * scale}, ${scale / stretch})`;
      icon.style.transform = `translate(${x * .18}px, ${y * .18}px) scale(${scale})`;
      const moving = axes.some(axis => Math.abs(target[axis] - value[axis]) > .001 || Math.abs(velocity[axis]) > .001);
      if (moving) frame = requestAnimationFrame(draw);
      else previous = 0;
    };
    const wake = () => { if (!frame) frame = requestAnimationFrame(draw); };
    const move = event => {
      if (!enabled() || event.pointerType !== 'mouse' || button.disabled) return;
      if (!inside) {
        rect = button.getBoundingClientRect();
        inside = true;
      }
      const dx = clamp((event.clientX - rect.left - rect.width / 2) / (rect.width / 2), -1, 1);
      const dy = clamp((event.clientY - rect.top - rect.height / 2) / (rect.height / 2), -1, 1);
      const distance = Math.max(1, Math.hypot(dx, dy));
      target.x = dx / distance * 14;
      target.y = dy / distance * 14;
      const length = Math.hypot(dx, dy);
      direction = length > .01 ? { x: dx / length, y: dy / length } : { x: 1, y: 0 };
      wake();
    };
    button.addEventListener('pointerenter', move);
    button.addEventListener('pointermove', move);
    const release = () => {
      if (!inside) return;
      inside = false;
      target.x = target.y = target.squash = target.rotation = 0;
      target.scale = 1;
      wake();
    };
    button.addEventListener('pointerleave', release);
    button.addEventListener('pointercancel', reset);
    button.addEventListener('pointerdown', event => {
      if (!enabled() || event.pointerType !== 'mouse' || button.disabled) return;
      move(event);
      target.scale = .91;
      target.squash = 1;
      wake();
    });
    button.addEventListener('pointerup', () => {
      if (!inside) return;
      target.scale = 1;
      target.squash = 0;
      wake();
    });
    button.addEventListener('click', event => {
      if (!enabled() || !inside || event.detail === 0 || button.disabled) return;
      target.scale = 1;
      target.squash = 0;
      // A bounded impulse adds a directional wobble without restarting the spring.
      velocity.scale = clamp(velocity.scale + 1.1, -1.5, 1.5);
      velocity.squash = clamp(velocity.squash - 4, -5, 5);
      velocity.rotation = clamp(velocity.rotation + (direction.x < 0 ? -140 : 140), -180, 180);
      velocity.x = clamp(velocity.x + direction.x * 38, -80, 80);
      velocity.y = clamp(velocity.y + direction.y * 38, -80, 80);
      wake();
    });
    // Keyboard focus, page changes and preference changes stop decoration immediately.
    button.addEventListener('keydown', reset);
    fine.addEventListener('change', reset);
    reduce.addEventListener('change', reset);
    window.addEventListener('pagehide', reset);
    document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
    window.addEventListener('scroll', () => { if (inside) release(); }, { passive: true });
    window.addEventListener('resize', reset);
    reset();
  });
})();
