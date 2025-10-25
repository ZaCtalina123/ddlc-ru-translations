# DDLC Russian Translations

Russian translations for Doki Doki Literature Club (DDLC) mods by ZA_CTALINA_123.  
This repository hosts a static website for publishing downloads and information via GitHub Pages.

Note: This is a personal project intended for publishing my own Russian translations. It is not designed for general use or third‑party contributions.

## Live site

- Website: https://zactalina123.github.io/ddlc-ru-translations/
- Repository: https://github.com/ZaCtalina123/ddlc-ru-translations

## Overview

- 100% static, client-side site (no backend, no build step)
- Catalog is driven by a YAML file (data.yaml)
- Client-side search, filter, and sort
- Files are hosted externally (e.g., Google Drive) and linked from the catalog
- Strong accessibility and performance focus
- Strict Content Security Policy (CSP) with only required CDNs allowed

All translations in this repository are created by me. Original mods are the property of their respective authors.

## Status and support

- Personal site; issues and pull requests may not be reviewed
- No guarantees of availability, support, or update cadence
- You can fork the repository for your own use

## Features

- Data-driven catalog sourced from data.yaml
- Search, status filter, and sorting in the browser
- Google Drive view/download links generated from file_id
- Responsive layout, semantic HTML
- Accessible controls and focus management
- Light/dark theme support (system-aware)
- Local cache with TTL to reduce re-fetching
- Graceful loading, empty, and error states
- Works on GitHub Pages (no server required)

## Project structure

- index.html — Page markup, metadata, SEO, Open Graph, JSON-LD, CSP
- styles.css — Design tokens, components, responsive rules, accessibility helpers
- script.js — Data loading, normalization, rendering, state and URL sync, caching
- data.yaml — Catalog content you maintain
- assets/ — Icons, manifest, and related static assets
- .gitignore — VCS housekeeping

No build step: the site is served as-is.

## Data model (data.yaml)

Top-level key mods contains an array of mod objects.

Required and optional fields:

- id (string, kebab-case, unique)
- name (string)
- description (string, can be long text)
- original_author (string) — original mod author credit
- status (string) — e.g., "Завершен" or "В процессе"
- release_date (YYYY-MM-DD)
- tags (array of strings)
- warnings (array of strings, optional) — content warnings
- image (string, URL, optional)
- file_id (string, Google Drive file ID, optional)
- size_mb (number, optional)
- source_url (string, URL to the mod/author page, optional)
- notes (string, optional)

Example:

```yaml
mods:
  - id: example-mod-id
    name: Example Mod Name
    original_author: SomeAuthor
    description: >
      Long Russian description of the mod goes here.
    status: "Завершен"
    release_date: 2025-01-15
    tags: ["романтика", "драма"]
    warnings: ["психологический хоррор"]
    image: https://example.com/image.jpg
    file_id: 1AbCdEfGhIjKlmNoPqRsTuVwXyZ
    size_mb: 512
    source_url: https://reddit.com/r/DDLCMods/...
    notes: "Any additional notes."
```

Notes:
- file_id is used to construct Google Drive view/download links on the client
- Keep id values unique to avoid collisions
- The app validates and normalizes fields before rendering

## Local development

You can open index.html directly, but using a static server is recommended to match GitHub Pages behavior.

Option A (Python):
- python3 -m http.server 8080
- Open http://localhost:8080

Option B (Node):
- npx serve .
- Open the printed URL

Edits to HTML/CSS/JS/YAML take effect on refresh. The app may cache data in localStorage; use your browser devtools to clear site data or append a cache-busting query (e.g., ?dev=1) if needed.

## Deployment (GitHub Pages)

Main branch, root directory:
1) Push to main (or the branch configured for Pages)  
2) In repository Settings → Pages:
   - Source: Deploy from a branch
   - Branch: main, Folder: / (root)  
3) Wait for GitHub Pages to deploy  
4) Your site will be available at https://zactalina123.github.io/ddlc-ru-translations/

Tip: If you rename the repository, the URL changes accordingly.

## Editing content (adding/updating mods)

- Update data.yaml:
  - Add a new entry under mods using the schema above
  - Ensure id is new and unique
  - Provide either a direct file link or a Google Drive file_id
- Commit and push:
  - The site will automatically reflect the changes after Pages redeploys
- Images:
  - Use stable external URLs (e.g., Reddit CDN or your own hosting)
  - Keep sizes reasonable for faster loading

## Caching and refresh

- The app may store a cached copy of data.yaml in localStorage with a limited TTL to reduce fetches
- To force a refresh:
  - Hard reload (Ctrl/Cmd+Shift+R)
  - Clear site data (Application → Storage → Clear)
  - Bump asset query versions if necessary (e.g., styles.css?v=YYYY-MM-DD)

## Accessibility and performance

- Semantic HTML and ARIA labels
- Keyboard-friendly focus styles and skip link
- Respects reduced motion preferences
- Lightweight, no heavy runtime dependencies (uses pinned js-yaml 4.1.0)
- Strict CSP in index.html allows only required sources:
  - cdnjs for Font Awesome and js-yaml
  - self for scripts, styles, images, fonts (plus https/data: where required)

## Licenses and credits

- Code: AGPL-3.0 — https://www.gnu.org/licenses/agpl-3.0.html
- Content (translations and site text): CC BY-NC-SA 4.0 — https://creativecommons.org/licenses/by-nc-sa/4.0/
- Original mods: Copyright remains with their respective authors
- Not affiliated with Team Salvato

## Contact

- Email: zactalina123.main@gmail.com
- GitHub: https://github.com/ZaCtalina123
- Reddit: https://reddit.com/user/ZA_CTALINA_123