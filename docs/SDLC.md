# Software Development Life Cycle

SecretSanta uses a lightweight, iterative SDLC (Agile/Scrum-flavoured) with automated quality gates.

## 1. Planning & requirements

- Work starts as a GitHub Issue using the **Feature request** or **Bug report** template.
- Each feature gets acceptance criteria and is mapped to a requirement ID in [REQUIREMENTS.md](REQUIREMENTS.md).
- Issues are triaged weekly: label (`bug`, `enhancement`), severity (S1–S3) and milestone.

## 2. Design

- Non-trivial technical decisions are captured as **Architecture Decision Records** in [`docs/adr`](adr).
- UI changes are checked against the design system in `src/components/ui.tsx` and `tailwind.config.js`.

## 3. Implementation

- **Branching:** trunk-based. `main` is always releasable; work happens on short-lived branches
  (`feat/…`, `fix/…`, `chore/…`) merged by pull request.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`, `docs:`, …).
- **Code standards:** TypeScript strict mode, ESLint, Prettier, `.editorconfig`.

## 4. Verification

Every push and PR runs the [CI workflow](../.github/workflows/ci.yml):

| Gate         | Tool                                          | Fails build when                                   |
| ------------ | --------------------------------------------- | -------------------------------------------------- |
| Formatting   | Prettier                                      | any file is unformatted                            |
| Lint         | ESLint + typescript-eslint + react-hooks      | any error                                          |
| Types        | `tsc -b` (strict, `noUncheckedIndexedAccess`) | any type error                                     |
| Tests        | Vitest + Testing Library                      | any failure, or coverage of `src/lib` < 85 % lines |
| Build        | Vite                                          | build fails                                        |
| Supply chain | `npm audit --omit=dev`                        | high/critical advisory in production deps          |
| SAST         | CodeQL (separate workflow)                    | new alerts (reviewed in Security tab)              |

See [TEST_PLAN.md](TEST_PLAN.md) for test levels and traceability.

## 5. Review

- At least one approving review from a CODEOWNER; the PR template checklist must be complete.
- Recommended branch protection on `main`: require PR, require status check **"Lint · Typecheck · Test · Build"**,
  require linear history, dismiss stale approvals.

## 6. Release & deployment

- Merging to `main` triggers [deploy.yml](../.github/workflows/deploy.yml): CI re-runs, then the build is published
  to GitHub Pages through the protected `github-pages` environment.
- Versions follow [SemVer](https://semver.org); notable changes go in [CHANGELOG.md](../CHANGELOG.md).
- Releases are tagged `vX.Y.Z` and published as GitHub Releases. See [DEPLOYMENT.md](DEPLOYMENT.md) for rollback.

## 7. Maintenance & operations

- Dependabot opens weekly npm and monthly Actions update PRs.
- Security reports are handled per [SECURITY.md](../SECURITY.md) (acknowledge ≤ 3 business days).
- Data schema is versioned (`secretsanta:v1` in localStorage); changes require a migration and an ADR.

## Definition of Done

- [ ] Acceptance criteria met and demoed
- [ ] Tests added/updated; all CI gates green
- [ ] Accessible (keyboard + screen-reader labels), works in light/dark and at 360 px width
- [ ] Docs and CHANGELOG updated
- [ ] Reviewed and merged to `main`; deployment succeeded
