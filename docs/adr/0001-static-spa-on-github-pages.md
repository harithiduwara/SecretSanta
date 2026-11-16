# ADR-0001: Static SPA hosted on GitHub Pages

- **Status:** Accepted
- **Date:** 2026-11-16

## Context

The app must be hosted on GitHub, be free to operate, and avoid holding employees' personal data on a server
(which would trigger GDPR processor obligations, security reviews and on-call duties).

## Decision

Build a client-only React SPA, persist state to `localStorage`, and deploy static assets to GitHub Pages via
GitHub Actions. Use `HashRouter` so deep links work without server rewrites.

## Consequences

- ✅ Zero infrastructure cost, global CDN, no server attack surface, no data processor.
- ✅ Works offline after first load.
- ⚠️ Data is per-browser: co-organizers must share JSON backups. Mitigated by export/import.
- ⚠️ No server-side email: organizers use `mailto:` or exported CSV with their own tooling.
