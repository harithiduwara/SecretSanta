# Security Policy

## Supported versions

The latest release deployed from `main` is supported.

## Reporting a vulnerability

Please **do not** open a public issue. Use GitHub's
[private vulnerability reporting](https://github.com/harithiduwara/SecretSanta/security/advisories/new).
We acknowledge reports within 3 business days and aim to ship a fix for high-severity issues within 14 days.

## Security model

- No backend; all data is stored in the organizer's browser `localStorage`.
- Reveal links contain AES-256-GCM ciphertext in the URL fragment (not sent to servers). Optional per-person access
  codes derive the key with PBKDF2-SHA-256 (210k iterations).
- Draws and codes use `crypto.getRandomValues` with rejection sampling (no modulo bias).
- CSV exports neutralise spreadsheet formula injection; imports are size-limited and validated.
- Out of scope: attacks requiring access to the organizer's unlocked device or browser profile.
