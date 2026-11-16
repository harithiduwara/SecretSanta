# Architecture

## Overview

SecretSanta is a static single-page application (React 18 + TypeScript + Vite + Tailwind CSS) deployed to GitHub
Pages. There is intentionally **no server**: all state is kept in the organizer's browser and participant
assignments travel inside encrypted links.

```
src/
├── App.tsx                 Routing (HashRouter) + lazy-loaded pages + error boundary
├── pages/                  Dashboard, EventPage (tabs), Reveal, Settings, NotFound
├── components/
│   ├── ui.tsx              Design-system primitives (Button, Card, Modal, Toggle, …)
│   └── event/              Participants, Rules, Draw & distribute, Activity tabs
├── store/
│   ├── events.ts           Zustand store (persisted to localStorage, versioned) + backup parser
│   └── ui.ts               Theme + toasts
├── lib/                    Framework-free domain logic (100 % unit-tested)
│   ├── draw.ts             Constraint engine, matching & single-loop solvers, validator
│   ├── crypto.ts           Reveal-link sealing/opening (Web Crypto)
│   ├── csv.ts              RFC 4180 parser, importer, safe exporter
│   ├── random.ts           CSPRNG helpers (unbiased ints, shuffle, ids, access codes)
│   └── format.ts           Money/date formatting
└── hooks/                  Theme application
```

## Key flows

### Draw

1. `buildAllowed` turns participants, exclusions and rules into a giver → allowed-receivers graph.
2. `diagnose` surfaces obvious infeasibility (someone with no options) with human-readable messages.
3. **Random mode:** randomized Kuhn augmenting-path bipartite matching over shuffled adjacency — polynomial time,
   guaranteed to find a perfect matching if any exists. Reciprocal pairs are then repaired with local 2-swaps.
4. **Single-loop mode:** randomized DFS with a Warnsdorff-style heuristic for a Hamiltonian cycle (bounded effort).
5. `validateAssignments` re-checks every invariant before the store persists the result (defence in depth).

### Reveal link

```
payload = { event, date, budget, currency, giver, receiver, wishlist, message }
open mode:   token = "k." + key   + "." + iv + "." + AES-GCM(key, payload)
code mode:   token = "p." + salt  + "." + iv + "." + AES-GCM(PBKDF2(code, salt, 210k), payload)
url = <app>/#/reveal/<token>
```

The token lives in the URL **fragment**, which browsers never transmit to the web server.

### Persistence

Zustand `persist` middleware stores `{ events, vaults }` under `secretsanta:v1` with a schema `version` for
future migrations. Backups are validated structurally on import.

### Password-protected exchanges

`events` holds plain exchanges and protected exchanges that are unlocked in this tab. `vaults` holds the encrypted
copy of every protected exchange; `keys` (memory only, never persisted) holds the derived key while one is
unlocked. Storage only ever receives `vaults` for protected exchanges, never their plain form.

```
password ──PBKDF2-SHA-256 (600k, random salt)──► AES-256 key (non-extractable, memory only)
exchange JSON ──AES-256-GCM (fresh nonce, exchange id as associated data)──► vault ──► localStorage / backup
```

Any change to an unlocked protected exchange is re-encrypted in the background, in order, per exchange.
Turning protection on, changing the password and "Start next round" encrypt first and then commit the vault and
key in one state update, so an exchange is never stored in neither form. See
[ADR-0004](adr/0004-password-protected-exchanges.md).

## Decisions

See [ADRs](adr):

- [ADR-0001](adr/0001-static-spa-on-github-pages.md) Static SPA on GitHub Pages
- [ADR-0002](adr/0002-encrypted-self-contained-links.md) Encrypted self-contained reveal links
- [ADR-0003](adr/0003-matching-algorithm.md) Randomized bipartite matching for draws
- [ADR-0004](adr/0004-password-protected-exchanges.md) Password-protected exchanges, encrypted in the browser
