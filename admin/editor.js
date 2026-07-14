(function () {
'use strict';

// ── State ─────────────────────────────────────────────────────────────────────
const PAGE = document.getElementById('op-projects') ? 'home' : 'project';
let editMode = false, dirty = false;
let projects = [];
let indexEdits = [];  // [{selector, html?, attr?}] for index.html
let history = [];
let staticEditingAttached = false;

// ── Toolbar ───────────────────────────────────────────────────────────────────
const bar = document.createElement('div');
bar.id = 'op-edit-bar';
bar.innerHTML = `
  <span class="op-edit-label">OCEANE EDITOR</span>
  <div class="op-edit-sep"></div>
  <button class="op-edit-btn op-edit-toggle" id="op-toggle">Edit</button>
  <button class="op-edit-btn op-edit-btn-green" id="op-new-project">+ New Project</button>
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

const $  = id => document.getElementById(id);
const toggleBtn   = $('op-toggle');
const newProjBtn  = $('op-new-project');
const undoBtn     = $('op-undo');
const saveBtn     = $('op-save');
const pushBtn     = $('op-push');
const resetBtn    = $('op-reset');
const snapsBtn    = $('op-snaps-btn');
const snapsPanel  = $('op-snaps-panel');

// ── Push modal ────────────────────────────────────────────────────────────────
const pushModal = createModal(`
  <p class="op-modal-title">Push to GitHub</p>
  <p class="op-modal-sub">A snapshot is saved locally before every push so you can roll back.</p>
  <div class="op-modal-row">
    <label class="op-modal-label">Commit message</label>
    <input class="op-modal-input" id="op-commit-msg" value="Update site content">
  </div>
  <div class="op-modal-btns">
    <button class="op-edit-btn" id="op-push-cancel">Cancel</button>
    <button class="op-edit-btn op-edit-btn-blue" id="op-push-confirm">Push</button>
  </div>
`);

// ── New project modal ─────────────────────────────────────────────────────────
const newProjModal = createModal(`
  <p class="op-modal-title">New Project</p>
  <p class="op-modal-sub">You can add photos and video after creating the project.</p>
  <div class="op-modal-row"><label class="op-modal-label">Title</label><input class="op-modal-input" id="np-title" placeholder="Northwind"></div>
  <div class="op-modal-row"><label class="op-modal-label">Client</label><input class="op-modal-input" id="np-client" placeholder="Northwind Outfitters"></div>
  <div class="op-modal-row"><label class="op-modal-label">Kind</label><input class="op-modal-input" id="np-kind" placeholder="Brand film"></div>
  <div class="op-modal-row"><label class="op-modal-label">Services</label><input class="op-modal-input" id="np-services" placeholder="Commercial, 4K"></div>
  <div class="op-modal-row"><label class="op-modal-label">Year</label><input class="op-modal-input" id="np-year" placeholder="${new Date().getFullYear()}"></div>
  <div class="op-modal-row"><label class="op-modal-label">Description</label><textarea class="op-modal-textarea" id="np-desc" placeholder="A short paragraph about this project…"></textarea></div>
  <div class="op-modal-btns">
    <button class="op-edit-btn" id="np-cancel">Cancel</button>
    <button class="op-edit-btn op-edit-btn-green" id="np-create">Create Project</button>
  </div>
`);

function createModal(html) {
  const el = document.createElement('div');
  el.className = 'op-modal';
  el.hidden = true;
  el.innerHTML = `<div class="op-modal-box">${html}</div>`;
  document.body.appendChild(el);
  return el;
}

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

// Push modal
pushBtn.addEventListener('click', () => { pushModal.hidden = false; $('op-commit-msg').select(); });
$('op-push-cancel').addEventListener('click', () => { pushModal.hidden = true; });
$('op-push-confirm').addEventListener('click', doPush);

// New project modal
newProjBtn.addEventListener('click', () => { newProjModal.hidden = false; $('np-title').focus(); });
$('np-cancel').addEventListener('click', () => { newProjModal.hidden = true; });
$('np-create').addEventListener('click', createProject);

// Reset
resetBtn.addEventListener('click', async () => {
  const hard = confirm(
    'Hard reset: revert ALL files to last git commit (can\'t be undone).\n\n' +
    'Click OK for hard reset, or Cancel to just reload the page and discard in-editor changes.'
  );
  if (hard) {
    const r = await fetch('/api/git-reset', { method: 'POST' });
    const d = await r.json();
    if (!r.ok) { alert('Reset failed:\n\n' + d.error); return; }
  }
  dirty = false;
  location.reload();
});

// Snapshots
snapsBtn.addEventListener('click', async e => {
  e.stopPropagation();
  snapsPanel.hidden = !snapsPanel.hidden;
  if (!snapsPanel.hidden) loadSnapsPanel();
});
document.addEventListener('click', e => {
  if (!snapsPanel.contains(e.target) && e.target !== snapsBtn) snapsPanel.hidden = true;
});

// Close modals on backdrop click
[pushModal, newProjModal].forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.hidden = true; });
});

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); }
  if (e.key === 'Escape') { pushModal.hidden = true; newProjModal.hidden = true; snapsPanel.hidden = true; }
});

window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

// ── Edit mode ─────────────────────────────────────────────────────────────────
function enterEditMode() {
  editMode = true;
  toggleBtn.textContent = 'Viewing';
  toggleBtn.classList.add('op-edit-toggle-active');
  document.body.classList.add('op-edit-mode');
  if (PAGE === 'home') {
    if (!staticEditingAttached) { setupHomeStaticEditing(); staticEditingAttached = true; }
    setupHomeTileEditing();
  } else {
    setupProjectEditing();
  }
}

function exitEditMode() {
  editMode = false;
  toggleBtn.textContent = 'Edit';
  toggleBtn.classList.remove('op-edit-toggle-active');
  document.body.classList.remove('op-edit-mode');
  document.querySelectorAll('[contenteditable]').forEach(el => {
    el.removeAttribute('contenteditable');
    if (el._opFocus) el.removeEventListener('focus', el._opFocus);
    if (el._opInput) el.removeEventListener('input', el._opInput);
  });
  document.querySelectorAll(
    '.op-img-replace, .op-media-remove, .op-media-add-row, .op-tile-controls, .op-video-url-btn'
  ).forEach(el => el.remove());
}

// ── Homepage: static text (hero, footer) ─────────────────────────────────────
function setupHomeStaticEditing() {
  makeIndexEditable(document.querySelector('.op-hero h1'), '.op-hero h1');
  makeIndexEditable(document.querySelector('.op-hero-sub'), '.op-hero-sub');
  makeIndexEditable(document.querySelector('.op-footer h2'), '.op-footer h2');
  makeIndexEditable(document.querySelector('.op-footer-note'), '.op-footer-note');

  // Hero background — append button to .op-hero-media (position:absolute, fills top half)
  const heroMedia = document.querySelector('.op-hero-media');
  const heroBg    = document.querySelector('.op-hero-media-img');
  if (heroMedia && heroBg) {
    addReplaceBtn(heroMedia, async () => {
      const fn = await pickAndUpload('image/*');
      if (!fn) return;
      snapshot();
      heroBg.style.backgroundImage = `url(assets/photos/${fn})`;
      setIndexAttr('.op-hero-media-img', 'style', `background-image:url(assets/photos/${fn})`);
      markDirty();
    });
  }
}

// ── Homepage: project tiles ───────────────────────────────────────────────────
function setupHomeTileEditing() {
  waitFor('#op-projects .op-proj', tiles => {
    tiles.forEach(tile => {
      const slug  = tile.id.replace('work-', '');
      const media = tile.querySelector('.op-proj-media');

      // Replace cover photo — append button to tile itself (position:relative)
      if (media) {
        addReplaceBtn(tile, async () => {
          const fn = await pickAndUpload('image/*');
          if (!fn) return;
          snapshot();
          media.style.backgroundImage = `url(assets/photos/${fn})`;
          const proj = projects.find(p => p.slug === slug);
          if (proj && proj.media[0]) {
            if (proj.media[0].type === 'video') proj.media[0].poster = fn;
            else proj.media[0].src = fn;
          }
          markDirty();
        });
      }

      // Tile management controls (Edit, ↑, ↓, Delete)
      const idx = projects.findIndex(p => p.slug === slug);
      const controls = document.createElement('div');
      controls.className = 'op-tile-controls';
      controls.innerHTML = `
        <button class="op-tile-btn" data-action="edit">Edit →</button>
        <button class="op-tile-btn" data-action="up" title="Move up">↑</button>
        <button class="op-tile-btn" data-action="down" title="Move down">↓</button>
        <button class="op-tile-btn op-tile-btn-danger" data-action="delete">✕ Delete</button>
      `;
      controls.addEventListener('click', e => {
        const action = e.target.dataset.action;
        if (!action) return;
        e.preventDefault(); e.stopPropagation();
        if (action === 'edit')   { location.href = `project.html?p=${slug}`; }
        if (action === 'up')     { moveProject(slug, -1); }
        if (action === 'down')   { moveProject(slug, +1); }
        if (action === 'delete') { deleteProject(slug); }
      });
      tile.appendChild(controls);
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

  // Text fields
  document.querySelectorAll('[data-op-field]').forEach(el => {
    makeProjectEditable(el, proj, el.dataset.opField);
  });

  // Media items — append replace buttons to the correct positioned container
  document.querySelectorAll('[data-op-media-idx]').forEach(el => {
    const idx  = parseInt(el.dataset.opMediaIdx);
    const item = proj.media[idx];
    if (!item) return;

    if (item.type === 'image') {
      // el is .op-img-cell (position:relative via editor.css)
      el.classList.add('op-img-cell');
      const img = el.querySelector('img');
      addReplaceBtn(el, async () => {
        const fn = await pickAndUpload('image/*');
        if (!fn) return;
        snapshot();
        item.src = fn;
        if (img) img.src = 'assets/photos/' + fn;
        markDirty();
      });
      const rm = makeRemoveBtn(() => removeMedia(proj, idx));
      el.appendChild(rm);
    } else {
      // el is .op-d-video (position:relative)
      const bg = el.querySelector('.op-d-video-media');
      addReplaceBtn(el, async () => {
        const fn = await pickAndUpload('image/*');
        if (!fn) return;
        snapshot();
        item.poster = fn;
        if (bg) bg.style.backgroundImage = `url(assets/photos/${fn})`;
        markDirty();
      });
      addVideoUrlBtn(el, item);
      const rm = makeRemoveBtn(() => removeMedia(proj, idx));
      el.appendChild(rm);
    }
  });

  // Add media buttons
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
      snapshot();
      proj.media.push({ type: 'video', poster: fn, url: '' });
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
  window.__opProjectsOverride = projects;
  const root = document.getElementById('op-detail-root');
  if (root) root.innerHTML = '';
  if (typeof opRenderDetail === 'function') opRenderDetail();
  setTimeout(() => { if (editMode) attachProjectEditing(); }, 80);
}

function reRenderHome() {
  window.__opProjectsOverride = projects;
  const root = document.getElementById('op-projects');
  if (root) root.innerHTML = '';
  if (typeof opRenderHome === 'function') opRenderHome();
  setTimeout(() => { if (editMode) setupHomeTileEditing(); }, 80);
}

// ── Project management ────────────────────────────────────────────────────────
function createProject() {
  const title    = $('np-title').value.trim();
  const client   = $('np-client').value.trim();
  const kind     = $('np-kind').value.trim();
  const services = $('np-services').value.trim();
  const year     = $('np-year').value.trim() || String(new Date().getFullYear());
  const desc     = $('np-desc').value.trim();

  if (!title) { $('np-title').focus(); return; }

  const nums = projects.map(p => parseInt(p.slug.replace(/\D/g, ''))).filter(n => !isNaN(n));
  const maxNum = nums.length ? Math.max(...nums) : 0;
  const slug = 'p' + (maxNum + 1);

  snapshot();
  projects.push({ slug, n: '', title, client, kind, services, year, description: desc, media: [] });
  renumberProjects();
  markDirty();
  newProjModal.hidden = true;

  // Clear form
  ['np-title','np-client','np-kind','np-services','np-year','np-desc'].forEach(id => { $(id).value = ''; });

  reRenderHome();
  showToast(`"${title}" created — click Edit → to add photos`);
}

function deleteProject(slug) {
  const proj = projects.find(p => p.slug === slug);
  if (!proj) return;
  if (!confirm(`Delete "${proj.title}"? This cannot be undone here — but you can restore a snapshot if needed.`)) return;
  snapshot();
  projects = projects.filter(p => p.slug !== slug);
  renumberProjects();
  markDirty();
  reRenderHome();
}

function moveProject(slug, dir) {
  const idx = projects.findIndex(p => p.slug === slug);
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= projects.length) return;
  snapshot();
  const [proj] = projects.splice(idx, 1);
  projects.splice(newIdx, 0, proj);
  renumberProjects();
  markDirty();
  reRenderHome();
}

function renumberProjects() {
  projects.forEach((p, i) => { p.n = String(i + 1).padStart(2, '0'); });
}

// ── Editable text ─────────────────────────────────────────────────────────────
function makeIndexEditable(el, selector) {
  if (!el) return;
  el.contentEditable = 'true';
  el._opFocus = () => snapshot();
  el._opInput = () => { setIndexHtml(selector, el.innerHTML); markDirty(); };
  el.addEventListener('focus', el._opFocus);
  el.addEventListener('input', el._opInput);
}

function makeProjectEditable(el, proj, field) {
  if (!el) return;
  el.contentEditable = 'true';
  el._opFocus = () => snapshot();
  el._opInput = () => { proj[field] = el.innerText.trim(); markDirty(); };
  el.addEventListener('focus', el._opFocus);
  el.addEventListener('input', el._opInput);
}

// ── Index.html edit tracking ──────────────────────────────────────────────────
function setIndexHtml(selector, html) {
  const e = indexEdits.find(u => u.selector === selector && !u.attr);
  if (e) e.html = html; else indexEdits.push({ selector, html });
}
function setIndexAttr(selector, name, value) {
  const e = indexEdits.find(u => u.selector === selector && u.attr);
  if (e) e.attr = { name, value }; else indexEdits.push({ selector, attr: { name, value } });
}

// ── Replace button helpers ────────────────────────────────────────────────────
/*
  IMPORTANT: addReplaceBtn appends to `container` which is already a positioned
  element (position: relative or absolute). We NEVER set position on the container
  here — that would break elements relying on position:absolute.
*/
function addReplaceBtn(container, onClick) {
  const btn = document.createElement('button');
  btn.className = 'op-img-replace';
  btn.textContent = 'Replace photo';
  btn.addEventListener('click', async e => { e.preventDefault(); e.stopPropagation(); await onClick(); });
  container.appendChild(btn);
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
  btn.textContent = item.url ? 'Edit video URL' : '+ Video URL';
  btn.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    const url = prompt('Video URL (Vimeo, YouTube, mp4):', item.url || '');
    if (url === null) return;
    snapshot();
    item.url = url.trim();
    btn.textContent = item.url ? 'Edit video URL' : '+ Video URL';
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
  projects  = prev.projects;
  indexEdits = prev.indexEdits;
  updateUndoBtn();
  if (PAGE === 'project') {
    const slug = new URLSearchParams(location.search).get('p') || projects[0]?.slug;
    const proj = projects.find(p => p.slug === slug);
    if (proj) reRenderProject(proj);
  } else {
    reRenderHome();
  }
}

function updateUndoBtn() { undoBtn.disabled = history.length === 0; }

// ── Save ──────────────────────────────────────────────────────────────────────
async function save() {
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';
  try {
    const r1 = await fetch('/api/save-projects', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projects)
    });
    if (!r1.ok) throw new Error((await r1.json()).error);

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

// ── Push ──────────────────────────────────────────────────────────────────────
async function doPush() {
  const msg = $('op-commit-msg').value.trim() || 'Update site content';
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
    showToast(d.noop ? 'Nothing new to push.' : 'Pushed to GitHub!');
  } catch (e) {
    alert('Push failed:\n\n' + e.message);
  } finally {
    pushBtn.disabled = false;
    pushBtn.textContent = 'Push to Git';
  }
}

// ── Snapshots ─────────────────────────────────────────────────────────────────
async function loadSnapsPanel() {
  snapsPanel.innerHTML = '<div class="op-snaps-empty">Loading…</div>';
  const r = await fetch('/api/snapshots');
  const snaps = await r.json();
  if (!snaps.length) {
    snapsPanel.innerHTML = '<div class="op-snaps-empty">No snapshots yet.<br>One is saved before each push.</div>';
    return;
  }
  snapsPanel.innerHTML = snaps.map(s => {
    const label = s.replace('T', ' ').replace(/-(\d\d)-(\d\d)-(\d\d)$/, ':$1:$2');
    return `<div class="op-snap-item"><span class="op-snap-label">${label}</span><button class="op-snap-restore" data-snap="${s}">Restore</button></div>`;
  }).join('');
  snapsPanel.querySelectorAll('.op-snap-restore').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(`Restore snapshot from ${btn.dataset.snap}?\n\nThis will overwrite your current files.`)) return;
      snapsPanel.hidden = true;
      const r = await fetch(`/api/restore/${btn.dataset.snap}`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) { alert('Restore failed:\n\n' + d.error); return; }
      showToast('Restored! Reloading…');
      setTimeout(() => location.reload(), 800);
    });
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function markDirty() { dirty = true; }

function waitFor(selector, callback) {
  const found = document.querySelectorAll(selector);
  if (found.length) { callback(Array.from(found)); return; }
  const obs = new MutationObserver(() => {
    const f = document.querySelectorAll(selector);
    if (f.length) { obs.disconnect(); callback(Array.from(f)); }
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('op-toast-show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('op-toast-show'), 2400);
}

})();
