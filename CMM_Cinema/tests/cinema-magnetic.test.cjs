const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');

const source = readFileSync(join(__dirname, '../wwwroot/js/cinema-magnetic.js'), 'utf8');

function setup({ reduced = false, finePointer = true, disabled = false, withGsap = true } = {}) {
  const element = () => ({
    listeners: {},
    addEventListener(name, callback) { (this.listeners[name] ??= []).push(callback); },
    emit(name, event = {}) { this.listeners[name]?.forEach(callback => callback(event)); }
  });
  const button = element(), visual = element(), icon = element();
  const fine = element(), reduce = element();
  fine.matches = finePointer;
  reduce.matches = reduced;
  button.disabled = disabled;
  button.querySelector = selector => ({ '[data-magnetic-visual]': visual, '[data-magnetic-icon]': icon })[selector];
  button.getBoundingClientRect = () => ({ left: 0, top: 0, width: 56, height: 56 });
  const calls = [];
  const gsap = {
    to(targets, vars) { calls.push({ method: 'to', targets, vars }); },
    set(targets, vars) { calls.push({ method: 'set', targets, vars }); }
  };
  const window = { matchMedia: query => query.includes('reduce') ? reduce : fine };
  if (withGsap) window.gsap = gsap;
  runInNewContext(source, { window, document: { querySelectorAll: () => [button] } });
  const tweensFor = target => calls.filter(call => call.method === 'to' && call.targets === target);
  return { button, visual, icon, fine, reduce, calls, tweensFor };
}

const mouse = { pointerType: 'mouse', clientX: 54, clientY: 8 };

test('the cream surface leans toward the pointer and the arrow leans half as far', () => {
  const ui = setup();
  ui.button.emit('pointermove', mouse);
  const [surface] = ui.tweensFor(ui.visual);
  const [arrow] = ui.tweensFor(ui.icon);
  assert.deepEqual({ x: surface.vars.x, y: surface.vars.y }, { x: 13, y: -10 });
  assert.deepEqual({ x: arrow.vars.x, y: arrow.vars.y }, { x: 6.5, y: -5 });
  for (const tween of [surface, arrow]) {
    assert.equal(tween.vars.duration, 0.4);
    assert.equal(tween.vars.ease, 'power3.out');
    assert.equal(tween.vars.overwrite, 'auto', 'new moves hand off smoothly instead of stacking');
  }
  assert.equal(ui.tweensFor(ui.button).length, 0, 'the hit target itself never moves');
});

test('leaving or cancelling springs both layers home with an elastic ease', () => {
  for (const name of ['pointerleave', 'pointercancel']) {
    const ui = setup();
    ui.button.emit('pointermove', mouse);
    ui.button.emit(name);
    const release = ui.calls.at(-1);
    assert.equal(release.method, 'to');
    assert.deepEqual([...release.targets], [ui.visual, ui.icon]);
    assert.deepEqual({ x: release.vars.x, y: release.vars.y }, { x: 0, y: 0 });
    assert.equal(release.vars.ease, 'elastic.out(1, 0.3)');
    assert.equal(release.vars.overwrite, 'auto');
  }
});

test('touch, coarse pointers, reduced motion and disabled buttons avoid the magnetic effect', () => {
  const cases = [
    [setup(), { ...mouse, pointerType: 'touch' }],
    [setup({ finePointer: false }), mouse],
    [setup({ reduced: true }), mouse],
    [setup({ disabled: true }), mouse]
  ];
  for (const [ui, event] of cases) {
    ui.button.emit('pointermove', event);
    assert.equal(ui.tweensFor(ui.visual).length, 0);
    assert.equal(ui.tweensFor(ui.icon).length, 0);
  }
});

test('preference changes clear any leftover transform immediately', () => {
  for (const media of ['fine', 'reduce']) {
    const ui = setup();
    ui.button.emit('pointermove', mouse);
    ui[media].emit('change');
    const reset = ui.calls.at(-1);
    assert.equal(reset.method, 'set');
    assert.deepEqual([...reset.targets], [ui.visual, ui.icon]);
    assert.equal(reset.vars.clearProps, 'transform');
  }
});

test('without GSAP the arrows stay static and nothing throws', () => {
  const ui = setup({ withGsap: false });
  assert.equal(ui.button.listeners.pointermove, undefined);
});
