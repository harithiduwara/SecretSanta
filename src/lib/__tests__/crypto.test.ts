import { describe, expect, it } from 'vitest';
import { fromB64Url, openPayload, revealUrl, sealPayload, toB64Url, tokenNeedsCode } from '../crypto';
import type { RevealPayload } from '../types';

const payload: RevealPayload = {
  v: 1,
  event: 'Party 🎄',
  date: '2026-12-19',
  budget: 30,
  currency: 'EUR',
  giver: 'Ava',
  receiver: 'Liam',
  wishlist: 'Hot sauce',
};

describe('reveal crypto', () => {
  it('round-trips base64url', () => {
    const bytes = new Uint8Array([0, 1, 250, 251, 252, 253, 254, 255]);
    expect(fromB64Url(toB64Url(bytes))).toEqual(bytes);
    expect(() => fromB64Url('not base64!')).toThrow();
  });

  it('seals and opens without access code', async () => {
    const token = await sealPayload(payload);
    expect(tokenNeedsCode(token)).toBe(false);
    expect(token).not.toContain('Liam');
    await expect(openPayload(token)).resolves.toEqual(payload);
  });

  it('requires the right access code', async () => {
    const token = await sealPayload(payload, 'ABC234');
    expect(tokenNeedsCode(token)).toBe(true);
    await expect(openPayload(token)).rejects.toThrow('access code is required');
    await expect(openPayload(token, 'WRONG1')).rejects.toThrow('not correct');
    await expect(openPayload(token, ' abc234 ')).resolves.toEqual(payload);
  });

  it('rejects tampered or malformed tokens', async () => {
    const token = await sealPayload(payload);
    const parts = token.split('.');
    const ct = fromB64Url(parts[3]!);
    ct[0] = ct[0]! ^ 0xff;
    parts[3] = toB64Url(ct);
    await expect(openPayload(parts.join('.'))).rejects.toThrow('corrupted');
    await expect(openPayload('garbage')).rejects.toThrow('malformed');
    await expect(openPayload('k.!!.a.b')).rejects.toThrow('malformed');
  });

  it('builds hash URLs', () => {
    expect(revealUrl('k.a.b.c', 'https://x.github.io/SecretSanta/')).toBe(
      'https://x.github.io/SecretSanta/#/reveal/k.a.b.c',
    );
  });
});
