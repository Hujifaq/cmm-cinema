((root, factory) => {
  const physics = factory();
  if (typeof module === "object" && module.exports) module.exports = physics;
  else root.CinemaHeroPhysics = physics;
})(typeof window === "undefined" ? globalThis : window, () => {
  "use strict";

  const STEP = 1 / 120;
  const RESTITUTION = 0.82;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const cross = (x, y, nx, ny) => x * ny - y * nx;

  const axes = body => {
    const c = Math.cos(body.angle), s = Math.sin(body.angle);
    return [[c, s], [-s, c]];
  };

  function wall(body, bounds, time) {
    const c = Math.abs(Math.cos(body.angle)), s = Math.abs(Math.sin(body.angle));
    const rx = body.halfWidth * c + body.halfHeight * s;
    const ry = body.halfWidth * s + body.halfHeight * c;
    const minX = Math.min(bounds.width / 2, rx + 8);
    const maxX = Math.max(bounds.width / 2, bounds.width - rx - 8);
    const minY = Math.min(bounds.height / 2, ry + 8);
    const maxY = Math.max(bounds.height / 2, bounds.height - ry - 8);
    let hit = false;

    if (body.x < minX) {
      body.x = minX;
      if (body.vx < 0) { body.vx *= -RESTITUTION; hit = true; }
    } else if (body.x > maxX) {
      body.x = maxX;
      if (body.vx > 0) { body.vx *= -RESTITUTION; hit = true; }
    }
    if (body.y < minY) {
      body.y = minY;
      if (body.vy < 0) { body.vy *= -RESTITUTION; hit = true; }
    } else if (body.y > maxY) {
      body.y = maxY;
      if (body.vy > 0) { body.vy *= -RESTITUTION; hit = true; }
    }
    if (hit) {
      body.omega *= 0.75;
      if (Math.hypot(body.vx, body.vy) > 80) body.lastHit = time;
    }
  }

  function collide(a, b, time) {
    const aa = axes(a), ba = axes(b);
    let overlap = Infinity, nx = 0, ny = 0;
    for (const axis of [...aa, ...ba]) {
      // Insets approximate the solid clay inside each trimmed image rectangle.
      const radius = (body, basis) => 0.8 * (
        body.halfWidth * Math.abs(axis[0] * basis[0][0] + axis[1] * basis[0][1]) +
        body.halfHeight * Math.abs(axis[0] * basis[1][0] + axis[1] * basis[1][1]));
      const distance = (b.x - a.x) * axis[0] + (b.y - a.y) * axis[1];
      const penetration = radius(a, aa) + radius(b, ba) - Math.abs(distance);
      if (penetration <= 0) return;
      if (penetration < overlap) {
        overlap = penetration;
        nx = axis[0] * (distance < 0 ? -1 : 1);
        ny = axis[1] * (distance < 0 ? -1 : 1);
      }
    }

    const correction = Math.max(0, overlap - 0.4) * 0.5;
    a.x -= nx * correction; a.y -= ny * correction;
    b.x += nx * correction; b.y += ny * correction;
    const contactX = (a.x + b.x) / 2, contactY = (a.y + b.y) / 2;
    const ax = contactX - a.x, ay = contactY - a.y;
    const bx = contactX - b.x, by = contactY - b.y;
    const rvx = b.vx - b.omega * by - a.vx + a.omega * ay;
    const rvy = b.vy + b.omega * bx - a.vy - a.omega * ax;
    const speed = rvx * nx + rvy * ny;
    if (speed >= 0) return;
    const ar = cross(ax, ay, nx, ny), br = cross(bx, by, nx, ny);
    const impulse = -(1 + RESTITUTION) * speed / (2 + ar * ar / a.inertia + br * br / b.inertia);
    a.vx -= impulse * nx; a.vy -= impulse * ny;
    b.vx += impulse * nx; b.vy += impulse * ny;
    a.omega = clamp(a.omega - ar * impulse / a.inertia, -4, 4);
    b.omega = clamp(b.omega + br * impulse / b.inertia, -4, 4);
    if (speed < -4) a.lastHit = b.lastHit = time;
  }

  function advance(bodies, bounds, dt, time) {
    for (const body of bodies) {
      const phase = body.phase;
      if (body.entrance) {
        if (time < body.entrance.delay) continue;
        // Launch velocity supplies the throw; damped springs catch each prop at
        // its art-directed home, allowing a small overshoot and angular wobble.
        body.vx += ((body.homeX - body.x) * 36 - body.vx * 8) * dt;
        body.vy += ((body.homeY - body.y) * 36 - body.vy * 8) * dt;
        body.omega += (-body.angle * 26 - body.omega * 7) * dt;
        body.x += body.vx * dt;
        body.y += body.vy * dt;
        body.angle += body.omega * dt;
        // Keep walls and pointer impulses out of the launch, including its
        // off-screen start. Resume the same simulation once it has settled.
        if (time >= body.entrance.delay + 2.2) body.entrance = null;
        continue;
      }
      // Let thrown props coast and rebound before gently settling into their float.
      if (time - body.lastHit > 6) {
        const tx = body.homeX + Math.sin(time * 0.65 + phase) * 8;
        const ty = body.homeY + Math.sin(time * 0.85 + phase) * 12;
        const angle = Math.sin(time * 0.55 + phase) * 0.045;
        body.vx += ((tx - body.x) * 4 - body.vx * 3.4) * dt;
        body.vy += ((ty - body.y) * 4 - body.vy * 3.4) * dt;
        const turn = Math.atan2(Math.sin(angle - body.angle), Math.cos(angle - body.angle));
        body.omega += (turn * 4 - body.omega * 3.4) * dt;
      } else {
        body.vx *= Math.exp(-0.18 * dt);
        body.vy *= Math.exp(-0.18 * dt);
        body.omega *= Math.exp(-0.55 * dt);
      }
      body.x += body.vx * dt;
      body.y += body.vy * dt;
      body.angle += body.omega * dt;
      wall(body, bounds, time);
    }
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        if (!bodies[i].entrance && !bodies[j].entrance) collide(bodies[i], bodies[j], time);
      }
    }
    // Pair separation cannot push an object outside the visible hero.
    for (const body of bodies) if (!body.entrance) wall(body, bounds, time);
  }

  function strike(bodies, from, to, velocity, time, tap = false) {
    for (const body of bodies) {
      if (body.entrance) continue;
      if (time - body.lastImpulse < 0.12) continue;
      const c = Math.cos(body.angle), s = Math.sin(body.angle);
      const rx = body.halfWidth * 0.9 + 12, ry = body.halfHeight * 0.9 + 12;
      const local = p => {
        const x = p.x - body.x, y = p.y - body.y;
        return { x: (x * c + y * s) / rx, y: (-x * s + y * c) / ry };
      };
      const a = local(from), b = local(to);
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = clamp(-(a.x * dx + a.y * dy) / (dx * dx + dy * dy || 1), 0, 1);
      const px = a.x + dx * t, py = a.y + dy * t;
      // Sweep the entire pointer segment, so a fast swipe cannot tunnel through.
      if (px * px + py * py > 1) continue;
      const pointX = from.x + (to.x - from.x) * t;
      const pointY = from.y + (to.y - from.y) * t;
      let nx = body.x - pointX, ny = body.y - pointY;
      let distance = Math.hypot(nx, ny);
      if (distance < 1) {
        nx = velocity.x || Math.cos(body.phase);
        ny = velocity.y || -1;
        distance = Math.hypot(nx, ny);
      }
      nx /= distance; ny /= distance;
      const speed = Math.hypot(velocity.x, velocity.y);
      const force = clamp((tap ? 420 : 220) + speed * 0.55, 220, 1050);
      const ix = nx * force + velocity.x * 0.2;
      const iy = ny * force + velocity.y * 0.2;
      body.vx += ix; body.vy += iy;
      const total = Math.hypot(body.vx, body.vy);
      if (total > 1250) { body.vx *= 1250 / total; body.vy *= 1250 / total; }
      body.omega = clamp(body.omega + cross(pointX - body.x, pointY - body.y, ix, iy) / body.inertia, -4, 4);
      body.lastHit = body.lastImpulse = time;
    }
  }

  function mount(hero, elements, { throwIn = false } = {}) {
    const hover = window.matchMedia("(hover: hover) and (pointer: fine)");
    const bounds = { width: 0, height: 0 };
    const bodies = elements.map((element, index) => ({
      element, phase: index * 1.7, x: 0, y: 0, homeX: 0, homeY: 0,
      vx: 0, vy: 0, angle: 0, omega: 0, halfWidth: 0, halfHeight: 0,
      inertia: 1, lastHit: -Infinity, lastImpulse: -Infinity,
      entrance: throwIn ? { delay: index * 0.09 } : null,
      transform: element.style.transform, willChange: element.style.willChange
    }));
    let rect, ready = false, stopped = false, frame = 0, lastFrame = 0;
    let elapsed = 0, accumulator = 0, pointer = null;

    const measure = () => {
      rect = hero.getBoundingClientRect();
      const sx = bounds.width ? hero.clientWidth / bounds.width : 1;
      const sy = bounds.height ? hero.clientHeight / bounds.height : 1;
      bounds.width = hero.clientWidth; bounds.height = hero.clientHeight;
      for (const body of bodies) {
        const element = body.element;
        const x = element.offsetLeft + element.offsetWidth / 2;
        const y = element.offsetTop + element.offsetHeight / 2;
        body.x = x + (ready ? (body.x - body.homeX) * sx : 0);
        body.y = y + (ready ? (body.y - body.homeY) * sy : 0);
        body.homeX = x; body.homeY = y;
        body.halfWidth = element.offsetWidth / 2;
        body.halfHeight = element.offsetHeight / 2;
        body.inertia = (element.offsetWidth ** 2 + element.offsetHeight ** 2) / 12 || 1;
        if (body.entrance) {
          if (!ready) {
            const side = x < bounds.width / 2 ? 1 : -1;
            // A diagonal radius keeps even the rotated artwork fully off-screen.
            const radius = Math.hypot(body.halfWidth, body.halfHeight) + 24;
            body.x = side > 0 ? -radius : bounds.width + radius;
            body.y = y + bounds.height * 0.1;
            body.vx = (x - body.x) * 3.2;
            body.vy = -bounds.height * 0.65;
            body.angle = -side * (0.9 + body.phase * 0.08);
            body.omega = side * 3.4;
          } else {
            body.vx *= sx;
            body.vy *= sy;
          }
        } else {
          wall(body, bounds, elapsed);
        }
        element.style.willChange = "transform";
      }
      ready = true;
      pointer = null;
    };
    const paint = () => bodies.forEach(body => {
      body.element.style.transform = `translate3d(${(body.x - body.homeX).toFixed(2)}px, ${(body.y - body.homeY).toFixed(2)}px, 0) rotate(${body.angle.toFixed(4)}rad)`;
    });
    const tick = stamp => {
      if (stopped) return;
      if (lastFrame) accumulator += Math.min((stamp - lastFrame) / 1000, 0.05);
      lastFrame = stamp;
      while (accumulator >= STEP) {
        elapsed += STEP;
        advance(bodies, bounds, STEP, elapsed);
        accumulator -= STEP;
      }
      paint();
      frame = window.requestAnimationFrame(tick);
    };
    const clearPointer = () => { pointer = null; };
    const move = event => {
      if (!hover.matches || event.pointerType === "touch") return;
      const point = { x: event.clientX - rect.left, y: event.clientY - rect.top, stamp: event.timeStamp };
      if (pointer) {
        const dt = clamp((point.stamp - pointer.stamp) / 1000, 1 / 240, 0.08);
        const velocity = { x: (point.x - pointer.x) / dt, y: (point.y - pointer.y) / dt };
        const speed = Math.hypot(velocity.x, velocity.y);
        if (speed > 2600) { velocity.x *= 2600 / speed; velocity.y *= 2600 / speed; }
        strike(bodies, pointer, point, velocity, elapsed);
      }
      pointer = point;
    };
    const tap = event => {
      const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      strike(bodies, point, point, { x: 0, y: 0 }, elapsed, true);
    };
    const scroll = () => { rect = hero.getBoundingClientRect(); clearPointer(); };
    const visibility = () => {
      window.cancelAnimationFrame(frame);
      lastFrame = 0; accumulator = 0; clearPointer();
      if (!document.hidden && !stopped) { measure(); frame = window.requestAnimationFrame(tick); }
    };
    const observer = new ResizeObserver(() => { measure(); paint(); });
    measure();
    paint();
    observer.observe(hero);
    bodies.forEach(body => observer.observe(body.element));
    hero.addEventListener("pointermove", move, { passive: true });
    hero.addEventListener("pointerdown", tap, { passive: true });
    hero.addEventListener("pointerleave", clearPointer);
    window.addEventListener("blur", clearPointer);
    window.addEventListener("scroll", scroll, { passive: true });
    document.addEventListener("visibilitychange", visibility);
    hero.setAttribute("data-physics-ready", "");
    if (!document.hidden) frame = window.requestAnimationFrame(tick);

    return () => {
      stopped = true;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      hero.removeEventListener("pointermove", move);
      hero.removeEventListener("pointerdown", tap);
      hero.removeEventListener("pointerleave", clearPointer);
      window.removeEventListener("blur", clearPointer);
      window.removeEventListener("scroll", scroll);
      document.removeEventListener("visibilitychange", visibility);
      hero.removeAttribute("data-physics-ready");
      bodies.forEach(body => {
        body.element.style.transform = body.transform;
        body.element.style.willChange = body.willChange;
      });
    };
  }

  return { mount, advance, strike, wall };
});
