# Oceane Productions — website

Plain static site: `index.html`, `styles.css`, `script.js`, `assets/`. No build step, no framework — works as-is.

## Put it on GitHub
1. Create a new repo on GitHub (e.g. `oceane-site`), public or private — doesn't matter.
2. Copy everything in this `oceane-site/` folder into the repo root (so `index.html` sits at the top level, not inside a subfolder).
3. Commit and push.

## Deploy on Cloudflare Pages
1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Authorize GitHub, pick the repo.
3. Build settings: **Framework preset: None**, **Build command: (leave empty)**, **Build output directory: /**. There's nothing to build — it's just files.
4. Click **Save and Deploy**. You'll get a live `*.pages.dev` URL in about a minute.
5. Every future push to the repo's main branch auto-redeploys.

## Connect your real domain (whenever you're ready)
1. In the Pages project → **Custom domains** → add `oceaneproductions.com` (or whatever it is).
2. If the domain's DNS is already on Cloudflare, it's a one-click add. If it's still on Squarespace, you'll transfer/point DNS to Cloudflare first — Cloudflare's domain transfer wizard walks you through it; no rush, the `*.pages.dev` URL works fine to preview and share in the meantime.

## Editing content for now
Every project lives in `data/projects.json` — open it in any text editor:
- Add/edit/remove a project by editing its entry (title, client, kind, services, year, description).
- `media` is a list of `{ "type": "image", "src": "filename.jpg" }` or `{ "type": "video", "poster": "filename.jpg" }` in any order — drop matching files into `assets/photos/` and reference the filename. Works with just images, just a video, or a mix.
- The homepage tiles and each project's detail page (`project.html?p=<slug>`) both read this same file — no other edits needed.

This isn't a CMS yet — it's the "own the code" tradeoff we talked about, just with content pulled out into one JSON file instead of scattered across HTML. When you're ready for a lighter editing workflow (a form instead of a text file), that's the "editing tool" described in `HANDOFF.md` — a separate follow-up.
