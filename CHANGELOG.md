# Changelog

All notable changes to this project are documented here. Format: [Keep a Changelog](https://keepachangelog.com),
versioning: [SemVer](https://semver.org).

## [Unreleased]

## [1.0.1] - 2026-11-16

### Fixed

- Single gift-chain draws froze the browser on large rosters (1,000 people took ~66 s); now ~5 ms for 5,000.
- Draw engine no longer builds a full n² table; random-mode draws of 5,000 people take ~10–30 ms.
- A 2-person exchange could not be drawn with the default "no reciprocal pairs" rule (rule now applies to 3+ only).
- Editing any participant field reset the draw when "avoid same department" was on, even if the department was unchanged.
- Editing a participant could create a duplicate email.
- After enabling access codes, old unprotected links stayed copyable/exportable until new ones were encrypted.
- "Export links" could export empty links while links were still being generated (now shows progress).
- Dialogs stole focus back to the first field when the page re-rendered; added a keyboard focus trap.
- Two open tabs could silently overwrite each other's changes; tabs now sync via storage events.
- "Start next round" picked the year from today's date instead of bumping the year in the exchange name.
- Malformed backup files could crash the import; entries are now validated individually.
- Dashboard filter "All" hid archived exchanges; renamed to "Active".

### Added

- Property-based test comparing the draw engine against brute force on random rosters and rules.
- Performance tests for 1,000 and 5,000-person rosters; regression tests for every fix above.

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
