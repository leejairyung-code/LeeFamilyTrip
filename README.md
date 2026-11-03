# Czechia and Germany family trip site, Nov 23 - Dec 9, 2026

Static, bilingual (English/Korean), offline-capable PWA. No backend, no tracking, no external fonts or CDNs.

- Content: `content/*.json` (see [ADMIN.md](ADMIN.md))
- Build: `npm run build` creates `dist/`. `npm run check` only validates content.
- Preview locally: `npm start`, then open http://localhost:8080
- Deploy: GitHub Actions workflow `.github/workflows/deploy.yml` publishes `dist/` to GitHub Pages on every push to `main`.
