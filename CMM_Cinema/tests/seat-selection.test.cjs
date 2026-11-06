const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { JSDOM } = require('jsdom');
const source = readFileSync(join(__dirname, '../wwwroot/js/booking/seat-selection.js'), 'utf8');
function setup(sidebar = false) {
  const seats = [['D',4,'Normal',300,1,false],['C',12,'Premium',330,1,false],['VP',1,'VIP',900,2,false],['VP',2,'VIP',900,2,false],['A',3,'Premium',330,1,false],['VP',3,'VIP',900,2,true]];
  const chairs = seats.map(([row,number,type,price,capacity,sold]) => `<label class="bk-seat"><input type="checkbox" name="seatIds" value="${row}${number}" data-seat-row="${row}" data-seat-number="${number}" data-seat-type="${type}" data-seat-price="${price}" data-seat-capacity="${capacity}" ${sold ? 'disabled' : ''}><span class="bk-seat-chair"></span></label>`).join('');
  const summary = `<div data-selected-seats>None yet</div><span data-seat-total></span><button type="submit" form="seat-reservation" data-seat-submit></button>`;
  const dom = new JSDOM(`<div data-seat-selection><form id="seat-reservation" data-seat-form data-max="4">${chairs}<p role="status" data-seat-feedback></p>${sidebar ? '' : summary}</form>${sidebar ? `<aside>${summary}</aside>` : ''}</div>`, { runScripts: 'outside-only' });
  dom.window.eval(source);
  return { dom, d: dom.window.document, inputs: [...dom.window.document.querySelectorAll('input')] };
}
test('mixed categories sum their individual prices and charge one VIP pair for two admissions', () => {
  const ui = setup();
  try {
    assert.equal(ui.d.querySelector('[data-selected-seats]').textContent, 'None yet');
    ui.inputs[0].click(); ui.inputs[1].click(); ui.inputs[2].click();
    assert.equal(ui.d.querySelector('[data-selected-seats]').textContent, 'D4, C12, VP1');
    assert.equal(ui.d.querySelector('[data-seat-total]').textContent, '฿1,530');
    assert.match(ui.d.querySelector('[data-seat-feedback]').textContent, /4 of 4 admissions/);
    assert.equal(ui.d.querySelector('[data-seat-submit]').disabled, false);
    assert.deepEqual([...new ui.dom.window.FormData(ui.d.querySelector('form')).getAll('seatIds')], ['D4','C12','VP1']);
    assert.equal(ui.inputs[3].disabled, true);
    assert.equal(ui.inputs[4].disabled, true);
  } finally { ui.dom.window.close(); }
});
test('one remaining admission permits singles but blocks pairs; deselection restores availability', () => {
  const ui = setup();
  try {
    ui.inputs[2].click(); ui.inputs[0].click();
    assert.equal(ui.inputs[3].disabled, true);
    assert.equal(ui.inputs[1].disabled, false);
    ui.inputs[0].click();
    assert.equal(ui.inputs[3].disabled, false);
    assert.equal(ui.inputs[5].disabled, true);
    assert.equal(ui.d.querySelector('[data-seat-total]').textContent, '฿900');
    ui.inputs[2].click();
    assert.equal(ui.d.querySelector('[data-selected-seats]').textContent, 'None yet');
    assert.equal(ui.d.querySelector('[data-seat-total]').textContent, '฿0');
    assert.equal(ui.d.querySelector('[data-seat-submit]').disabled, true);
  } finally { ui.dom.window.close(); }
});
test('two VIP pairs fill four admissions, and a sold pair remains disabled after clearing selection', () => {
  const ui = setup();
  try {
    ui.inputs[2].click(); ui.inputs[3].click();
    assert.equal(ui.d.querySelector('[data-seat-total]').textContent, '฿1,800');
    assert.equal(ui.inputs[0].disabled, true);
    ui.inputs[2].click(); ui.inputs[3].click();
    assert.equal(ui.inputs[0].disabled, false);
    assert.equal(ui.inputs[5].disabled, true);
  } finally { ui.dom.window.close(); }
});

test('sidebar summary stays in sync and its external button submits the selected seats', () => {
  const ui = setup(true);
  try {
    const form = ui.d.querySelector('form');
    const button = ui.d.querySelector('[data-seat-submit]');
    assert.equal(form.contains(button), false);
    assert.equal(button.form, form);
    assert.equal(button.disabled, true);
    ui.inputs[0].click(); ui.inputs[2].click();
    assert.equal(ui.d.querySelector('[data-selected-seats]').textContent, 'D4, VP1');
    assert.equal(ui.d.querySelector('[data-seat-total]').textContent, '฿1,200');
    let submitted = false;
    form.addEventListener('submit', event => {
      event.preventDefault();
      submitted = true;
      assert.deepEqual([...new ui.dom.window.FormData(form).getAll('seatIds')], ['D4', 'VP1']);
    });
    button.click();
    assert.equal(submitted, true);
    ui.inputs[0].click(); ui.inputs[2].click();
    assert.equal(button.disabled, true);
    assert.equal(ui.d.querySelector('[data-seat-total]').textContent, '฿0');
  } finally { ui.dom.window.close(); }
});
