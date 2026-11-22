(() => {
  'use strict';

  const filter = document.querySelector('[data-admin-ticket-filter]');
  if (filter) {
    const rows = [...document.querySelectorAll('[data-admin-ticket-row]')];
    const list = rows[0]?.parentElement;
    const empty = document.querySelector('[data-admin-ticket-empty]');
    filter.addEventListener('input', () => {
      const terms = filter.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      let shown = 0;
      rows.forEach(row => {
        const match = terms.every(term => row.dataset.search.includes(term));
        row.hidden = !match;
        if (match) shown++;
      });
      if (list) list.hidden = shown === 0;
      if (empty) empty.hidden = shown !== 0;
    });
  }

  const dialog = document.querySelector('[data-admin-ticket-dialog]');
  const trigger = document.querySelector('[data-admin-ticket-cancel]');
  if (dialog && trigger && typeof dialog.showModal === 'function') {
    trigger.addEventListener('click', event => {
      event.preventDefault();
      dialog.showModal();
    });
    dialog.querySelector('[data-admin-ticket-dialog-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => trigger.focus({ preventScroll: true }));
  }
})();
