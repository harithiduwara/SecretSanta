# Test Plan

## Strategy

| Level              | Tooling                          | Scope                                                        | Location              |
| ------------------ | -------------------------------- | ------------------------------------------------------------ | --------------------- |
| Unit               | Vitest                           | Pure domain logic: draw engine, crypto, CSV, formatting, RNG | `src/lib/__tests__`   |
| Integration        | Vitest                           | Store actions incl. invalidation, audit, backup parsing      | `src/store/__tests__` |
| Component / flow   | Vitest + Testing Library + jsdom | Organizer & participant journeys through real routes         | `src/pages/__tests__` |
| Static             | tsc, ESLint, Prettier            | Types, hooks rules, style                                    | CI                    |
| Security           | CodeQL, npm audit, Dependabot    | SAST & supply chain                                          | CI / scheduled        |
| Manual exploratory | Browser                          | Visual QA light/dark, 360 px, keyboard-only                  | Before release        |

Coverage gate: ≥ 85 % lines/functions/statements and ≥ 80 % branches for `src/lib`.

## Requirements traceability

| Requirement         | Tests                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| FR-01, FR-12, FR-14 | `events.test.ts` (create/update/archive/delete, next round, backups); `flows.test.tsx` (create from dashboard) |
| FR-02, FR-03        | `events.test.ts` (dedupe), `csv.test.ts` (parsing, aliases, errors), `flows.test.tsx` (add participants)       |
| FR-04, FR-05, FR-07 | `draw.test.ts` (exclusions, departments, history, reciprocal, infeasible, Hall violation, uniformity)          |
| FR-06               | `draw.test.ts` (single loop), `validateAssignments` loop check                                                 |
| FR-08               | `events.test.ts` (draw invalidated on roster change; PIN toggle does not invalidate)                           |
| FR-09, NFR-02       | `crypto.test.ts` (round-trip, wrong code, tampering, malformed); `flows.test.tsx` (reveal & unlock)            |
| FR-13               | `events.test.ts` (audit entries, failed draw logged)                                                           |
| NFR-03              | `draw.test.ts` validates every generated draw with the independent validator                                   |

## Release checklist (manual)

- [ ] Create exchange → import CSV → add exclusions → draw → copy link → open in private window
- [ ] Access-code link rejects wrong code, accepts correct one (case-insensitive)
- [ ] Keyboard-only navigation of all tabs and modals (Esc closes modals)
- [ ] Light/dark/system theme; mobile width 360 px
- [ ] Backup export → erase all → import restores data
