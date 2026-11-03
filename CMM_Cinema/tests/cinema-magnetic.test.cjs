const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');

const source = readFileSync(join(__dirname, '../wwwroot/js/cinema-magnetic.js'), 'utf8');

function setup({ reduced = false, finePointer = true } = {}) {
  const element = () => ({
    listeners: {}, attributes: new Set(),
    style: { removeProperty(name) { delete this[name]; } },
    addEventListener(name, callback) { (this.listeners[name] ??= []).push(callback); },
    emit(name, event = {}) { this.listeners[name]?.forEach(callback => callback(event)); },
    toggleAttribute(name, enabled) { if (enabled) this.attributes.add(name); else this.attributes.delete(name); }
  });
  const button = element(), visual = element(), body = element(), icon = element();
  const fine = element(), reduce = element(), document = element(), window = element();
  fine.matches = finePointer;
  reduce.matches = reduced;
  button.querySelector = selector => ({ '[data-magnetic-visual]': visual, '[data-magnetic-body]': body,
    '[data-magnetic-icon]': icon })[selector];
  button.getBoundingClientRect = () => ({ left: 0, top: 0, width: 56, height: 56 });
  document.querySelectorAll = () => [button];
  window.matchMedia = query => query.includes('reduce') ? reduce : fine;
  let now = 0, id = 0;
  const frames = new Map();
  runInNewContext(source, { window, document, Math, performance: { now: () => now },
    requestAnimationFrame(callback) { frames.set(++id, callback); return id; },
    cancelAnimationFrame(frame) { frames.delete(frame); }
  });
  const step = (count = 1) => {
    for (let i = 0; i < count; i++) {
      now += 1000 / 60;
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach(callback => callback(now));
    }
  };
  return { button, visual, body, reduce, fine, frames, step, window, document };
}
const mouse = { pointerType: 'mouse', clientX: 54, clientY: 28 };

test('magnetism reverses smoothly, returns home on leave, and stops requesting frames', () => {
  const ui = setup();
  ui.button.emit('pointerenter', mouse);
  ui.step(15);
  assert.ok(parseFloat(ui.visual.style.transform.match(/translate\(([-.\d]+)/)[1]) > 0);
  const before = ui.visual.style.transform;
  ui.button.emit('pointermove', { ...mouse, clientX: 2 });
  assert.equal(ui.visual.style.transform, before, 'retargeting preserves the current position');
  ui.step(20);
  assert.ok(parseFloat(ui.visual.style.transform.match(/translate\(([-.\d]+)/)[1]) < 0);
  ui.button.emit('pointerleave');
  ui.step(360);
  assert.ok(Math.abs(parseFloat(ui.visual.style.transform.match(/translate\(([-.\d]+)/)[1])) < .01);
  assert.equal(ui.frames.size, 0);
  assert.equal(ui.button.style.transform, undefined, 'the hit target stays fixed');
});

test('rapid pointer clicks jiggle in both directions, settle, and preserve normal click delivery', () => {
  const ui = setup();
  ui.button.emit('pointerenter', mouse);
  ui.button.emit('pointerdown', mouse);
  ui.step(5);
  ui.button.emit('pointerup');
  const click = { detail: 1, preventDefault() { assert.fail('navigation must remain native'); } };
  ui.button.emit('click', click);
  ui.step(5);
  assert.ok(parseFloat(ui.visual.style.transform.match(/rotate\(([-.\d]+)/)[1]) > 0);
  ui.button.emit('click', click);
  const angles = [];
  for (let i = 0; i < 120; i++) {
    ui.step();
    angles.push(parseFloat(ui.visual.style.transform.match(/rotate\(([-.\d]+)/)[1]));
  }
  assert.ok(Math.max(...angles) > 2, 'the click gives a visible rotational impulse');
  assert.ok(Math.min(...angles) < -.2, 'the spring overshoots before settling');
  ui.step(360);
  assert.equal(ui.frames.size, 0);
  assert.ok(!ui.body.style.transform.includes('NaN'));
});

test('a long press releases and settles even without a click event', () => {
  const ui = setup();
  ui.button.emit('pointerdown', mouse);
  ui.step(360);
  assert.equal(ui.frames.size, 0);
  const held = ui.body.style.transform;
  ui.button.emit('pointerup');
  assert.ok(ui.frames.size > 0);
  ui.step(360);
  assert.notEqual(ui.body.style.transform, held);
  assert.equal(ui.frames.size, 0);
});

test('touch, keyboard, and reduced-motion interactions avoid the magnetic effect', () => {
  const touch = setup({ finePointer: false });
  touch.button.emit('pointerenter', { ...mouse, pointerType: 'touch' });
  touch.button.emit('click', { detail: 1 });
  assert.equal(touch.frames.size, 0);
  const reduced = setup({ reduced: true });
  reduced.button.emit('pointerenter', mouse);
  assert.equal(reduced.frames.size, 0);
  const keyboard = setup();
  keyboard.button.emit('pointerenter', mouse);
  keyboard.step(5);
  keyboard.button.emit('keydown', { key: 'Enter' });
  keyboard.button.emit('click', { detail: 0 });
  assert.equal(keyboard.frames.size, 0);
  assert.equal(keyboard.visual.style.transform, undefined);
});

test('preference changes and hidden pages cancel active effects immediately', () => {
  const ui = setup();
  ui.button.emit('pointerenter', mouse);
  ui.step(5);
  ui.reduce.matches = true;
  ui.reduce.emit('change');
  assert.equal(ui.frames.size, 0);
  assert.equal(ui.button.attributes.has('data-magnetic-ready'), false);
  assert.equal(ui.visual.style.transform, undefined);
  ui.reduce.matches = false;
  ui.reduce.emit('change');
  ui.button.emit('pointerenter', mouse);
  ui.document.hidden = true;
  ui.document.emit('visibilitychange');
  assert.equal(ui.frames.size, 0);
});
