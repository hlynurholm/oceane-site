'use strict';
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { execSync } = require('child_process');
const cheerio = require('cheerio');
const sharp = require('sharp');

const app = express();
const PORT = 3000;
const SITE = path.join(__dirname, '..');
const SNAPS = path.join(SITE, '.snapshots');

if (!fs.existsSync(SNAPS)) fs.mkdirSync(SNAPS, { recursive: true });

app.use(express.json({ limit: '10mb' }));

// File uploads — stored in memory first so sharp can compress before writing to disk
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

async function compressAndSave(buffer, originalname) {
  const safe = originalname.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '');
  const ext = path.extname(safe).toLowerCase();
  const isPng = ext === '.png';
  const dest = path.join(SITE, 'assets', 'photos');

  let outBuffer, outName;

  if (isPng) {
    // PNGs (logos, graphics with transparency) — keep format, resize, compress
    outBuffer = await sharp(buffer)
      .resize(2400, 2400, { fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 8 })
      .toBuffer();
    outName = safe;
  } else {
    // Photos — convert to WebP: max 2400px, quality 82
    // WebP is 30-50% smaller than JPEG at same perceived quality
    const base = path.basename(safe, ext);
    outName = base + '.webp';
    outBuffer = await sharp(buffer)
      .resize(2400, 2400, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  }

  fs.writeFileSync(path.join(dest, outName), outBuffer);
  const inKB = Math.round(buffer.length / 1024);
  const outKB = Math.round(outBuffer.length / 1024);
  return { filename: outName, inKB, outKB };
}

// Serve admin static files at /admin/
app.use('/admin', express.static(__dirname));

// Inject editor into HTML responses
function injectEditor(html) {
  html = html.replace('</head>', '  <link rel="stylesheet" href="/admin/editor.css">\n</head>');
  html = html.replace('</body>', '  <script src="/admin/editor.js"></script>\n</body>');
  return html;
}

app.get('/', (req, res) => {
  res.type('html').send(injectEditor(fs.readFileSync(path.join(SITE, 'index.html'), 'utf8')));
});

app.get(/\.(html)$/, (req, res, next) => {
  const file = path.join(SITE, req.path.slice(1));
  if (!fs.existsSync(file)) return next();
  res.type('html').send(injectEditor(fs.readFileSync(file, 'utf8')));
});

// Static site files
app.use(express.static(SITE));

// ── API ────────────────────────────────────────────────────────────────────────

app.get('/api/projects', (req, res) => {
  res.json(JSON.parse(fs.readFileSync(path.join(SITE, 'data', 'projects.json'), 'utf8')));
});

app.post('/api/save-projects', (req, res) => {
  try {
    fs.writeFileSync(path.join(SITE, 'data', 'projects.json'), JSON.stringify(req.body, null, 2));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// updates: [{selector, html?, attr?: {name, value}}]
app.post('/api/save-html', (req, res) => {
  try {
    const { file, updates } = req.body;
    const fp = path.join(SITE, file);
    const $ = cheerio.load(fs.readFileSync(fp, 'utf8'), { decodeEntities: false });
    for (const u of updates) {
      if (u.attr) $(u.selector).attr(u.attr.name, u.attr.value);
      else $(u.selector).html(u.html);
    }
    fs.writeFileSync(fp, $.html());
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  try {
    const result = await compressAndSave(req.file.buffer, req.file.originalname);
    console.log(`  Upload: ${req.file.originalname} ${result.inKB}KB → ${result.outName || result.filename} ${result.outKB}KB`);
    res.json({ ok: true, filename: result.filename });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Cloudflare Stream ─────────────────────────────────────────────────────────

function getCfConfig() {
  const cfPath = path.join(__dirname, 'cf-config.json');
  if (!fs.existsSync(cfPath)) return null;
  try {
    const cfg = JSON.parse(fs.readFileSync(cfPath, 'utf8'));
    if (!cfg.accountId || cfg.accountId === 'YOUR_ACCOUNT_ID_HERE') return null;
    return cfg;
  } catch { return null; }
}

app.get('/api/stream-videos', async (req, res) => {
  const cfg = getCfConfig();
  if (!cfg) return res.json({ configured: false, videos: [] });
  try {
    const r = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/stream?limit=50`,
      { headers: { Authorization: `Bearer ${cfg.apiToken}` } }
    );
    const data = await r.json();
    if (!data.success) return res.status(502).json({ error: data.errors?.[0]?.message || 'CF error' });
    const videos = (data.result || []).map(v => ({
      uid:       v.uid,
      name:      v.meta?.name || v.uid,
      thumbnail: v.thumbnail,
      duration:  v.duration,
    }));
    res.json({ configured: true, videos });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/snapshots', (req, res) => {
  const list = fs.readdirSync(SNAPS)
    .filter(f => fs.statSync(path.join(SNAPS, f)).isDirectory())
    .sort().reverse();
  res.json(list);
});

function copyDir(src, dest, skip) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    if (skip.includes(entry)) continue;
    const s = path.join(src, entry);
    const d = path.join(dest, entry);
    if (fs.statSync(s).isDirectory()) copyDir(s, d, []);
    else fs.copyFileSync(s, d);
  }
}

app.post('/api/git-push', (req, res) => {
  const msg = (req.body.message || 'Update site content').replace(/"/g, '\\"');
  try {
    // Always snapshot first
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    copyDir(SITE, path.join(SNAPS, ts), ['admin', '.snapshots', '.git', 'node_modules', '.DS_Store']);

    const status = execSync('git status --porcelain', { cwd: SITE }).toString().trim();
    if (!status) return res.json({ ok: true, snapshot: ts, noop: true });

    execSync('git add -A', { cwd: SITE });
    execSync(`git commit -m "${msg}"`, { cwd: SITE });
    execSync('git push', { cwd: SITE });
    res.json({ ok: true, snapshot: ts });
  } catch (e) {
    res.status(500).json({ error: (e.stderr || e.stdout || e.message || '').toString() });
  }
});

app.post('/api/restore/:snap', (req, res) => {
  const snapDir = path.join(SNAPS, req.params.snap);
  if (!fs.existsSync(snapDir)) return res.status(404).json({ error: 'Snapshot not found' });
  try {
    copyDir(snapDir, SITE, []);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/git-reset', (req, res) => {
  try {
    execSync('git checkout -- .', { cwd: SITE });
    execSync('git clean -fd --exclude=.snapshots --exclude=admin', { cwd: SITE });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => {
  console.log(`\n  Oceane Editor  →  http://localhost:${PORT}\n`);
});
