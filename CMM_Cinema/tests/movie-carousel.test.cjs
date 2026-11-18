const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { JSDOM } = require('jsdom');

const source = readFileSync(join(__dirname, '../wwwroot/js/now-showing.js'), 'utf8');

function setup() {
  const dom = new JSDOM(`
    <div data-carousel><div data-movie-swiper><div data-movie-poster></div></div>
      <button data-carousel-prev></button><button data-carousel-next></button></div>
    <div data-carousel><div data-movie-swiper><div data-movie-poster></div></div>
      <button data-carousel-prev></button><button data-carousel-next></button></div>
    <div data-movie-swiper id="no-wrapper"></div>`, { runScripts: 'outside-only' });
  const w = dom.window;
  const created = [];
  w.Swiper = function Swiper(element, options) { created.push({ element, options }); };
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  const observed = [];
  w.ResizeObserver = class { constructor(callback) { this.callback = callback; } observe(target) { observed.push(target); } };
  const rect = (top, height) => () => ({ top, height, left: 0, width: 0, right: 0, bottom: top + height });
  w.document.querySelectorAll('[data-carousel]').forEach(el => { el.getBoundingClientRect = rect(100, 800); });
  w.document.querySelectorAll('[data-movie-poster]').forEach(el => { el.getBoundingClientRect = rect(100, 576); });
  w.eval(source);
  return { dom, d: w.document, created, observed };
}

test('trackpad swipes glide the cards sideways, and only sideways, handing back to the page at the ends', () => {
  const ui = setup();
  try {
    assert.equal(ui.created.length, 3);
    const options = ui.created[0].options;
    assert.equal(options.freeMode.enabled, true);
    assert.equal(options.freeMode.momentum, true);
    assert.equal(options.mousewheel.forceToAxis, true, 'Vertical scrolling stays with the page');
    assert.equal(options.mousewheel.releaseOnEdges, true, 'Scrolling is released at either end');
    assert.equal(options.grabCursor, true);
  } finally { ui.dom.window.close(); }
});

test('each carousel wires its own arrows, and the swipe listens across the whole hover area', () => {
  const ui = setup();
  try {
    const wrappers = [...ui.d.querySelectorAll('[data-carousel]')];
    assert.deepEqual(wrappers.map(w => w.id), ['movie-carousel-1', 'movie-carousel-2']);
    wrappers.forEach((wrap, i) => {
      const { navigation, mousewheel } = ui.created[i].options;
      assert.equal(navigation.prevEl, wrap.querySelector('[data-carousel-prev]'));
      assert.equal(navigation.nextEl, wrap.querySelector('[data-carousel-next]'));
      assert.equal(mousewheel.eventsTarget, `#${wrap.id}`, 'A swipe over an arrow still moves the carousel');
    });
    assert.equal(ui.created[0].options.a11y.prevSlideMessage, 'Previous movies');
    assert.equal(ui.created[0].options.a11y.nextSlideMessage, 'Next movies');
  } finally { ui.dom.window.close(); }
});

test('arrows sit level with the middle of the posters and follow their size; a carousel without a wrapper still works', () => {
  const ui = setup();
  try {
    ui.d.querySelectorAll('[data-carousel]').forEach(wrap => {
      assert.equal(wrap.style.getPropertyValue('--arrow-top'), '288.0px', 'Poster top is the wrapper top, so the middle is half its 576px');
    });
    assert.equal(ui.observed.length, 2, 'Resizing the poster re-centres the arrows');
    const bare = ui.created[2];
    assert.equal(bare.element.id, 'no-wrapper');
    assert.equal(bare.options.navigation, false, 'No wrapper means no arrows, but the carousel still starts');
    assert.equal(bare.options.mousewheel.eventsTarget, bare.element);
  } finally { ui.dom.window.close(); }
});
