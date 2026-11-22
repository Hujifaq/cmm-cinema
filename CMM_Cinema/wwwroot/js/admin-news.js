(() => {
  'use strict';

  const dialog = document.querySelector('[data-admin-story-delete-dialog]');
  if (dialog) {
    const name = dialog.querySelector('[data-admin-story-delete-name]');
    const id = dialog.querySelector('[data-admin-story-delete-id]');
    document.addEventListener('click', event => {
      const trigger = event.target.closest('[data-admin-story-delete]');
      if (!trigger) return;
      event.preventDefault();
      id.value = trigger.dataset.adminStoryId;
      name.textContent = trigger.dataset.adminStoryTitle;
      dialog._opener = trigger;
      dialog.showModal();
    });
    dialog.querySelector('[data-admin-story-delete-cancel]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => dialog._opener?.focus({ preventScroll: true }));
  }

  const input = document.querySelector('[data-cover-input]');
  const image = document.querySelector('[data-cover-image]');
  const note = document.querySelector('[data-cover-note]');
  if (!input || !image || !note) return;

  const MIN_RATIO = 1.4;
  let timer;
  const say = (message, tone) => {
    note.textContent = message;
    if (tone) note.dataset.tone = tone; else delete note.dataset.tone;
  };

  image.addEventListener('load', () => {
    const { naturalWidth: width, naturalHeight: height } = image;
    if (!width || !height) return;
    if (width < height * MIN_RATIO) {
      const message = `This image is ${width}×${height}. News covers need a landscape (16:9) image, like a movie landscape poster or still.`;
      input.setCustomValidity(message);
      say(message, 'error');
      return;
    }
    input.setCustomValidity('');
    say(width < 1280 ? `${width}×${height}. Landscape, but small, so it may look soft.` : `${width}×${height}. Landscape, good to go.`);
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
      say(value ? 'Use a full https:// link.' : 'Paste a link to see the cover here.', value ? 'error' : undefined);
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
