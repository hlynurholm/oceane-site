(function () {
'use strict';

// ── State ─────────────────────────────────────────────────────────────────────
const PAGE = document.getElementById('op-projects') ? 'home' : 'project';
let editMode = false, dirty = false;
let projects = [];
let indexEdits = []; // [{selector, html?, attr?}] for saving index.html
let history = [];    // undo stack

// ── Toolbar ───────────────────────────────────────────────────────────────────
const bar = document.createElement('div');
bar.id = 'op-edit-bar';
bar.innerHTML = `
  <span class="op-edit-label">OCEANE EDITOR</span>
  <div class="op-edit-sep"></div>
  <button class="op-edit-btn op-edit-toggle" id="op-toggle">Edit</button>
  <div class="op-edit-spacer"></div>
  <button class="op-edit-btn" id="op-undo" disabled title="Undo (⌘Z)">Undo</button>
  <button class="op-edit-btn op-edit-btn-primary" id="op-save">Save</button>
  <button class="op-edit-btn op-edit-btn-blue" id="op-push">Push to Git</button>
  <button class="op-edit-btn op-edit-btn-danger" id="op-reset">Reset</button>
  <div class="op-edit-snaps-wrap">
    <button class="op-edit-btn" id="op-snaps-btn">History ▾</button>
    <div class="op-edit-snaps-panel" id="op-snaps-panel" hidden></div>
  </div>
`;
document.body.prepend(bar);

const toggleBtn = document.getElementById('op-toggle');
const undoBtn   = document.getElementById('op-undo');
const saveBtn   = document.getElementById('op-save');
const pushBtn   = document.getElementById('op-push');
const resetBtn  = document.getElementById('op-reset');
const snapsBtn  = document.getElementById('op-snaps-btn');
const snapsPanel = document.getElementById('op-snaps-panel');

// Push modal
const pushModal = document.createElement('div');
pushModal.id = 'op-push-modal';
pushModal.hidden = true;
pushModal.innerHTML = `
  <div class="op-push-modal-box">
    <p class="op-push-modal-title">Push to GitHub</p>
    <p class="op-push-modal-sub">A snapshot of the current files will be saved locally before pushing.</p>
    <input class="op-push-modal-input" id="op-commit-msg" placeholder="Commit message (optional)" value="Update site content">
    <div class="op-push-modal-btns">
      <button class="op-edit-btn" id="op-push-cancel">Cancel</button>
      <button class="op-edit-btn op-edit-btn-blue" id="op-push-confirm">Push</button>
    </div>
  </div>
`;
document.body.appendChild(pushModal);

// Toast
const toast = document.createElement('div');
toast.id = 'op-toast';
document.body.appendChild(toast);

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  const r = await fetch('/api/projects');
  projects = await r.json();
  updateUndoBtn();
}
init();

// ── Toolbar events ────────────────────────────────────────────────────────────
toggleBtn.addEventListener('click', () => editMode ? exitEditMode() : enterEditMode());

undoBtn.addEventListener('click', undo);

saveBtn.addEventListener('click', save);

pushBtn.addEventListener('click', () => {
  pushModal.hidden = false;
  document.getElementById('op-commit-msg').select();
});

document.getElementById('op-push-cancel').addEventListener('click', () => { pushModal.hidden = true; });

document.getElementById('op-push-confirm').addEventListener('click', async () => {
  const msg = document.getElementById('op-commit-msg').value.trim() || 'Update site content';
  pushModal.hidden = true;
  pushBtn.disabled = true;
  pushBtn.textContent = 'Pushing…';
  try {
    const r = await fetch('/api/git-push', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    showToast(d.noop ? 'Nothing to push — already up to date.' : 'Pushed to GitHub!');
  } catch (e) {
    alert('Push failed:\n\n' + e.message);
  } finally {
    pushBtn.disabled = false;
    pushBtn.textContent = 'Push to Git';
  }
});

resetBtn.addEventListener('click', async () => {
  const choice = confirm('Reset to last commit? This discards all unsaved changes.\n\nOr click Cancel if you only want to discard in-editor changes and reload.');
  if (!choice) {
    location.reload();
    return;
  }
  try {
    const r = await fetch('/api/git-reset', { method: 'POST' });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    dirty = false;
    location.reload();
  } catch (e) { alert('Reset failed:\n\n' + e.message); }
});

snapsBtn.addEventListener('click', async (e) => {
  e.stopPropagation();
  const isHidden = snapsPanel.hidden;
  snapsPanel.hidden = !isHidden;
  if (!snapsPanel.hidden) await loadSnapsPanel();
});

document.addEventListener('click', (e) => {
  if (!snapsPanel.contains(e.target) && e.target !== snapsBtn) snapsPanel.hidden = true;
});

async function loadSnapsPanel() {
  snapsPanel.innerHTML = '<div class="op-snaps-empty">Loading…</div>';
  const r = await fetch('/api/snapshots');
  const snaps = await r.json();
  if (!snaps.length) { snapsPanel.innerHTML = '<div class="op-snaps-empty">No snapshots yet.<br>One is created before each push.</div>'; return; }
  snapsPanel.innerHTML = snaps.map(s => {
    const label = s.replace('T', ' ').replace(/-(\d\d)-(\d\d)-(\d\d)$/, ':$1:$2');
    return `<div class="op-snap-item"><span class="op-snap-label">${label}</span><button class="op-snap-restore" data-snap="${s}">Restore</button></div>`;
  }).join('');
  snapsPanel.querySelectorAll('.op-snap-restore').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(`Restore snapshot from ${btn.dataset.snap}? Current files will be overwritten.`)) return;
      snapsPanel.hidden = true;
      const r = await fetch(`/api/restore/${btn.dataset.snap}`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) { alert('Restore failed:\n\n' + d.error); return; }
      showToast('Restored! Reloading…');
      setTimeout(() => location.reload(), 800);
    });
  });
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    undo();
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault();
    save();
  }
  if (e.key === 'Escape') {
    pushModal.hidden = true;
    snapsPanel.hidden = true;
  }
});

// ── Edit mode ─────────────────────────────────────────────────────────────────
function enterEditMode() {
  editMode = true;
  toggleBtn.textContent = 'Viewing';
  toggleBtn.classList.add('op-edit-toggle-active');
  document.body.classList.add('op-edit-mode');
  if (PAGE === 'home') setupHomeEditing();
  else setupProjectEditing();
}

function exitEditMode() {
  editMode = false;
  toggleBtn.textContent = 'Edit';
  toggleBtn.classList.remove('op-edit-toggle-active');
  document.body.classList.remove('op-edit-mode');
  // Remove all contenteditable attrs and edit overlays
  document.querySelectorAll('[contenteditable]').forEach(el => {
    el.removeAttribute('contenteditable');
    if (el._opFocus) el.removeEventListener('focus', el._opFocus);
    if (el._opInput) el.removeEventListener('input', el._opInput);
  });
  document.querySelectorAll('.op-img-replace, .op-img-replace-img, .op-media-remove, .op-media-add-row, .op-proj-edit-btn, .op-video-url-btn').forEach(el => el.remove());
}

// ── Homepage editing ──────────────────────────────────────────────────────────
function setupHomeEditing() {
  // Static text → writes back to index.html on save
  makeIndexEditable(document.querySelector('.op-hero h1'), '.op-hero h1');
  makeIndexEditable(document.querySelector('.op-hero-sub'), '.op-hero-sub');
  makeIndexEditable(document.querySelector('.op-footer h2'), '.op-footer h2');
  makeIndexEditable(document.querySelector('.op-footer-note'), '.op-footer-note');

  // Hero background photo
  const heroBg = document.querySelector('.op-hero-media-img');
  if (heroBg) addBgReplace(heroBg, fn => {
    heroBg.style.backgroundImage = `url(assets/photos/${fn})`;
    setIndexAttrEdit('.op-hero-media-img', 'style', `background-image:url(assets/photos/${fn})`);
    markDirty();
  });

  // Project tile covers — wait for render.js to populate
  waitFor('#op-projects .op-proj', tiles => {
    tiles.forEach(tile => {
      const slug = tile.id.replace('work-', '');
      const media = tile.querySelector('.op-proj-media');
      if (media) addBgReplace(media, fn => {
        media.style.backgroundImage = `url(assets/photos/${fn})`;
        const proj = projects.find(p => p.slug === slug);
        if (proj && proj.media[0]) {
          snapshot();
          if (proj.media[0].type === 'video') proj.media[0].poster = fn;
          else proj.media[0].src = fn;
          markDirty();
        }
      });

      // "Edit project" button on each tile
      const editBtn = document.createElement('button');
      editBtn.className = 'op-proj-edit-btn';
      editBtn.textContent = 'Edit project →';
      editBtn.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        location.href = `project.html?p=${slug}`;
      };
      tile.style.position = 'relative';
      tile.appendChild(editBtn);
    });
  });
}

// ── Project page editing ──────────────────────────────────────────────────────
function setupProjectEditing() {
  waitFor('[data-op-field]', () => attachProjectEditing());
}

function attachProjectEditing() {
  const slug = new URLSearchParams(location.search).get('p') || projects[0]?.slug;
  const proj = projects.find(p => p.slug === slug);
  if (!proj) return;

  // Text fields — map data-op-field to proj property
  document.querySelectorAll('[data-op-field]').forEach(el => {
    const field = el.dataset.opField;
    makeProjectEditable(el, proj, field);
  });

  // Media items
  document.querySelectorAll('[data-op-media-idx]').forEach(el => {
    const idx = parseInt(el.dataset.opMediaIdx);
    const item = proj.media[idx];
    if (!item) return;

    if (item.type === 'image') {
      // Images are <img> tags inside .op-img-cell wrappers
      const img = el.tagName === 'IMG' ? el : el.querySelector('img');
      if (img) {
        el.classList.add('op-img-cell');
        const btn = makeReplaceImgBtn(async () => {
          const fn = await pickAndUpload('image/*');
          if (!fn) return;
          snapshot();
          item.src = fn;
          img.src = 'assets/photos/' + fn;
          markDirty();
        });
        el.appendChild(btn);
        const rm = makeRemoveBtn(() => removeMedia(proj, idx));
        el.appendChild(rm);
      }
    } else {
      // Video block
      const bg = el.querySelector('.op-d-video-media');
      if (bg) addBgReplace(bg, fn => {
        snapshot();
        item.poster = fn;
        bg.style.backgroundImage = `url(assets/photos/${fn})`;
        markDirty();
      });
      addVideoUrlBtn(el, item);
      const rm = makeRemoveBtn(() => removeMedia(proj, idx));
      el.appendChild(rm);
    }
  });

  // Add media buttons at end of gallery
  const gallery = document.querySelector('.op-d-gallery');
  if (gallery) {
    const row = document.createElement('div');
    row.className = 'op-media-add-row';
    const addPhoto = document.createElement('button');
    addPhoto.className = 'op-edit-btn';
    addPhoto.textContent = '+ Add photo';
    addPhoto.onclick = async () => {
      const fn = await pickAndUpload('image/*');
      if (!fn) return;
      snapshot();
      proj.media.push({ type: 'image', src: fn });
      markDirty();
      reRenderProject(proj);
    };
    const addVideo = document.createElement('button');
    addVideo.className = 'op-edit-btn';
    addVideo.textContent = '+ Add video';
    addVideo.onclick = async () => {
      const fn = await pickAndUpload('image/*');
      if (!fn) return;
      const url = prompt('Video URL (Vimeo, YouTube, mp4 — leave blank to add later):') || '';
      snapshot();
      proj.media.push({ type: 'video', poster: fn, url: url.trim() });
      markDirty();
      reRenderProject(proj);
    };
    row.appendChild(addPhoto);
    row.appendChild(addVideo);
    gallery.appendChild(row);
  }
}

function removeMedia(proj, idx) {
  snapshot();
  proj.media.splice(idx, 1);
  markDirty();
  reRenderProject(proj);
}

function reRenderProject(proj) {
  // Use in-memory projects for next render
  window.__opProjectsOverride = projects;
  const root = document.getElementById('op-detail-root');
  if (root) root.innerHTML = '';
  if (typeof opRenderDetail === 'function') opRenderDetail();
  setTimeout(() => { if (editMode) attachProjectEditing(); }, 80);
}

// ── Editable text helpers ─────────────────────────────────────────────────────
function makeIndexEditable(el, selector) {
  if (!el) return;
  el.contentEditable = 'true';
  el._opFocus = () => snapshot();
  el._opInput = () => {
    setIndexHtmlEdit(selector, el.innerHTML);
    markDirty();
  };
  el.addEventListener('focus', el._opFocus);
  el.addEventListener('input', el._opInput);
}

function makeProjectEditable(el, proj, field) {
  if (!el) return;
  el.contentEditable = 'true';
  el._opFocus = () => snapshot();
  el._opInput = () => {
    proj[field] = el.innerText.trim();
    markDirty();
  };
  el.addEventListener('focus', el._opFocus);
  el.addEventListener('input', el._opInput);
}

// ── Index.html edit tracking ──────────────────────────────────────────────────
function setIndexHtmlEdit(selector, html) {
  const existing = indexEdits.find(u => u.selector === selector);
  if (existing) existing.html = html;
  else indexEdits.push({ selector, html });
}

function setIndexAttrEdit(selector, attrName, attrValue) {
  const existing = indexEdits.find(u => u.selector === selector && u.attr);
  if (existing) existing.attr = { name: attrName, value: attrValue };
  else indexEdits.push({ selector, attr: { name: attrName, value: attrValue } });
}

// ── Image/bg replace helpers ──────────────────────────────────────────────────
function addBgReplace(el, onDone) {
  const btn = document.createElement('button');
  btn.className = 'op-img-replace';
  btn.textContent = 'Replace photo';
  btn.addEventListener('click', async e => {
    e.preventDefault(); e.stopPropagation();
    const fn = await pickAndUpload('image/*');
    if (fn) onDone(fn);
  });
  el.style.position = 'relative';
  el.appendChild(btn);
}

function makeReplaceImgBtn(onClick) {
  const btn = document.createElement('button');
  btn.className = 'op-img-replace-img';
  btn.textContent = 'Replace';
  btn.addEventListener('click', async e => { e.preventDefault(); e.stopPropagation(); await onClick(); });
  return btn;
}

function makeRemoveBtn(onClick) {
  const btn = document.createElement('button');
  btn.className = 'op-media-remove';
  btn.textContent = '✕';
  btn.title = 'Remove';
  btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); onClick(); });
  return btn;
}

function addVideoUrlBtn(el, item) {
  const btn = document.createElement('button');
  btn.className = 'op-img-replace op-video-url-btn';
  btn.textContent = item.url ? 'Edit video URL' : '+ Add video URL';
  btn.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    const url = prompt('Video URL (Vimeo, YouTube, mp4 — leave blank to remove):', item.url || '');
    if (url === null) return;
    snapshot();
    item.url = url.trim();
    btn.textContent = item.url ? 'Edit video URL' : '+ Add video URL';
    markDirty();
  });
  el.appendChild(btn);
}

async function pickAndUpload(accept) {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept || 'image/*';
    input.onchange = async () => {
      if (!input.files[0]) return resolve(null);
      const form = new FormData();
      form.append('file', input.files[0]);
      showToast('Uploading…');
      const r = await fetch('/api/upload', { method: 'POST', body: form });
      const d = await r.json();
      resolve(d.filename || null);
    };
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

// ── Undo ──────────────────────────────────────────────────────────────────────
function snapshot() {
  history.push({
    projects: JSON.parse(JSON.stringify(projects)),
    indexEdits: JSON.parse(JSON.stringify(indexEdits))
  });
  if (history.length > 40) history.shift();
  updateUndoBtn();
}

function undo() {
  if (!history.length) return;
  const prev = history.pop();
  projects = prev.projects;
  indexEdits = prev.indexEdits;
  updateUndoBtn();
  // Re-render to reflect undone state
  if (PAGE === 'project') {
    const slug = new URLSearchParams(location.search).get('p') || projects[0]?.slug;
    const proj = projects.find(p => p.slug === slug);
    if (proj) reRenderProject(proj);
  } else {
    // Reload page (home has mostly static edits)
    location.reload();
  }
}

function updateUndoBtn() {
  undoBtn.disabled = history.length === 0;
}

// ── Save ──────────────────────────────────────────────────────────────────────
async function save() {
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';
  try {
    // Save projects.json
    const r1 = await fetch('/api/save-projects', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projects)
    });
    if (!r1.ok) throw new Error((await r1.json()).error);

    // Save index.html edits (if any)
    if (indexEdits.length) {
      const r2 = await fetch('/api/save-html', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: 'index.html', updates: indexEdits })
      });
      if (!r2.ok) throw new Error((await r2.json()).error);
    }

    dirty = false;
    showToast('Saved!');
  } catch (e) {
    alert('Save failed:\n\n' + e.message);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save';
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function markDirty() {
  dirty = true;
}

function waitFor(selector, callback) {
  const els = document.querySelectorAll(selector);
  if (els.length) { callback(Array.from(els)); return; }
  const observer = new MutationObserver(() => {
    const found = document.querySelectorAll(selector);
    if (found.length) { observer.disconnect(); callback(Array.from(found)); }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('op-toast-show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('op-toast-show'), 2200);
}

// Warn on navigate with unsaved changes
window.addEventListener('beforeunload', e => {
  if (dirty) { e.preventDefault(); e.returnValue = ''; }
});

})();
