const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');

const source = readFileSync(join(__dirname, '../wwwroot/js/cinema-nav-actions.js'), 'utf8');

function setup({ reduced = false, finePointer = true } = {}) {
  const element = box => ({
    box, style: {}, dataset: {}, attributes: new Set(), listeners: {},
    getBoundingClientRect() { return this.box; },
    toggleAttribute(name, value) { if (value) this.attributes.add(name); else this.attributes.delete(name); },
    removeAttribute(name) { this.attributes.delete(name); },
    addEventListener(name, callback) { this.listeners[name] = callback; },
    emit(name, event = {}) { this.listeners[name]?.(event); }
  });
  const group = element({ left: 100, top: 20, width: 172, height: 44 });
  const search = element({ left: 100, top: 20, width: 44, height: 44 });
  const account = element({ left: 148, top: 20, width: 124, height: 44 });
  const pill = element({ ...search.box });
  const fine = element(), reduce = element(), window = element();
  const document = { activeElement: null, querySelectorAll: () => [group] };
  fine.matches = finePointer;
  reduce.matches = reduced;
  window.matchMedia = query => query.includes('reduce') ? reduce : fine;
  group.querySelector = () => pill;
  group.querySelectorAll = () => [search, account];
  const animations = [], resizes = [];
  pill.animate = (frames, options) => {
    const animation = { frames, options, cancelled: false, cancel() { this.cancelled = true; } };
    animations.push(animation);
    return animation;
  };
  runInNewContext(source, { window, document, queueMicrotask,
    ResizeObserver: class { constructor(callback) { resizes.push(callback); } observe() {} }
  });
  return { group, search, account, pill, reduce, fine, document, animations, resizes };
}
const mouse = { pointerType: 'mouse' };

test('one pill moves between controls and rapid changes continue from the visible shape', () => {
  const ui = setup();
  ui.search.emit('pointerenter', mouse);
  assert.equal(ui.pill.style.opacity, '1');
  assert.ok(ui.search.attributes.has('data-nav-action-active'));
  ui.account.emit('pointerenter', mouse);
  assert.equal(ui.animations.length, 1);
  assert.equal(ui.pill.style.width, '124px');
  ui.pill.box = { left: 125, top: 20, width: 70, height: 44 };
  ui.search.emit('pointerenter', mouse);
  assert.ok(ui.animations[0].cancelled);
  assert.ok(ui.animations[1].frames[0].transform.startsWith('translate(25px, 0px)'));
  assert.ok(ui.animations[1].frames[0].transform.includes(`scale(${70 / 44}, 1)`));
  assert.ok(!ui.account.attributes.has('data-nav-action-active'));
});

test('leaving dismisses the pill unless a control retains keyboard focus', () => {
  const ui = setup();
  ui.search.emit('pointerenter', mouse);
  ui.group.emit('pointerleave');
  assert.equal(ui.pill.style.opacity, '0');
  ui.document.activeElement = ui.account;
  ui.account.emit('focus');
  ui.group.emit('pointerleave');
  assert.equal(ui.pill.style.opacity, '1');
  assert.ok(ui.account.attributes.has('data-nav-action-active'));
});

test('keyboard focus and reduced motion update position without movement animations', () => {
  const ui = setup({ reduced: true });
  ui.search.emit('pointerenter', mouse);
  ui.account.emit('pointerenter', mouse);
  assert.equal(ui.animations.length, 0);
  ui.reduce.matches = false;
  ui.search.emit('focus');
  assert.equal(ui.animations.length, 0);
});

test('touch does not trigger hover and hidden controls remove stale highlights', () => {
  const ui = setup();
  ui.search.emit('pointerenter', { pointerType: 'touch' });
  assert.equal(ui.pill.style.opacity, undefined);
  ui.account.emit('pointerenter', mouse);
  ui.account.box = { left: 0, top: 0, width: 0, height: 0 };
  ui.resizes[0]();
  assert.equal(ui.pill.style.opacity, '0');
  assert.ok(!ui.account.attributes.has('data-nav-action-active'));
});
