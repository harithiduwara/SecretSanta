# Changelog

All notable changes to this project are documented here. Format: [Keep a Changelog](https://keepachangelog.com),
versioning: [SemVer](https://semver.org).

## [Unreleased]

## [1.0.0] - 2026-11-16

### Added

- Multi-exchange dashboard with KPIs, filters and search.
- Participant management with CSV/TSV bulk import, de-duplication, departments and wishlists.
- Rules engine: exclusions, same-department avoidance, previous-pair avoidance, no reciprocal pairs, single gift chain.
- Secure draw engine (CSPRNG + randomized bipartite matching) with independent validation.
- Encrypted reveal links with optional per-person access codes; email drafts, CSV export and delivery tracking.
- Audit log, next-round cloning, archive/restore, JSON backup/restore.
- Light/dark/system theme, responsive and accessible UI.
- CI (lint, types, tests with coverage gate, build, audit), CodeQL, Dependabot and GitHub Pages deployment.
