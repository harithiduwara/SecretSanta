# 🎁 SecretSanta — Enterprise Edition

[![CI](https://github.com/harithiduwara/SecretSanta/actions/workflows/ci.yml/badge.svg)](https://github.com/harithiduwara/SecretSanta/actions/workflows/ci.yml)
[![Deploy](https://github.com/harithiduwara/SecretSanta/actions/workflows/deploy.yml/badge.svg)](https://github.com/harithiduwara/SecretSanta/actions/workflows/deploy.yml)
[![CodeQL](https://github.com/harithiduwara/SecretSanta/actions/workflows/codeql.yml/badge.svg)](https://github.com/harithiduwara/SecretSanta/actions/workflows/codeql.yml)

A modern, privacy-first Secret Santa organizer for teams and organizations of any size. Constraint-aware draws,
end-to-end encrypted reveal links, multi-event management and a full audit trail — hosted for free on GitHub Pages
with **no backend and no data collection**.

**Live app:** https://harithiduwara.github.io/SecretSanta/

## Features

| Area             | Capabilities                                                                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Exchanges**    | Multiple concurrent exchanges · date, budget & currency · message to participants · archive/restore · "Start next round" that remembers past pairings                                   |
| **Participants** | Inline add/edit/remove · bulk CSV/TSV import with header detection & preview · de-duplication by email · departments/households · wishlists                                             |
| **Rules engine** | One-way & mutual exclusions · avoid same department · avoid previous years' pairs · no reciprocal pairs · _random_ or _single gift-chain_ mode · live feasibility diagnostics           |
| **Draw**         | Web Crypto CSPRNG · polynomial-time randomized bipartite matching (always finds a valid draw if one exists) · independent post-draw validation                                          |
| **Distribution** | Per-person encrypted reveal links · optional per-person access codes (PBKDF2 + AES-256-GCM) · one-click email drafts · CSV export of links · delivery tracking · organizer "blind mode" |
| **Governance**   | Per-exchange audit log · JSON backup/restore · formula-injection-safe CSV export · data never leaves the browser                                                                        |
| **UX**           | Responsive, accessible (keyboard, ARIA, reduced-motion) · light/dark/system themes · animated gift reveal                                                                               |

## Quick start

```bash
nvm use            # Node 20+
npm ci
npm run dev        # http://localhost:5173
```

| Script                                        | Purpose                                              |
| --------------------------------------------- | ---------------------------------------------------- |
| `npm run dev`                                 | Start the Vite dev server                            |
| `npm run build`                               | Type-check and produce a production build in `dist/` |
| `npm run preview`                             | Serve the production build locally                   |
| `npm run lint` / `typecheck` / `format:check` | Static quality gates                                 |
| `npm test` / `npm run coverage`               | Unit + component tests (coverage gate ≥ 85 %)        |

## How it works

```
Organizer browser                                         Participant browser
┌──────────────────────────────┐   reveal link (email,   ┌────────────────────────────┐
│ React SPA  ──► Zustand store │   chat, …) carrying     │ #/reveal/<token>           │
│  │            (localStorage) │   ciphertext in the     │  decrypt locally (WebCrypto)│
│  └► draw engine ─► AES-GCM ──┼──────── URL fragment ──►│  optional access code       │
└──────────────────────────────┘   (never sent to server)└────────────────────────────┘
                     ▲ static files only
              GitHub Pages (CDN)
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for details.

## Software Development Life Cycle

This project follows a documented SDLC — see [docs/SDLC.md](docs/SDLC.md).

| Phase            | Artifact                                                               |
| ---------------- | ---------------------------------------------------------------------- |
| Requirements     | [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)                           |
| Design           | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/adr/](docs/adr)    |
| Implementation   | [CONTRIBUTING.md](CONTRIBUTING.md), PR template, CODEOWNERS            |
| Verification     | [docs/TEST_PLAN.md](docs/TEST_PLAN.md), CI workflow, CodeQL            |
| Release & deploy | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), [CHANGELOG.md](CHANGELOG.md) |
| Maintenance      | Dependabot, issue templates, [SECURITY.md](SECURITY.md)                |

## License

[MIT](LICENSE)
