# ADR-0004: Password-protected exchanges, encrypted in the browser

- **Status:** Accepted
- **Date:** 2026-11-16

## Context

Organizers asked for an ID and password per exchange so others can't view it. The app has no server
([ADR-0001](0001-static-spa-on-github-pages.md)), so a password screen alone would protect nothing: the data
would still be readable in `localStorage` by anyone with the browser, by browser extensions, and by every other
GitHub Pages site under the same `<user>.github.io` origin.

Options considered:

1. **Password screen only.** Rejected: no real protection.
2. **Server accounts** (e.g. a hosted auth + database). Real logins, multi-device and password reset, but a third
   party would hold employees' personal data and the no-backend architecture would be replaced.
3. **Client-side encryption per exchange.** Chosen.

## Decision

Each exchange can be protected with its own password. The exchange is serialised and encrypted with AES-256-GCM
(fresh 96-bit nonce per save, exchange id bound as associated data). The key is derived with PBKDF2-SHA-256,
600,000 iterations (OWASP 2023) and a random 128-bit salt, is non-extractable, and lives only in memory while
the exchange is unlocked. The exchange ID shown in the URL and on the locked card is the "user name"; only the ID
and timestamps are visible while locked.

It locks on reload or closing the tab, on demand ("Lock" / "Lock all"), and after 15 minutes without activity.
Backups keep protected exchanges encrypted. A round started from a protected exchange is protected with the same
password.

## Consequences

- ✅ Unreadable at rest to other users of the browser, other same-origin sites, extensions reading storage, and
  holders of a backup file.
- ✅ No server, no cost, no new data processor.
- ⚠️ **No recovery.** A forgotten password means the exchange can't be opened; the only option is to delete it.
  The UI requires the organizer to confirm they have stored the password.
- ⚠️ While unlocked, malicious code running in the page (e.g. a compromised dependency) can read it. This is
  why the CI/CD hardening in the security review still matters.
- ⚠️ Password strength is the organizer's: minimum 8 characters. An attacker with the stored data can try
  passwords offline, slowed by PBKDF2.
- ⚠️ The ID, creation and last-saved times are not secret.
