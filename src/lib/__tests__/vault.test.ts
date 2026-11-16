import { describe, expect, it } from 'vitest';
import {
  deriveVaultKey,
  isVault,
  newSalt,
  openVault,
  passwordProblem,
  sealVault,
  unlockVault,
} from '../vault';
import { newEvent } from '../../store/events';

// Fewer iterations keep the suite fast; the production count is covered by the store tests.
const FAST = 100_000;

describe('vault', () => {
  const event = newEvent({
    name: 'Secret party',
    participants: [{ id: 'p1', name: 'Ava', email: 'ava@x.co', accessCode: 'ABC234' }],
  });

  it('round-trips an exchange and hides its contents', async () => {
    const salt = newSalt();
    const key = await deriveVaultKey('correct horse battery', salt, FAST);
    const vault = await sealVault(event, key, { salt, iterations: FAST });
    expect(isVault(vault)).toBe(true);
    const raw = JSON.stringify(vault);
    for (const secret of ['Secret party', 'Ava', 'ava@x.co', 'ABC234']) expect(raw).not.toContain(secret);
    expect(await openVault(vault, key)).toEqual(event);
    const { event: opened } = await unlockVault(vault, 'correct horse battery');
    expect(opened).toEqual(event);
  });

  it('rejects a wrong password', async () => {
    const salt = newSalt();
    const vault = await sealVault(event, await deriveVaultKey('right password', salt, FAST), {
      salt,
      iterations: FAST,
    });
    await expect(unlockVault(vault, 'wrong password')).rejects.toThrow('That password is not correct.');
  });

  it('uses a fresh nonce for every save and a fresh salt per password', async () => {
    const salt = newSalt();
    const key = await deriveVaultKey('pw-123456', salt, FAST);
    const a = await sealVault(event, key, { salt, iterations: FAST });
    const b = await sealVault(event, key, { salt, iterations: FAST });
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
    expect(newSalt()).not.toBe(newSalt());
  });

  it('detects tampering and refuses a vault moved onto another exchange id', async () => {
    const salt = newSalt();
    const key = await deriveVaultKey('pw-123456', salt, FAST);
    const vault = await sealVault(event, key, { salt, iterations: FAST });
    const flipped = vault.ct.startsWith('A') ? 'B' + vault.ct.slice(1) : 'A' + vault.ct.slice(1);
    await expect(openVault({ ...vault, ct: flipped }, key)).rejects.toThrow();
    await expect(openVault({ ...vault, id: 'evt_other' }, key)).rejects.toThrow();
  });

  it('validates passwords and vault shapes', () => {
    expect(passwordProblem('short')).toMatch(/at least 8/);
    expect(passwordProblem(' padded password ')).toMatch(/space/);
    expect(passwordProblem('long enough', 'different')).toMatch(/match/);
    expect(passwordProblem('long enough', 'long enough')).toBeUndefined();
    expect(isVault(null)).toBe(false);
    expect(
      isVault({ v: 1, kdf: 'PBKDF2-SHA-256', id: 'x', salt: 's', iv: 'i', ct: 'c', iterations: 10 }),
    ).toBe(false);
  });
});
