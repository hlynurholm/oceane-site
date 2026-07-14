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
Everything is hand-written HTML — open `index.html` in any text editor:
- Project titles/categories: each project is a `<a class="op-proj">` block near the middle of the file — edit the `op-proj-title`/`op-proj-kind` text directly.
- Photos: swap the files in `assets/photos/` (keep the same filenames, or update the `background-image:url(...)` path in `index.html` to match new filenames).
- Copy (headline, footer line, etc.): plain text in `index.html`, edit directly.

This isn't a CMS yet — it's the "own the code" tradeoff we talked about. When you're ready for a lighter editing workflow (swap photos/text without opening code), that's a separate follow-up — a small admin form that commits changes to this repo, or a headless CMS (Sanity/Contentful) feeding this same frontend. Happy to help scope that whenever.
