const test = require('node:test');
const assert = require('node:assert/strict');
const { gsap } = require('../wwwroot/lib/gsap/gsap.min.js');
const { createNavSearchTransition } = require('../Client/nav-search-transition.cjs');

function setup(width = 1120) {
  const nav = { getBoundingClientRect: () => ({ top: 24, width, height: 78 }), width, height: 78, marginInline: '', overflow: '', opacity: 1, y: 0, clipPath: '', backgroundColor: 'rgba(0,0,0,.55)' };
  const top = { opacity: 1 };
  const stage = { getBoundingClientRect: () => ({ width: Math.min(768, width) }), width: Math.min(768, width), y: 0, opacity: 0, visibility: 'hidden', get autoAlpha() { return this.opacity; }, set autoAlpha(value) { this.opacity = value; this.visibility = value === 0 ? 'hidden' : 'visible'; }, clipPath: '' };
  const events = [];
  const timeline = createNavSearchTransition({ gsap, nav, top, stage,
    onOpened: () => events.push('opened'), onClosed: () => events.push('closed') });
  return { nav, top, stage, timeline, events };
}

test('navbar fully disappears before spotlight expands from zero at the same center', () => {
  const ui = setup();
  ui.timeline.time(.44);
  assert.equal(ui.nav.width, 0);
  assert.equal(ui.nav.opacity, 0);
  assert.equal(ui.top.opacity, 0);
  assert.equal(ui.stage.width, 0);
  assert.equal(ui.stage.opacity, 0);
  assert.equal(ui.stage.visibility, 'hidden');
  ui.timeline.time(.55);
  assert.ok(ui.stage.width > 0);
  assert.equal(ui.nav.opacity, 0, 'the two surfaces never overlap');
  for (const time of [.16, .42, .46, .8, 1.26]) {
    ui.timeline.time(time);
    assert.equal(ui.nav.y, 0, 'navbar never travels vertically');
    assert.equal(ui.stage.y, 0, 'search anchor never travels vertically');
    assert.equal(ui.nav.backgroundColor, 'rgba(0,0,0,.55)');
  }
  assert.equal(ui.nav.opacity, 0);
  assert.equal(ui.stage.opacity, 1);
  assert.equal(ui.stage.width, 768);
  assert.deepEqual(ui.events, ['opened']);
  ui.timeline.kill();
});

test('closing mid-transition reverses current values instead of restarting', () => {
  const ui = setup();
  ui.timeline.time(.6);
  const interrupted = ui.stage.width;
  ui.timeline.reverse();
  assert.equal(ui.stage.width, interrupted);
  ui.timeline.pause().time(.49);
  assert.ok(ui.stage.width < interrupted);
  ui.timeline.progress(0);
  assert.equal(ui.nav.opacity, 1);
  assert.equal(ui.top.opacity, 1);
  assert.equal(ui.stage.opacity, 0);
  assert.equal(ui.nav.width, 1120);
  assert.deepEqual(ui.events, ['closed']);
  ui.timeline.kill();
});

test('narrow viewports expand to the navbar width and stay stationary', () => {
  const ui = setup(366);
  ui.timeline.progress(1);
  assert.equal(ui.stage.width, 366);
  assert.equal(ui.stage.y, 0);
  ui.timeline.reverse().progress(0);
  assert.equal(ui.nav.width, 366);
  ui.timeline.kill();
});

test('the eased elastic morph can reopen during its return', () => {
  const ui = setup();
  assert.equal(ui.timeline.duration(), 1.26);
  ui.timeline.time(.9).reverse().pause().time(.6);
  const current = ui.stage.width;
  ui.timeline.play();
  assert.equal(ui.stage.width, current);
  ui.timeline.pause().progress(1);
  assert.deepEqual(ui.events, ['opened']);
  ui.timeline.kill();
});


test('the expansion eases past its resting width and rebounds before settling', () => {
  const ui = setup();
  const widths = [];
  for (let time = .47; time < 1.26; time += .01) {
    ui.timeline.time(time);
    widths.push(ui.stage.width);
  }
  assert.ok(Math.max(...widths) > 768, 'elastic reveal overshoots the resting edge');
  const overshoot = widths.findIndex(value => value > 768);
  assert.ok(widths.slice(overshoot).some(value => value < 768), 'edge rebounds inward before settling');
  ui.timeline.progress(1);
  assert.equal(ui.stage.width, 768);
  ui.timeline.kill();
});


test('reverse handoff also collapses completely before the navbar returns', () => {
  const ui = setup();
  ui.timeline.progress(1).reverse().pause().time(.44);
  assert.equal(ui.stage.width, 0);
  assert.equal(ui.stage.visibility, 'hidden');
  assert.equal(ui.nav.width, 0);
  assert.equal(ui.nav.opacity, 0);
  ui.timeline.time(.3);
  assert.ok(ui.nav.width > 0);
  assert.equal(ui.stage.opacity, 0);
  ui.timeline.kill();
});
