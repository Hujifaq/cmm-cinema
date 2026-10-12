const test = require("node:test");
const assert = require("node:assert/strict");
const { advance, strike } = require("../wwwroot/js/hero-physics.js");

const step = 1 / 120;

function thrownBody(bounds, side, delay = 0) {
  const homeX = bounds.width * (side > 0 ? 0.25 : 0.75);
  const homeY = bounds.height * 0.45;
  const x = side > 0 ? -100 : bounds.width + 100;
  return {
    x, y: homeY + bounds.height * 0.1, homeX, homeY,
    vx: (homeX - x) * 3.2, vy: -bounds.height * 0.65,
    angle: -side, omega: side * 3.4,
    halfWidth: 60, halfHeight: 60, inertia: 2400, phase: 0,
    lastHit: -Infinity, lastImpulse: -Infinity, entrance: { delay }
  };
}

for (const bounds of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`left and right throws arc, overshoot and settle at ${bounds.width}px`, () => {
    for (const side of [1, -1]) {
      const body = thrownBody(bounds, side);
      let overshot = false, arced = false;
      advance([body], bounds, step, step);
      assert.ok(side > 0 ? body.x < 0 : body.x > bounds.width,
        "walls must allow the prop to start outside the hero");
      for (let frame = 2; frame <= 264; frame++) {
        advance([body], bounds, step, frame * step);
        overshot ||= (body.x - body.homeX) * side > 1;
        arced ||= body.y < body.homeY - 1;
      }
      assert.ok(overshot, "the catch should have visible momentum");
      assert.ok(arced, "the throw should arc above its resting position");
      assert.ok(Math.hypot(body.x - body.homeX, body.y - body.homeY) < 1);
      assert.ok(Math.abs(body.angle) < 0.005);
      assert.equal(body.entrance, null);
      const before = body.x;
      advance([body], bounds, step, 2.2 + step);
      assert.ok(Math.abs(body.x - before) < 1, "idle handoff should not jump");
    }
  });
}

test("delayed throws remain off-screen and ignore pointer impulses until settled", () => {
  const bounds = { width: 1440, height: 900 };
  const body = thrownBody(bounds, 1, 0.27);
  const initial = { ...body };
  for (let frame = 1; frame < 32; frame++) advance([body], bounds, step, frame * step);
  assert.equal(body.x, initial.x);
  assert.equal(body.y, initial.y);
  const point = { x: body.x, y: body.y };
  strike([body], point, point, { x: 1000, y: 0 }, 0.2, true);
  assert.equal(body.vx, initial.vx);
  for (let frame = 32; frame <= 300; frame++) advance([body], bounds, step, frame * step);
  assert.equal(body.entrance, null);
  const velocity = body.vx;
  const landed = { x: body.x, y: body.y };
  strike([body], landed, landed, { x: 1000, y: 0 }, 2.5, true);
  assert.notEqual(body.vx, velocity, "settled props should respond to swipes again");
});
