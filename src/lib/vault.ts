import type { ID, SantaEvent } from './types';
import { fromB64Url, toB64Url } from './crypto';

/**
 * Password protection for an exchange, encrypted at rest.
 *
 * The exchange is serialised to JSON and encrypted with AES-256-GCM. The key is derived from the
 * organizer's password with PBKDF2-SHA-256 and never stored: it lives in memory only while the
 * exchange is unlocked. Without the password the stored data is unreadable, including to other
 * pages on the same origin, browser extensions reading storage, or anyone holding a backup file.
 * There is no recovery: a forgotten password means the exchange cannot be opened.
 */
export interface Vault {
  id: ID;
  v: 1;
  kdf: 'PBKDF2-SHA-256';
  iterations: number;
  /** base64url salt for PBKDF2 */
  salt: string;
  /** base64url AES-GCM nonce, fresh for every save */
  iv: string;
  /** base64url ciphertext of the exchange JSON */
  ct: string;
  createdAt: string;
  updatedAt: string;
}

/** OWASP (2023) recommendation for PBKDF2-HMAC-SHA-256. */
export const VAULT_ITERATIONS = 600_000;
export const MIN_PASSWORD_LENGTH = 8;

export class VaultError extends Error {}

const enc = new TextEncoder();
const dec = new TextDecoder();

export function newSalt(): string {
  return toB64Url(crypto.getRandomValues(new Uint8Array(16)));
}

export async function deriveVaultKey(
  password: string,
  salt: string,
  iterations = VAULT_ITERATIONS,
): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromB64Url(salt), iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable: the raw key can't be read back out of memory by page scripts
    ['encrypt', 'decrypt'],
  );
}

/** The exchange id is bound as additional data, so a vault can't be swapped onto another id. */
const aad = (id: ID) => enc.encode(`secretsanta-vault:${id}`);

export async function sealVault(
  event: SantaEvent,
  key: CryptoKey,
  meta: { salt: string; iterations: number; createdAt?: string },
): Promise<Vault> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: aad(event.id) },
      key,
      enc.encode(JSON.stringify(event)),
    ),
  );
  const t = new Date().toISOString();
  return {
    id: event.id,
    v: 1,
    kdf: 'PBKDF2-SHA-256',
    iterations: meta.iterations,
    salt: meta.salt,
    iv: toB64Url(iv),
    ct: toB64Url(ct),
    createdAt: meta.createdAt ?? t,
    updatedAt: t,
  };
}

export async function openVault(vault: Vault, key: CryptoKey): Promise<SantaEvent> {
  let pt: ArrayBuffer;
  try {
    pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64Url(vault.iv), additionalData: aad(vault.id) },
      key,
      fromB64Url(vault.ct),
    );
  } catch {
    throw new VaultError('That password is not correct.');
  }
  const event = JSON.parse(dec.decode(pt)) as SantaEvent;
  if (event.id !== vault.id) throw new VaultError('This exchange data is corrupted.');
  return event;
}

/** Derives the key from a password and opens the vault; throws VaultError on a wrong password. */
export async function unlockVault(
  vault: Vault,
  password: string,
): Promise<{ event: SantaEvent; key: CryptoKey }> {
  const key = await deriveVaultKey(password, vault.salt, vault.iterations);
  return { event: await openVault(vault, key), key };
}

export function passwordProblem(password: string, confirm?: string): string | undefined {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.trim() !== password) return "The password can't start or end with a space.";
  if (confirm !== undefined && password !== confirm) return "The passwords don't match.";
  return undefined;
}

/** Structural check for vaults read from storage or backup files. */
export function isVault(v: unknown): v is Vault {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    o.v === 1 &&
    o.kdf === 'PBKDF2-SHA-256' &&
    typeof o.id === 'string' &&
    typeof o.salt === 'string' &&
    typeof o.iv === 'string' &&
    typeof o.ct === 'string' &&
    typeof o.iterations === 'number' &&
    o.iterations >= 100_000 &&
    o.iterations <= 10_000_000
  );
}
