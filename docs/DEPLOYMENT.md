# Deployment & Operations

## Environments

| Environment   | Trigger                            | URL                                          |
| ------------- | ---------------------------------- | -------------------------------------------- |
| Local         | `npm run dev`                      | http://localhost:5173                        |
| Preview build | `npm run build && npm run preview` | http://localhost:4173                        |
| Production    | push/merge to `main`               | https://harithiduwara.github.io/SecretSanta/ |

## One-time GitHub setup

1. **Settings → Pages → Build and deployment → Source: _GitHub Actions_.**
2. **Settings → Environments → github-pages:** restrict deployments to the `main` branch (optionally add reviewers).
3. **Settings → Branches:** protect `main` (require PR + status check _Lint · Typecheck · Test · Build_).
4. **Settings → Code security:** enable Dependabot alerts, secret scanning and CodeQL default setup (or keep the workflow).

## Pipeline

`deploy.yml` → reuses `ci.yml` (all quality gates) → builds with `BASE_PATH=/<repo>/` → uploads the Pages
artifact → deploys to the `github-pages` environment.

## Releasing

1. Move "Unreleased" entries in `CHANGELOG.md` under a new version heading; bump `version` in `package.json`.
2. Merge to `main` (auto-deploys).
3. Tag: `git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z`, then create a GitHub Release from the tag.

## Rollback

- **Fast:** Actions → _Deploy to GitHub Pages_ → open the last good run → **Re-run all jobs** (redeploys that commit).
- **Permanent:** `git revert <bad-commit>` on `main` and merge; the pipeline redeploys automatically.

## Monitoring

Static hosting has no runtime services. Watch: Actions run status, Dependabot PRs, CodeQL alerts, and GitHub
Pages status (githubstatus.com).
