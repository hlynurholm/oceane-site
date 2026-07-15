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

// ── Focal point picker modal ──────────────────────────────────────────────────
const focalModal = createModal(`
  <p class="op-modal-title">Set focal point</p>
  <p class="op-modal-sub">Click the most important part — it stays visible when the photo is cropped to fit.</p>
  <div class="op-focal-wrap" id="fp-wrap">
    <img id="fp-img" src="" alt="" draggable="false">
    <div class="op-focal-dot" id="fp-dot" style="display:none"></div>
    <div class="op-focal-crosshair-h" id="fp-ch" style="display:none"></div>
    <div class="op-focal-crosshair-v" id="fp-cv" style="display:none"></div>
  </div>
  <div class="op-modal-btns" style="margin-top:16px">
    <button class="op-edit-btn" id="fp-skip">Use center</button>
    <button class="op-edit-btn op-edit-btn-primary" id="fp-confirm">Confirm focal point</button>
  </div>
`);
focalModal.id = 'op-focal-modal';

let _focalResolve = null;
let _focalPoint = null;

function pickFocalPoint(filename) {
  return new Promise(resolve => {
    _focalResolve = resolve;
    _focalPoint = null;
    const img  = $('fp-img');
    const dot  = $('fp-dot');
    const ch   = $('fp-ch');
    const cv   = $('fp-cv');
    img.src = 'assets/photos/' + filename;
    dot.style.display = 'none';
    ch.style.display  = 'none';
    cv.style.display  = 'none';
    focalModal.hidden = false;
  });
}

$('fp-wrap').addEventListener('click', e => {
  const wrap = $('fp-wrap');
  const rect = wrap.getBoundingClientRect();
  // Use the image's rendered bounds (may not fill wrap if object-fit:contain letterboxes)
  const img   = $('fp-img');
  const iRect = img.getBoundingClientRect();
  if (e.clientX < iRect.left || e.clientX > iRect.right ||
      e.clientY < iRect.top  || e.clientY > iRect.bottom) return;
  const x = ((e.clientX - iRect.left) / iRect.width  * 100).toFixed(1);
  const y = ((e.clientY - iRect.top)  / iRect.height * 100).toFixed(1);
  _focalPoint = x + '% ' + y + '%';
  // Position dot and crosshairs relative to wrap
  const dot = $('fp-dot');
  const ch  = $('fp-ch');
  const cv  = $('fp-cv');
  const rx = ((e.clientX - rect.left) / rect.width  * 100).toFixed(2);
  const ry = ((e.clientY - rect.top)  / rect.height * 100).toFixed(2);
  dot.style.left = rx + '%'; dot.style.top = ry + '%'; dot.style.display = 'block';
  ch.style.top   = ry + '%';  ch.style.display  = 'block';
  cv.style.left  = rx + '%';  cv.style.display  = 'block';
});

$('fp-skip').addEventListener('click', () => {
  focalModal.hidden = true;
  if (_focalResolve) { _focalResolve(null); _focalResolve = null; }
});
$('fp-confirm').addEventListener('click', () => {
  focalModal.hidden = true;
  if (_focalResolve) { _focalResolve(_focalPoint); _focalResolve = null; }
});
focalModal.addEventListener('click', e => {
  if (e.target === focalModal) {
    focalModal.hidden = true;
    if (_focalResolve) { _focalResolve(null); _focalResolve = null; }
  }
});

// ── Stream picker modal ───────────────────────────────────────────────────────
const streamModal = createModal(`
  <p class="op-modal-title">Add video</p>
  <div class="op-stream-upload-row">
    <button class="op-edit-btn op-edit-btn-primary" id="stream-upload-btn">↑ Upload new video</button>
    <div class="op-stream-progress" id="stream-progress" hidden>
      <div class="op-stream-progress-bar" id="stream-progress-bar"></div>
    </div>
    <span class="op-stream-upload-status" id="stream-upload-status"></span>
  </div>
  <p class="op-modal-sub" id="stream-sub" style="margin-top:16px">Or choose from your library:</p>
  <div id="stream-grid" class="op-stream-grid"></div>
  <div class="op-modal-btns" style="margin-top:16px">
    <button class="op-edit-btn" id="stream-cancel">Cancel</button>
  </div>
`);
streamModal.id = 'op-stream-modal';

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
streamModal.addEventListener('click', e => {
  if (e.target === streamModal) {
    streamModal.hidden = true;
    if (_streamResolve) { _streamResolve(null); _streamResolve = null; }
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); }
  if (e.key === 'Escape') {
    pushModal.hidden = true; newProjModal.hidden = true; snapsPanel.hidden = true;
    if (!streamModal.hidden) { streamModal.hidden = true; if (_streamResolve) { _streamResolve(null); _streamResolve = null; } }
    if (!focalModal.hidden)  { focalModal.hidden = true;  if (_focalResolve)  { _focalResolve(null);  _focalResolve  = null; } }
  }
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
    '.op-img-replace, .op-media-remove, .op-media-add-row, .op-tile-controls, .op-hero-controls,' +
    '.op-video-url-btn, .op-drag-ring, .op-resize-handle, .op-drag-tooltip, .op-text-resize-badge, .op-text-width-handle'
  ).forEach(el => el.remove());
  document.querySelectorAll('[data-op-field]').forEach(el => { el.style.position = ''; });
  document.querySelectorAll('.op-draggable').forEach(el => {
    el.classList.remove('op-draggable', 'op-active', 'op-dragging');
  });
  document.querySelectorAll('.op-media-draggable').forEach(el => {
    el.draggable = false;
    el.classList.remove('op-media-draggable', 'op-media-dragging', 'op-media-drag-over');
  });
}

// ── Homepage: static text (hero, footer) ─────────────────────────────────────
function setupHomeStaticEditing() {
  makeIndexEditable(document.querySelector('.op-hero h1'), '.op-hero h1');
  makeIndexEditable(document.querySelector('.op-hero-sub'), '.op-hero-sub');
  makeIndexEditable(document.querySelector('.op-footer h2'), '.op-footer h2');
  makeIndexEditable(document.querySelector('.op-footer-note'), '.op-footer-note');

  // Hero background controls — tile-style, bottom of media area (avoids the header)
  const heroMedia = document.querySelector('.op-hero-media');
  const heroBg    = document.querySelector('.op-hero-media-img');
  if (heroMedia && heroBg) {
    const heroCtrl = document.createElement('div');
    heroCtrl.className = 'op-hero-controls';
    heroCtrl.innerHTML = `
      <button class="op-tile-btn" data-action="photo">Photo bg</button>
      <button class="op-tile-btn" data-action="video">Video bg</button>
    `;

    heroCtrl.addEventListener('click', async e => {
      const action = e.target.dataset.action;
      if (!action) return;
      e.preventDefault(); e.stopPropagation();

      if (action === 'photo') {
        const fn = await pickAndUpload('image/*');
        if (!fn) return;
        const pos = await pickFocalPoint(fn);
        const bgPos = pos || 'center';
        snapshot();
        heroBg.style.backgroundImage = `url(assets/photos/${fn})`;
        heroBg.style.backgroundPosition = bgPos;
        heroMedia.querySelector('.op-hero-video')?.remove();
        setIndexHtml('.op-hero-media',
          `<div class="op-hero-media-img" style="background-image:url(assets/photos/${fn});background-position:${bgPos}"></div>`);
        markDirty();
      }

      if (action === 'video') {
        const v = await pickFromStream();
        if (!v) return;
        snapshot();
        const src = `https://iframe.videodelivery.net/${v.uid}?autoplay=true&muted=true&loop=true&controls=false&preload=auto`;
        let iframe = heroMedia.querySelector('.op-hero-video');
        if (!iframe) {
          iframe = document.createElement('iframe');
          iframe.className = 'op-hero-video';
          iframe.setAttribute('allow', 'autoplay');
          iframe.setAttribute('tabindex', '-1');
          heroMedia.appendChild(iframe);
        }
        iframe.src = src;
        const bgStyle = heroBg.getAttribute('style') || '';
        setIndexHtml('.op-hero-media',
          `<div class="op-hero-media-img" style="${bgStyle}"></div>` +
          `<iframe class="op-hero-video" src="${src}" allow="autoplay" tabindex="-1"></iframe>`);
        markDirty();
      }
    });

    heroMedia.appendChild(heroCtrl);
  }

  // Draggable + resizable overlay elements
  const logo = document.querySelector('.op-hero-logo');
  if (logo) makeDraggableResizable(logo, '.op-hero-logo', 'index.html');

  // Buttons — resize only (drag would break the flex layout)
  document.querySelectorAll('.op-header .op-btn, .op-footer-cta .op-btn').forEach((btn, i) => {
    const sel = btn.closest('.op-header') ? '.op-header .op-btn' : '.op-footer-cta .op-btn';
    makeResizable(btn, sel, 'index.html');
  });
}

// ── Homepage: project tiles ───────────────────────────────────────────────────
function setupHomeTileEditing() {
  waitFor('#op-projects .op-proj', tiles => {
    tiles.forEach(tile => {
      const slug = tile.id.replace('work-', '');
      const proj = projects.find(p => p.slug === slug);

      const controls = document.createElement('div');
      controls.className = 'op-tile-controls';
      controls.innerHTML = `
        <button class="op-tile-btn" data-action="cover-photo">Photo bg</button>
        <button class="op-tile-btn" data-action="cover-video">Video bg</button>
        <button class="op-tile-btn" data-action="edit">Edit →</button>
        <button class="op-tile-btn" data-action="up" title="Move up">↑</button>
        <button class="op-tile-btn" data-action="down" title="Move down">↓</button>
        <button class="op-tile-btn op-tile-btn-danger" data-action="delete">✕</button>
      `;
      controls.addEventListener('click', async e => {
        const action = e.target.dataset.action;
        if (!action) return;
        e.preventDefault(); e.stopPropagation();

        if (action === 'cover-photo') {
          const fn = await pickAndUpload('image/*');
          if (!fn) return;
          const pos = await pickFocalPoint(fn);
          snapshot();
          delete proj.coverStreamUid;
          proj.bgPosition = pos || 'center';
          if (proj.media[0]) {
            if (proj.media[0].type === 'video') proj.media[0].poster = fn;
            else proj.media[0].src = fn;
          }
          markDirty();
          reRenderHome();
        }
        if (action === 'cover-video') {
          const v = await pickFromStream();
          if (!v) return;
          snapshot();
          proj.coverStreamUid = v.uid;
          markDirty();
          reRenderHome();
        }
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
    const field = el.dataset.opField;
    makeProjectEditable(el, proj, field);
    // Resize control only on block-level fields (not inline spans like client/services/year)
    if (el.tagName !== 'SPAN') addTextResizeHandle(el, proj, field);
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
    } else if (item.streamUid) {
      // Stream video — el is .op-d-stream; just allow removal
      const rm = makeRemoveBtn(() => removeMedia(proj, idx));
      el.appendChild(rm);
    } else {
      // el is .op-d-video (position:relative) — poster + URL video
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

  // Add media buttons — always shown in edit mode, even when project has no media yet
  let gallery = document.querySelector('.op-d-gallery');
  if (!gallery) {
    // Project has no media yet — create the gallery container and insert it
    gallery = document.createElement('div');
    gallery.className = 'op-d-gallery';
    const nav = document.querySelector('.op-d-nav');
    const root = document.getElementById('op-detail-root');
    if (nav) root.insertBefore(gallery, nav);
    else root.appendChild(gallery);

    // Empty state hint
    const empty = document.createElement('div');
    empty.className = 'op-media-empty';
    empty.textContent = 'No photos or video yet — add some below.';
    gallery.appendChild(empty);
  }

  // Add row sits just before op-d-nav so it's always visible regardless of gallery length
  const row = document.createElement('div');
  row.className = 'op-media-add-row';

  const addPhoto = document.createElement('button');
  addPhoto.className = 'op-edit-btn op-edit-btn-primary';
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
  addVideo.className = 'op-edit-btn op-edit-btn-blue';
  addVideo.textContent = '+ Add video';
  addVideo.onclick = async () => {
    const v = await pickFromStream();
    if (!v) return;
    snapshot();
    proj.media.push({ type: 'video', streamUid: v.uid, poster: v.thumbnail || '', url: '' });
    markDirty();
    reRenderProject(proj);
  };

  row.appendChild(addPhoto);
  row.appendChild(addVideo);

  // Insert just before the prev/next nav, not inside gallery
  const nav = document.querySelector('.op-d-nav');
  const root = document.getElementById('op-detail-root');
  if (nav) root.insertBefore(row, nav);
  else root.appendChild(row);

  setupMediaDrag(proj);
}

function setupMediaDrag(proj) {
  let dragSrc = null;

  document.querySelectorAll('[data-op-media-idx]').forEach(el => {
    el.draggable = true;
    el.classList.add('op-media-draggable');

    el.addEventListener('dragstart', e => {
      dragSrc = parseInt(el.dataset.opMediaIdx);
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => el.classList.add('op-media-dragging'), 0);
    });

    el.addEventListener('dragend', () => {
      el.classList.remove('op-media-dragging');
      document.querySelectorAll('.op-media-drag-over').forEach(t => t.classList.remove('op-media-drag-over'));
    });

    el.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const targetIdx = parseInt(el.dataset.opMediaIdx);
      if (targetIdx === dragSrc) return;
      document.querySelectorAll('.op-media-drag-over').forEach(t => t.classList.remove('op-media-drag-over'));
      el.classList.add('op-media-drag-over');
    });

    el.addEventListener('dragleave', e => {
      if (!el.contains(e.relatedTarget)) el.classList.remove('op-media-drag-over');
    });

    el.addEventListener('drop', e => {
      e.preventDefault();
      const targetIdx = parseInt(el.dataset.opMediaIdx);
      el.classList.remove('op-media-drag-over');
      if (dragSrc === null || dragSrc === targetIdx) return;
      snapshot();
      const [item] = proj.media.splice(dragSrc, 1);
      proj.media.splice(targetIdx, 0, item);
      dragSrc = null;
      markDirty();
      reRenderProject(proj);
    });
  });
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

// ── Text style helpers ────────────────────────────────────────────────────────
function getFieldStyles(proj, field) {
  if (!proj.styles) proj.styles = {};
  const s = proj.styles[field];
  if (!s) return {};
  return typeof s === 'string' ? { fontSize: s } : Object.assign({}, s);
}
function setFieldStyles(proj, field, styles) {
  if (!proj.styles) proj.styles = {};
  const keys = Object.keys(styles).filter(k => styles[k]);
  if (!keys.length) { delete proj.styles[field]; return; }
  proj.styles[field] = keys.length === 1 && keys[0] === 'fontSize' ? styles.fontSize : styles;
}

// ── Text resize (font-size badge) ─────────────────────────────────────────────
function addTextResizeHandle(el, proj, field) {
  el.style.position = 'relative';

  const badge = document.createElement('div');
  badge.className = 'op-text-resize-badge';
  badge.innerHTML =
    '<button class="op-text-resize-btn" data-step="-2">−</button>' +
    '<span class="op-text-resize-val"></span>' +
    '<button class="op-text-resize-btn" data-step="2">+</button>' +
    '<button class="op-text-resize-btn op-text-resize-auto" data-auto="1">Auto</button>';

  function readPx() { return parseFloat(getComputedStyle(el).fontSize); }

  function refresh() {
    const isAuto = !el.style.fontSize;
    badge.querySelector('.op-text-resize-val').textContent =
      isAuto ? 'auto' : Math.round(parseFloat(el.style.fontSize)) + 'px';
    badge.querySelector('.op-text-resize-auto').classList.toggle('op-text-resize-auto-on', isAuto);
  }

  badge.addEventListener('mousedown', e => {
    const btn = e.target.closest('[data-step],[data-auto]');
    if (!btn) return;
    e.preventDefault(); e.stopPropagation();
    snapshot();
    const styles = getFieldStyles(proj, field);
    if (btn.dataset.auto) {
      el.style.fontSize = '';
      delete styles.fontSize;
    } else {
      const next = Math.max(8, Math.round(readPx() + parseInt(btn.dataset.step)));
      el.style.fontSize = next + 'px';
      styles.fontSize = next + 'px';
    }
    setFieldStyles(proj, field, styles);
    refresh();
    markDirty();
  });

  refresh();
  el.appendChild(badge);
  addTextWidthHandle(el, proj, field);
}

// ── Text width (right-edge drag handle) ───────────────────────────────────────
function addTextWidthHandle(el, proj, field) {
  const handle = document.createElement('div');
  handle.className = 'op-text-width-handle';
  const tip = document.createElement('span');
  tip.className = 'op-text-width-tip';
  handle.appendChild(tip);
  el.appendChild(handle);

  handle.addEventListener('mousedown', e => {
    e.preventDefault(); e.stopPropagation();
    const startX    = e.clientX;
    const startW    = el.getBoundingClientRect().width;
    const parentW   = el.parentElement.getBoundingClientRect().width;
    el.classList.add('op-text-resizing');

    function onMove(e) {
      const w   = Math.max(80, startW + (e.clientX - startX));
      const pct = Math.round(w / parentW * 100);
      el.style.maxWidth = pct + '%';
      tip.textContent   = pct + '%';
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      el.classList.remove('op-text-resizing');
      if (el.style.maxWidth) {
        snapshot();
        const styles = getFieldStyles(proj, field);
        styles.maxWidth = el.style.maxWidth;
        setFieldStyles(proj, field, styles);
        markDirty();
      }
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // Double-click to reset width to auto
  handle.addEventListener('dblclick', e => {
    e.stopPropagation();
    snapshot();
    el.style.maxWidth = '';
    const styles = getFieldStyles(proj, field);
    delete styles.maxWidth;
    setFieldStyles(proj, field, styles);
    tip.textContent = 'auto';
    markDirty();
  });
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

// ── Drag & resize ─────────────────────────────────────────────────────────────

/*
  makeDraggableResizable: for position:absolute elements (like .op-hero-logo).
  Drag updates top/left as % of the offsetParent. Resize handle (SE corner)
  updates width in px. Both save back to the HTML file as inline style.
*/
function makeDraggableResizable(el, cssSelector, file) {
  el.classList.add('op-draggable');
  el.style.position = el.style.position || 'absolute'; // keep existing if set

  const ring    = el.appendChild(Object.assign(document.createElement('div'), { className: 'op-drag-ring' }));
  const handle  = el.appendChild(Object.assign(document.createElement('div'), { className: 'op-resize-handle' }));
  const tooltip = el.appendChild(Object.assign(document.createElement('div'), { className: 'op-drag-tooltip' }));

  function saveStyle() {
    const s = el.style;
    // Build a clean style string with only the layout props we manage
    const parts = [];
    if (s.top)    parts.push(`top:${s.top}`);
    if (s.left)   parts.push(`left:${s.left}`);
    if (s.width)  parts.push(`width:${s.width}`);
    if (s.height) parts.push(`height:${s.height}`);
    // Preserve transform (centering) from original CSS
    parts.push('transform:translate(-50%,-50%)');
    setIndexAttr(cssSelector, 'style', parts.join(';'));
    markDirty();
  }

  // Drag to move
  el.addEventListener('mousedown', e => {
    if (!editMode || e.target === handle) return;
    e.preventDefault(); e.stopPropagation();

    const container = el.offsetParent;
    const cRect     = container.getBoundingClientRect();
    const elRect    = el.getBoundingClientRect();
    // Anchor to the center of the element (matching translate(-50%,-50%))
    const startTopPct  = ((elRect.top  + elRect.height / 2 - cRect.top)  / cRect.height) * 100;
    const startLeftPct = ((elRect.left + elRect.width  / 2 - cRect.left) / cRect.width)  * 100;
    const startMX = e.clientX, startMY = e.clientY;

    el.classList.add('op-active', 'op-dragging');
    document.body.classList.add('op-dragging');

    function onMove(e) {
      const top  = startTopPct  + (e.clientY - startMY) / cRect.height * 100;
      const left = startLeftPct + (e.clientX - startMX) / cRect.width  * 100;
      el.style.top  = top.toFixed(2)  + '%';
      el.style.left = left.toFixed(2) + '%';
      tooltip.textContent = `${left.toFixed(0)}% / ${top.toFixed(0)}%`;
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      el.classList.remove('op-dragging');
      document.body.classList.remove('op-dragging');
      snapshot(); saveStyle();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // Resize handle (SE corner → change width)
  handle.addEventListener('mousedown', e => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX;
    const startW = el.offsetWidth;
    el.classList.add('op-active');

    function onMove(e) {
      const w = Math.max(20, startW + (e.clientX - startX));
      el.style.width  = w + 'px';
      el.style.height = 'auto';
      tooltip.textContent = `${w}px`;
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      snapshot(); saveStyle();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

/*
  makeResizable: for in-flow elements (buttons). Uses transform:scale() so
  it doesn't affect layout. Also allows nudging position with translate.
*/
function makeResizable(el, cssSelector, file) {
  el.classList.add('op-draggable');
  el.style.display = el.style.display || 'inline-flex';

  const ring    = el.appendChild(Object.assign(document.createElement('div'), { className: 'op-drag-ring' }));
  const handle  = el.appendChild(Object.assign(document.createElement('div'), { className: 'op-resize-handle' }));
  const tooltip = el.appendChild(Object.assign(document.createElement('div'), { className: 'op-drag-tooltip' }));

  let scale = 1, tx = 0, ty = 0;

  function applyTransform() {
    el.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }
  function saveStyle() {
    setIndexAttr(cssSelector, 'style', `transform:translate(${tx}px,${ty}px) scale(${scale.toFixed(3)})`);
    markDirty();
  }

  // Drag to nudge position
  el.addEventListener('mousedown', e => {
    if (!editMode || e.target === handle) return;
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX, startY = e.clientY;
    const startTx = tx, startTy = ty;
    el.classList.add('op-active', 'op-dragging');
    document.body.classList.add('op-dragging');

    function onMove(e) {
      tx = startTx + (e.clientX - startX);
      ty = startTy + (e.clientY - startY);
      applyTransform();
      tooltip.textContent = `${tx > 0 ? '+' : ''}${Math.round(tx)}px / ${ty > 0 ? '+' : ''}${Math.round(ty)}px`;
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      el.classList.remove('op-dragging');
      document.body.classList.remove('op-dragging');
      snapshot(); saveStyle();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // Resize handle → scale up/down
  handle.addEventListener('mousedown', e => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX, startScale = scale;
    el.classList.add('op-active');

    function onMove(e) {
      scale = Math.max(0.3, startScale + (e.clientX - startX) * 0.005);
      applyTransform();
      tooltip.textContent = `${Math.round(scale * 100)}%`;
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      snapshot(); saveStyle();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
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
  // Only shown for non-Stream videos (poster+url style)
  if (item.streamUid) return;
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

// Open Stream picker and resolve with selected video object (or null)
let _streamResolve = null;

function loadStreamGrid() {
  const sub  = $('stream-sub');
  const grid = $('stream-grid');
  sub.textContent = 'Loading your library…';
  grid.innerHTML  = '';
  fetch('/api/stream-videos').then(r => r.json()).then(data => {
    if (!data.configured) { sub.textContent = 'Cloudflare credentials not configured.'; return; }
    if (!data.videos.length) { sub.textContent = 'No videos yet — upload one above.'; return; }
    sub.textContent = `${data.videos.length} video${data.videos.length !== 1 ? 's' : ''} — click one to add it.`;
    data.videos.forEach(v => {
      const card = document.createElement('div');
      card.className = 'op-stream-card';
      card.innerHTML = `<img src="${v.thumbnail || ''}" alt="${v.name}" onerror="this.style.display='none'"><span>${v.name}</span>`;
      card.addEventListener('click', () => {
        streamModal.hidden = true;
        if (_streamResolve) { _streamResolve(v); _streamResolve = null; }
      });
      grid.appendChild(card);
    });
  }).catch(e => { sub.textContent = 'Error: ' + e.message; });
}

function pickFromStream() {
  return new Promise(resolve => {
    _streamResolve = resolve;
    $('stream-upload-status').textContent = '';
    $('stream-progress').hidden = true;
    $('stream-progress-bar').style.width = '0';
    streamModal.hidden = false;
    loadStreamGrid();
  });
}

// Upload video directly to Cloudflare Stream from the browser
$('stream-upload-btn').addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'video/*';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;

    const status   = $('stream-upload-status');
    const progress = $('stream-progress');
    const bar      = $('stream-progress-bar');

    status.textContent = 'Getting upload URL…';
    progress.hidden = false;
    bar.style.width = '0%';
    $('stream-upload-btn').disabled = true;

    try {
      // Step 1: get a one-time direct-upload URL from our server
      const r = await fetch('/api/stream-upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name })
      });
      const { uid, uploadURL, error } = await r.json();
      if (error) throw new Error(error);

      // Step 2: upload directly to Cloudflare (XHR for progress events)
      await new Promise((res, rej) => {
        const form = new FormData();
        form.append('file', file);
        const xhr = new XMLHttpRequest();
        xhr.open('POST', uploadURL);
        xhr.upload.onprogress = e => {
          if (e.lengthComputable) {
            const pct = Math.round(e.loaded / e.total * 100);
            bar.style.width = pct + '%';
            status.textContent = `Uploading… ${pct}%`;
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) res();
          else rej(new Error('Upload failed: ' + xhr.status));
        };
        xhr.onerror = () => rej(new Error('Network error'));
        xhr.send(form);
      });

      bar.style.width = '100%';
      status.textContent = '✓ Uploaded — processing…';

      // Immediately resolve with the new uid so it can be added to the project.
      // CF processes the video async so thumbnail won't exist yet.
      streamModal.hidden = true;
      if (_streamResolve) {
        _streamResolve({ uid, name: file.name, thumbnail: '' });
        _streamResolve = null;
      }
    } catch (e) {
      status.textContent = 'Error: ' + e.message;
    } finally {
      $('stream-upload-btn').disabled = false;
    }
  };
  input.click();
});

// Cancel stream picker
$('stream-cancel').addEventListener('click', () => {
  streamModal.hidden = true;
  if (_streamResolve) { _streamResolve(null); _streamResolve = null; }
});

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
