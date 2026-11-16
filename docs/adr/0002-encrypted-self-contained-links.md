# ADR-0002: Encrypted, self-contained reveal links

- **Status:** Accepted
- **Date:** 2026-11-16

## Context

Without a backend, each participant's assignment must be delivered in the link itself. Plain-text links would leak
pairings to anyone glancing at the URL, to mail-scanner logs, or to the organizer.

## Decision

Encrypt the payload with AES-256-GCM (Web Crypto) and place it in the URL fragment.

- **Open mode:** a random 256-bit key travels with the link — protects against casual inspection and server logs.
- **Access-code mode:** the key is derived from a per-person 6-character code via PBKDF2-SHA-256 (210,000
  iterations, random salt). Codes are distributed through a separate channel, so a forwarded or intercepted link
  alone reveals nothing.

## Consequences

- ✅ Tamper-evident (GCM tag), never transmitted to the server, no storage required.
- ⚠️ Links are long (~300–600 chars). Acceptable for email/chat.
- ⚠️ 6-char codes (~30 bits) resist casual guessing, not a determined offline attacker; this matches the threat model
  (a gift surprise, not regulated data).
