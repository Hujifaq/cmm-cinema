const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { JSDOM } = require('jsdom');

const source = readFileSync(join(__dirname, '../wwwroot/js/booking/ticket-tear.js'), 'utf8');

function setup({ reduced = false, gsapAvailable = true, lateGsap = false } = {}) {
  const dom = new JSDOM(`<article data-ticket-tear>
    <div data-ticket-seam></div>
    <div data-ticket-stub><p>Seats A8, VP2 (pair)</p></div>
  </article><a href="/">Return to homepage</a>`, { runScripts: 'outside-only' });
  const { window } = dom;
  const ticket = window.document.querySelector('article');
  const stub = ticket.querySelector('[data-ticket-stub]');
  let bottom = 900;
  let cleanup;
  let frameId = 0;
  const frames = new Map();
  window.innerHeight = 1000;
  ticket.querySelector('[data-ticket-seam]').getBoundingClientRect = () => ({ bottom });
  window.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
  window.cancelAnimationFrame = id => frames.delete(id);
  const gsap = {
      matchMedia: () => ({ add: (_, callback) => { if (!reduced) cleanup = callback(); } }),
      set: (element, values) => {
        element.style.transform = values.clearProps ? '' : `translateY(${values.y}px) rotate(${values.rotation}deg)`;
      }
  };
  if (gsapAvailable && !lateGsap) window.gsap = gsap;
  window.eval(source);
  if (gsapAvailable && lateGsap) window.gsap = gsap;
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  return {
    window, ticket, stub, frames,
    flush() { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback()); },
    move(value, event = 'scroll') { bottom = value; window.dispatchEvent(new window.Event(event)); },
    reduceMotion() { cleanup?.(); },
    close() { cleanup?.(); window.close(); }
  };
}

test('scroll progressively opens the perforation and reverses without changing ticket content', () => {
  const ui = setup();
  try {
    const content = ui.stub.textContent;
    ui.flush();
    assert.equal(ui.ticket.style.getPropertyValue('--ticket-tear-width'), '0%');
    ui.move(565);
    ui.flush();
    assert.equal(ui.ticket.style.getPropertyValue('--ticket-tear-width'), '50%');
    assert.equal(ui.stub.style.transform, 'translateY(7px) rotate(-0.35deg)');
    ui.move(100);
    ui.flush();
    assert.equal(ui.ticket.style.getPropertyValue('--ticket-tear-width'), '100%');
    ui.move(1100);
    ui.flush();
    assert.equal(ui.ticket.style.getPropertyValue('--ticket-tear-width'), '0%');
    assert.equal(ui.stub.textContent, content);
    assert.equal(ui.window.document.querySelector('a').getAttribute('href'), '/');
  } finally { ui.close(); }
});

test('scroll and resize events share a single pending animation frame', () => {
  const ui = setup();
  try {
    ui.flush();
    ui.move(565);
    ui.move(350, 'resize');
    ui.move(350, 'pageshow');
    assert.equal(ui.frames.size, 1);
    ui.flush();
    assert.equal(ui.ticket.style.getPropertyValue('--ticket-tear-width'), '100%');
  } finally { ui.close(); }
});

test('switching to reduced motion cancels updates and restores the joined ticket', () => {
  const ui = setup();
  try {
    ui.move(350);
    ui.flush();
    ui.move(400);
    ui.reduceMotion();
    assert.equal(ui.frames.size, 0);
    assert.equal(ui.ticket.hasAttribute('data-ticket-tear-ready'), false);
    assert.equal(ui.ticket.style.getPropertyValue('--ticket-tear-width'), '');
    assert.equal(ui.stub.style.transform, '');
    ui.move(350);
    assert.equal(ui.frames.size, 0);
  } finally { ui.close(); }
});

test('reduced motion or missing GSAP leaves all ticket details visible without animation', () => {
  for (const options of [{ reduced: true }, { gsapAvailable: false }]) {
    const ui = setup(options);
    try {
      assert.equal(ui.ticket.hasAttribute('data-ticket-tear-ready'), false);
      assert.equal(ui.frames.size, 0);
      assert.equal(ui.stub.style.transform, '');
      assert.match(ui.stub.textContent, /A8, VP2/);
    } finally { ui.close(); }
  }
});

test('initialises after the shared layout loads GSAP later in the deferred script order', () => {
  const ui = setup({ lateGsap: true });
  try {
    assert.equal(ui.ticket.hasAttribute('data-ticket-tear-ready'), true);
    ui.move(350);
    ui.flush();
    assert.equal(ui.ticket.style.getPropertyValue('--ticket-tear-width'), '100%');
  } finally { ui.close(); }
});
