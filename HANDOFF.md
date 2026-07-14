# Handoff: Oceane Productions website

## Overview
Static one-page portfolio site for Oceane Productions (small-to-mid-budget commercial/documentary/social production company). Full visual design is finished and coded — this is not a prototype to redo, it's the real site; the remaining work is deployment + a couple of features.

## Current state
- Plain static HTML/CSS/JS, no framework, no build step: `index.html`, `project.html`, `styles.css`, `script.js`, `render.js`, `data/projects.json`, `assets/`.
- **Data-driven**: `data/projects.json` is the single source of truth for every project — both the homepage tiles (`index.html`) and the detail page (`project.html?p=<slug>`) fetch this file client-side and render from it (`render.js`). Add/edit/remove a project by editing this one JSON file; nothing else needs to change.
- Not yet pushed to GitHub or deployed.
- Each project in `projects.json` has a `media` array (`{type:"image", src:"file.jpg"}` or `{type:"video", poster:"file.jpg"}`, in any order/combination) — the detail page groups consecutive images into a gallery grid and renders videos as full-width poster blocks, so a project can have just photos, just a video, or both without any template changes.
- 4 placeholder photos are reused across the 7 media slots (hero + 6 projects) in `assets/photos/`; videos are only mocked as poster images with a play-button overlay (no real video files/player wired in yet).
- The "say hi" / "start a project" buttons link to `mailto:hello@oceaneproductions.com` — a stand-in, not a real form.

## The editing tool (next thing to build)
The plan is a small custom tool (built here in Claude Code) that lets the client create/edit/delete projects without touching code — reading and writing `data/projects.json` (and dropping files into `assets/photos/` or wherever video ends up living) is the whole contract. Concretely it needs to:
- List existing projects (from `projects.json`), let the client edit each field (title, client, kind, services, year, description, slug/order).
- Manage the `media` array per project — reorder items, mark each as image or video, upload/replace the actual files.
- Add a brand-new project (append to the JSON + assign the next slug) and delete one.
- Write changes back to `data/projects.json` in this repo (simplest: a local Node/Express admin server that edits the file directly and commits to git; fancier: a real backend/headless CMS later if this outgrows a JSON file).
No UI for this exists yet — this repo only has the public-facing site that already knows how to render whatever's in `projects.json`.

## To do
1. **Ship it**: push to a GitHub repo (root = this folder's contents), connect to Cloudflare Pages (framework preset: None, no build command, output dir `/`). Steps are in this folder's `README.md`.
2. **Real photos/video**: replace the files in `assets/photos/` with actual client work, and update the matching `src`/`poster` filenames in `data/projects.json`. Real video needs an actual player/file wired into `render.js`'s video block (currently just a poster image + play icon).
3. **The editing tool**: build the small admin described above so the client can manage `data/projects.json` (and media files) without opening code.
4. **Real contact form**: swap the `mailto:` links for an actual form (Cloudflare Pages Functions + email service, or a form provider like Formspree/Basin).

## Design tokens
- Fonts: **DM Serif Display** (headings, regular + italic) and **DM Sans** (body/UI, variable weight) — both loaded from Google Fonts in `index.html`, no local font files needed.
- Palette: cream/offwhite `#fffcf9` (page bg), ink `#201e1a` (text), brand blue `#1b5294` (primary/links/accents), dusty blue `#89a7bb` / `#82abcc` (secondary accents), near-black `#141310` (footer/dark sections).
- Radii: pill buttons (`border-radius:999px`).
- Motion: `cubic-bezier(.16,1,.3,1)` easing throughout, 150-900ms depending on element; a couple of small infinite pulses (REC dot, scroll indicator) are intentional, not bugs.
- Layout: full-viewport-height (`100vh`) sections, one per project, alternating text left/right.

## Assets
- Logo: two PNG variants (dark blue for light backgrounds, offwhite for photos/dark backgrounds) in `assets/`.
- Icons: Instagram/YouTube/mail are inlined as raw SVG in `index.html` (Lucide icon set, MIT-licensed) — no icon files needed.
- Photos: currently stock/placeholder JPGs in `assets/photos/`, need replacing with real client work (see To-do #2).

## Files
Everything needed is in this folder: `index.html` (homepage), `project.html` (per-project detail page), `styles.css`, `script.js` (header scroll effect), `render.js` (fetches `data/projects.json` and renders both pages), `data/projects.json` (all project content — the thing the editing tool will manage), `assets/`, plus this file and `README.md` (deploy steps).
