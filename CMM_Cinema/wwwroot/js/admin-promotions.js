(() => {
  'use strict';

  const dialog = document.querySelector('[data-admin-promo-delete-dialog]');
  if (dialog) {
    const name = dialog.querySelector('[data-admin-promo-delete-name]');
    const id = dialog.querySelector('[data-admin-promo-delete-id]');
    document.addEventListener('click', event => {
      const trigger = event.target.closest('[data-admin-promo-delete]');
      if (!trigger) return;
      event.preventDefault();
      id.value = trigger.dataset.adminPromoId;
      name.textContent = `Banner ${trigger.dataset.adminPromoPosition}`;
      dialog._opener = trigger;
      dialog.showModal();
    });
    dialog.querySelector('[data-admin-promo-delete-cancel]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => dialog._opener?.focus({ preventScroll: true }));
  }

  const input = document.querySelector('[data-promo-input]');
  const image = document.querySelector('[data-promo-image]');
  const note = document.querySelector('[data-promo-note]');
  if (!input || !image || !note) return;

  const MIN_RATIO = 1.65;
  const MAX_RATIO = 1.9;
  let timer;
  const say = (message, tone) => {
    note.textContent = message;
    if (tone) note.dataset.tone = tone; else delete note.dataset.tone;
  };

  image.addEventListener('load', () => {
    const { naturalWidth: width, naturalHeight: height } = image;
    if (!width || !height) return;
    const ratio = width / height;
    if (ratio < MIN_RATIO || ratio > MAX_RATIO) {
      const message = `This image is ${width}×${height}. Banners need a 16:9 image, so nothing gets cropped.`;
      input.setCustomValidity(message);
      say(message, 'error');
      return;
    }
    input.setCustomValidity('');
    say(width < 1400 ? `${width}×${height}. 16:9, but small, so it may look soft.` : `${width}×${height}. 16:9, good to go.`);
  });
  image.addEventListener('error', () => {
    input.setCustomValidity('');
    say("Couldn't load an image from that link. Check it opens in a browser.", 'error');
  });

  const refresh = () => {
    const value = input.value.trim();
    input.setCustomValidity('');
    if (!/^https:\/\//i.test(value)) {
      image.hidden = true;
      image.removeAttribute('src');
      say(value ? 'Use a full https:// link.' : 'Paste a link to see the banner here.', value ? 'error' : undefined);
      return;
    }
    say('Checking image...');
    image.hidden = false;
    image.src = value;
  };
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(refresh, 300);
  });
  if (!image.hidden && image.complete && image.naturalWidth) image.dispatchEvent(new Event('load'));
})();
