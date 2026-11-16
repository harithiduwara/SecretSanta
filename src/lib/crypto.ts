import type { RevealPayload } from './types';

/**
 * Reveal links are fully self-contained: the encrypted assignment lives in the URL *fragment*,
 * which browsers never send to any server (including GitHub Pages).
 *
 * Format:  k.<key>.<iv>.<ciphertext>        – key embedded (convenience mode)
 *          p.<salt>.<iv>.<ciphertext>       – key derived from the participant's access code (PBKDF2)
 */
const enc = new TextEncoder();
const dec = new TextDecoder();
const PBKDF2_ITERATIONS = 210_000;

export function toB64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64Url(s: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error('Invalid encoding');
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const random = (n: number): Uint8Array<ArrayBuffer> => crypto.getRandomValues(new Uint8Array(n));

async function deriveKey(code: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(code.trim().toUpperCase()), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function sealPayload(payload: RevealPayload, accessCode?: string): Promise<string> {
  const iv = random(12);
  const data = enc.encode(JSON.stringify(payload));
  if (accessCode) {
    const salt = random(16);
    const key = await deriveKey(accessCode, salt);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
    return ['p', toB64Url(salt), toB64Url(iv), toB64Url(ct)].join('.');
  }
  const raw = random(32);
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
  return ['k', toB64Url(raw), toB64Url(iv), toB64Url(ct)].join('.');
}

export function tokenNeedsCode(token: string): boolean {
  return token.startsWith('p.');
}

export class RevealError extends Error {}

export async function openPayload(token: string, accessCode?: string): Promise<RevealPayload> {
  const parts = token.split('.');
  if (parts.length !== 4 || (parts[0] !== 'k' && parts[0] !== 'p'))
    throw new RevealError('This link is malformed.');
  let iv: Uint8Array<ArrayBuffer>, ct: Uint8Array<ArrayBuffer>, material: Uint8Array<ArrayBuffer>;
  try {
    material = fromB64Url(parts[1]!);
    iv = fromB64Url(parts[2]!);
    ct = fromB64Url(parts[3]!);
  } catch {
    throw new RevealError('This link is malformed.');
  }
  let key: CryptoKey;
  if (parts[0] === 'p') {
    if (!accessCode) throw new RevealError('An access code is required.');
    key = await deriveKey(accessCode, material);
  } else {
    key = await crypto.subtle.importKey('raw', material, 'AES-GCM', false, ['decrypt']);
  }
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    const obj = JSON.parse(dec.decode(pt)) as RevealPayload;
    if (obj.v !== 1) throw new Error('version');
    return obj;
  } catch {
    throw new RevealError(parts[0] === 'p' ? 'That access code is not correct.' : 'This link is corrupted.');
  }
}

export function revealUrl(token: string, origin = window.location.origin + window.location.pathname): string {
  return `${origin.replace(/#.*$/, '')}#/reveal/${token}`;
}
