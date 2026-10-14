const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');

const source = readFileSync(join(__dirname, '../wwwroot/js/cinema-promos.js'), 'utf8');

function setup(reduced = false) {
  const element = () => ({ listeners: {}, addEventListener(name, callback) { this.listeners[name] = callback; } });
  const root = element(), section = element(), motion = element();
  const controls = { hidden: true };
  motion.matches = reduced;
  section.querySelector = selector => ({
    '[data-promo-swiper]': root,
    '[data-promo-controls]': controls
  })[selector] ?? {};
  let instance;
  class Swiper {
    constructor(_, params) { this.params = params; this.slides = [1, 2, 3]; this.calls = []; instance = this; }
    slideNext(speed) { this.calls.push(['next', speed]); }
    slidePrev(speed) { this.calls.push(['previous', speed]); }
    slideTo(index, speed) { this.calls.push(['to', index, speed]); }
    update() { this.updated = true; }
  }
  runInNewContext(source, { Swiper, window: { Swiper, matchMedia: () => motion },
    document: { querySelectorAll: () => [section] } });
  return { root, section, motion, controls, swiper: instance };
}

test('keyboard navigation is instant and controls are revealed', () => {
  const ui = setup();
  assert.equal(ui.controls.hidden, false);
  let prevented = false;
  ui.root.listeners.keydown({ key: 'ArrowRight', preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.deepEqual(ui.swiper.calls, [['next', 0]]);
});

test('reduced motion makes slides instant and follows preference changes', () => {
  const ui = setup(true);
  assert.equal(ui.swiper.params.speed, 0);
  ui.motion.matches = false;
  ui.motion.listeners.change();
  assert.ok(ui.swiper.params.speed > 0);
  assert.equal(ui.swiper.updated, true);
});

test('pointer controls glide, keyboard controls are instant, and a new drag restores speed', () => {
  const ui = setup();
  ui.section.listeners.click({ detail: 0 });
  assert.equal(ui.swiper.params.speed, 0);
  ui.swiper.params.on.touchStart(ui.swiper);
  assert.ok(ui.swiper.params.speed > 0);
  ui.section.listeners.click({ detail: 1 });
  assert.ok(ui.swiper.params.speed > 0);
});

test('missing Swiper leaves the static promotion fallback alone', () => {
  runInNewContext(source, { window: {} });
});
