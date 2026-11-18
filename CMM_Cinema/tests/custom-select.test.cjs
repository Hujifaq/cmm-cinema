const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { JSDOM } = require('jsdom');

const source = readFileSync(join(__dirname, '../wwwroot/js/booking/custom-select.js'), 'utf8');

function setup(selected = '') {
  const dom = new JSDOM(`<form><div class="booking-field"><span class="sr-only" id="cinema-label">Select cinema</span>
    <select name="cinemaId" aria-labelledby="cinema-label" data-custom-select>
      <option value="">All Cinemas</option><option value="1">CMM Studio</option><option value="2">CMM CB12</option>
    </select></div></form><button id="outside">Outside</button>`, { runScripts: 'outside-only', pretendToBeVisual: true });
  dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  const d = dom.window.document;
  d.querySelector('select').value = selected;
  dom.window.eval(source);
  const changes = [];
  d.querySelector('select').addEventListener('change', event => changes.push({ value: event.target.value, bubbles: event.bubbles }));
  return { dom, d, select: d.querySelector('select'), trigger: d.querySelector('.bk-select__trigger'), panel: d.querySelector('.bk-select__panel'), options: [...d.querySelectorAll('.bk-select__option')], changes };
}
const key = (ui, target, name) => target.dispatchEvent(new ui.dom.window.KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));

test('replaces the select with an accessible listbox that mirrors its options and value', () => {
  const ui = setup('2');
  try {
    assert.equal(ui.select.classList.contains('bk-select__native'), true);
    assert.equal(ui.select.getAttribute('aria-hidden'), 'true');
    assert.equal(ui.select.tabIndex, -1);
    assert.equal(ui.trigger.textContent.trim(), 'CMM CB12');
    assert.equal(ui.trigger.getAttribute('aria-haspopup'), 'listbox');
    assert.equal(ui.trigger.getAttribute('aria-expanded'), 'false');
    assert.match(ui.trigger.getAttribute('aria-labelledby'), /^cinema-label /);
    assert.equal(ui.panel.hidden, true);
    assert.deepEqual(ui.options.map(o => o.textContent.trim()), ['All Cinemas', 'CMM Studio', 'CMM CB12']);
    assert.deepEqual(ui.options.map(o => o.getAttribute('aria-selected')), ['false', 'false', 'true']);
    assert.equal(ui.d.querySelector('[role="listbox"]').getAttribute('aria-labelledby'), 'cinema-label');
  } finally { ui.dom.window.close(); }
});

test('clicking an option sets the native value, updates the label and fires a bubbling change once', () => {
  const ui = setup('');
  try {
    ui.trigger.click();
    assert.equal(ui.panel.hidden, false);
    assert.equal(ui.trigger.getAttribute('aria-expanded'), 'true');
    assert.equal(ui.d.querySelector('[role="listbox"]').getAttribute('aria-activedescendant'), ui.options[0].id);
    ui.options[1].click();
    assert.equal(ui.select.value, '1');
    assert.equal(ui.trigger.textContent.trim(), 'CMM Studio');
    assert.equal(ui.options[1].getAttribute('aria-selected'), 'true');
    assert.equal(ui.panel.hidden, true);
    assert.deepEqual(ui.changes, [{ value: '1', bubbles: true }]);

    ui.trigger.click();
    ui.options[1].click();
    assert.equal(ui.changes.length, 1, 'Re-picking the current value fires nothing');
  } finally { ui.dom.window.close(); }
});

test('keyboard: arrows move, Enter picks, typing jumps, Escape and an outside click close without changing', () => {
  const ui = setup('');
  try {
    key(ui, ui.trigger, 'ArrowDown');
    assert.equal(ui.panel.hidden, false);
    const list = ui.d.querySelector('[role="listbox"]');
    key(ui, list, 'ArrowDown'); key(ui, list, 'ArrowDown');
    assert.equal(list.getAttribute('aria-activedescendant'), ui.options[2].id);
    key(ui, list, 'Enter');
    assert.equal(ui.select.value, '2');

    key(ui, ui.trigger, 'Enter');
    key(ui, list, 'c'); key(ui, list, 'm'); key(ui, list, 'm'); key(ui, list, ' '); key(ui, list, 's');
    assert.equal(list.getAttribute('aria-activedescendant'), ui.options[1].id, 'Typing "cmm s" jumps to CMM Studio');
    key(ui, list, 'Escape');
    assert.equal(ui.panel.hidden, true);
    assert.equal(ui.select.value, '2', 'Escape keeps the current value');

    ui.trigger.click();
    ui.d.querySelector('#outside').dispatchEvent(new ui.dom.window.Event('pointerdown', { bubbles: true }));
    assert.equal(ui.panel.hidden, true);
    assert.equal(ui.changes.length, 1);
  } finally { ui.dom.window.close(); }
});
