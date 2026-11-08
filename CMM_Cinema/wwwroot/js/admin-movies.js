(() => {
  'use strict';

  const dialog = document.querySelector('[data-delete-dialog]');
  if (dialog) {
    const name = dialog.querySelector('[data-delete-name]');
    const id = dialog.querySelector('[data-delete-id]');
    document.addEventListener('click', event => {
      const trigger = event.target.closest('[data-movie-delete]');
      if (!trigger) return;
      event.preventDefault();
      id.value = trigger.dataset.movieId;
      name.textContent = trigger.dataset.movieTitle;
      dialog.showModal();
      dialog._opener = trigger;
    });
    dialog.querySelector('[data-delete-cancel]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => dialog._opener?.focus({ preventScroll: true }));
  }

  const list = document.querySelector('[data-cast-list]');
  if (list) {
    const rows = list.querySelector('[data-cast-rows]');
    const template = list.querySelector('[data-cast-template]');
    const reindex = () => rows.querySelectorAll('[data-cast-row]').forEach((row, index) => {
      row.querySelectorAll('input').forEach(input => {
        input.name = input.name.replace(/Cast\[[^\]]*\]/, `Cast[${index}]`);
      });
    });
    list.querySelector('[data-cast-add]').addEventListener('click', () => {
      rows.append(template.content.cloneNode(true));
      reindex();
      rows.querySelector('[data-cast-row]:last-child input')?.focus();
    });
    list.addEventListener('click', event => {
      const remove = event.target.closest('[data-cast-remove]');
      if (!remove) return;
      const row = remove.closest('[data-cast-row]');
      if (rows.querySelectorAll('[data-cast-row]').length === 1) {
        row.querySelectorAll('input').forEach(input => { input.value = ''; });
        return;
      }
      row.remove();
      reindex();
    });
  }

  const page = document.querySelector('[data-movie-detail]');
  const toggle = document.querySelector('[data-edit-toggle]');
  if (page && toggle) {
    const field = name => page.querySelector(`[data-field="${name}"]`);
    const status = page.querySelector('[data-edit-status]');
    const save = page.querySelector('[data-edit-save]');
    const idleMessage = status.textContent;
    const poster = page.querySelector('[data-detail-poster]');
    const originalPoster = field('posterUrl').value;

    const setStatus = (message, error) => {
      status.textContent = message;
      status.classList.toggle('text-cinema-brick', Boolean(error));
    };
    const grow = area => { area.style.height = 'auto'; area.style.height = `${area.scrollHeight + 2}px`; };
    const growAll = () => page.querySelectorAll('[data-autosize]').forEach(grow);

    const setEditing = on => {
      page.toggleAttribute('data-editing', on);
      toggle.setAttribute('aria-pressed', String(on));
      toggle.querySelector('[data-edit-toggle-label]').textContent = on ? 'Stop editing' : 'Edit this page';
      if (on) {
        growAll();
        setStatus(idleMessage);
        field('title').focus({ preventScroll: true });
        field('title').scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    };
    toggle.addEventListener('click', () => {
      if (page.hasAttribute('data-editing')) location.reload();
      else setEditing(true);
    });
    page.querySelector('[data-edit-cancel]').addEventListener('click', () => location.reload());
    page.addEventListener('input', event => { if (event.target.matches('[data-autosize]')) grow(event.target); });

    // Show the pasted poster link right away, so the admin can see it before saving.
    field('posterUrl').addEventListener('input', event => {
      const value = event.target.value.trim();
      let image = poster.querySelector('img');
      if (!/^https:\/\//i.test(value)) { if (image) image.src = originalPoster || ''; return; }
      if (!image) {
        image = document.createElement('img');
        image.className = 'absolute inset-0 size-full object-cover';
        image.alt = '';
        poster.firstElementChild?.append(image);
      }
      image.src = value;
    });

    page.addEventListener('keydown', event => {
      if ((event.metaKey || event.ctrlKey) && event.key === 's' && page.hasAttribute('data-editing')) {
        event.preventDefault();
        save.click();
      }
    });

    save.addEventListener('click', async () => {
      const value = name => field(name).value.trim();
      const body = {
        title: value('title'),
        genre: value('genre'),
        durationMinutes: Number(value('durationMinutes')) || 0,
        rating: value('rating'),
        language: value('language'),
        synopsis: value('synopsis'),
        overview: value('overview'),
        status: value('status'),
        releaseDate: value('releaseDate') || null,
        posterUrl: value('posterUrl') || null,
        trailerUrl: value('trailerUrl') || null
      };
      const token = document.querySelector('input[name="__RequestVerificationToken"]')?.value ?? '';
      save.disabled = true;
      setStatus('Saving...');
      try {
        const response = await fetch(`${location.pathname.replace(/\/$/, '')}/QuickSave`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', RequestVerificationToken: token },
          body: JSON.stringify(body)
        });
        if (response.ok) { location.reload(); return; }
        const problem = response.status === 400 ? await response.json().catch(() => null) : null;
        setStatus(problem?.errors?.length ? problem.errors.join(' ') : 'Could not save. Please try again.', true);
      } catch {
        setStatus('Could not reach the server. Please try again.', true);
      }
      save.disabled = false;
    });
  }
})();
