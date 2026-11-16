# Requirements Specification

## 1. Purpose & scope

Enable an organizer (HR, team lead, family member) to run a fair Secret Santa gift exchange for 2–5,000 people
without a server, while keeping every participant's assignment private.

## 2. Stakeholders & personas

| Persona           | Goal                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------- |
| **Organizer**     | Set up an exchange quickly, enforce rules, distribute assignments without seeing them. |
| **Participant**   | Learn who to gift, their wishlist and the budget — privately, on any device.           |
| **IT / Security** | Ensure no personal data is sent to third parties; app is auditable and maintained.     |

## 3. Functional requirements

| ID    | Requirement                                                                                                                                                         | Priority |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-01 | Create, edit, archive, restore and delete exchanges with name, date, budget, currency and message.                                                                  | Must     |
| FR-02 | Add, edit and remove participants (name, optional email, department, wishlist).                                                                                     | Must     |
| FR-03 | Bulk-import participants from CSV/TSV with header detection, validation, preview and de-duplication.                                                                | Must     |
| FR-04 | Define one-way or mutual exclusions between participants.                                                                                                           | Must     |
| FR-05 | Optional rules: avoid same department, avoid previous pairings, avoid reciprocal pairs.                                                                             | Must     |
| FR-06 | Draw modes: random matching and single gift-chain (one cycle).                                                                                                      | Should   |
| FR-07 | Draw must never assign a person to themselves and must satisfy all active rules, or explain why it can't.                                                           | Must     |
| FR-08 | Changing roster or rules after a draw invalidates it (with confirmation).                                                                                           | Must     |
| FR-09 | Generate a private reveal link per participant; optional per-person access code.                                                                                    | Must     |
| FR-10 | Copy link, open pre-filled email, export distribution CSV, and track delivery status.                                                                               | Must     |
| FR-11 | Organizer can hide pairings (blind mode, default) and reveal only after confirmation.                                                                               | Should   |
| FR-12 | "Start next round" clones an exchange and records the previous draw in history.                                                                                     | Should   |
| FR-13 | Audit log of all changes per exchange (pairings never logged).                                                                                                      | Should   |
| FR-14 | JSON backup export/import of all data; erase-all with typed confirmation.                                                                                           | Must     |
| FR-15 | Dashboard with KPIs, status filters and search.                                                                                                                     | Should   |
| FR-16 | Optional per-exchange password: the exchange is stored encrypted and opens only with its ID and password; it locks on reload, on demand, and after 15 minutes idle. | Should   |

## 4. Non-functional requirements

| ID     | Category        | Requirement                                                                                                                                                                                                                |
| ------ | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-01 | Privacy         | No backend; no analytics; personal data never leaves the organizer's browser except inside links they share.                                                                                                               |
| NFR-02 | Security        | Reveal payloads encrypted with AES-256-GCM; access-code keys derived with PBKDF2-SHA-256 ≥ 200k iterations; password-protected exchanges encrypted at rest (AES-256-GCM, PBKDF2-SHA-256 600k); CSPRNG for draws and codes. |
| NFR-03 | Correctness     | Every draw is independently re-validated before being saved.                                                                                                                                                               |
| NFR-04 | Performance     | Draw of 1,000 participants with rules completes in < 1 s on a mid-range laptop; initial JS < 100 kB gzip.                                                                                                                  |
| NFR-05 | Accessibility   | WCAG 2.1 AA: keyboard operable, labelled controls, focus rings, reduced-motion support, sufficient contrast.                                                                                                               |
| NFR-06 | Usability       | Responsive from 360 px; light/dark/system themes.                                                                                                                                                                          |
| NFR-07 | Availability    | Static hosting on GitHub Pages CDN; works offline once loaded (no API calls).                                                                                                                                              |
| NFR-08 | Maintainability | TypeScript strict; ≥ 85 % line coverage of domain logic; automated dependency updates.                                                                                                                                     |
| NFR-09 | Portability     | Latest two versions of Chrome, Edge, Firefox, Safari (desktop & mobile).                                                                                                                                                   |

## 5. Constraints & assumptions

- Hosting is static (GitHub Pages), so state is per-browser; co-organizers share via JSON backup.
- Email delivery uses the organizer's own mail client (`mailto:`), avoiding storage of credentials.
