# Contributing

Thanks for helping! Please read [docs/SDLC.md](docs/SDLC.md) first.

1. Open or pick an issue; agree on acceptance criteria.
2. Branch from `main`: `feat/<short-name>` or `fix/<short-name>`.
3. Develop with `npm run dev`; keep domain logic in `src/lib` (framework-free and unit-tested).
4. Before pushing run:
   ```bash
   npm run format && npm run lint && npm run typecheck && npm run coverage && npm run build
   ```
5. Use Conventional Commit messages and open a PR using the template. Update `CHANGELOG.md`.

## Coding guidelines

- TypeScript strict; no `any` without justification.
- UI primitives live in `src/components/ui.tsx` — reuse them instead of ad-hoc styles.
- Every interactive element needs an accessible name; respect `prefers-reduced-motion`.
- Never log or persist pairings anywhere other than the event's `assignments`.
