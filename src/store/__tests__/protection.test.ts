import { beforeEach, describe, expect, it, vi } from 'vitest';

const realSetItem = Storage.prototype.setItem;
import { exportSnapshot, flushSeal, parseBackup, STORAGE_KEY, useEvents } from '../events';

const s = () => useEvents.getState();
const stored = () => localStorage.getItem(STORAGE_KEY) ?? '';
const PW = 'mistletoe-2026';

async function protectedExchange() {
  const id = s().createEvent({ name: 'Board secret santa' });
  s().addParticipants(id, [
    { name: 'Alice Smith', email: 'alice@corp.test' },
    { name: 'Bob Jones', email: 'bob@corp.test' },
    { name: 'Cara Lee', email: 'cara@corp.test' },
  ]);
  s().runDraw(id);
  await s().protectEvent(id, PW);
  return id;
}

describe('password-protected exchanges', () => {
  beforeEach(() => {
    s().clearAll();
    localStorage.clear();
  });

  it('never writes a protected exchange to storage in readable form', async () => {
    const id = await protectedExchange();
    // Still open in this tab…
    expect(s().events.find((e) => e.id === id)?.name).toBe('Board secret santa');
    // …but storage only holds ciphertext.
    for (const secret of ['Board secret santa', 'Alice Smith', 'alice@corp.test'])
      expect(stored()).not.toContain(secret);
    expect(JSON.parse(stored()).state.vaults[id]).toBeDefined();
  });

  it('keeps edits encrypted too', async () => {
    const id = await protectedExchange();
    s().addParticipants(id, [{ name: 'Dan Brown', email: 'dan@corp.test' }]);
    await flushSeal(id);
    expect(stored()).not.toContain('Dan Brown');
    await s().lockEvent(id);
    await s().unlockEvent(id, PW);
    expect(
      s()
        .events.find((e) => e.id === id)
        ?.participants.map((p) => p.name),
    ).toContain('Dan Brown');
  });

  it('locks, refuses a wrong password, and unlocks with the right one', async () => {
    const id = await protectedExchange();
    await s().lockEvent(id);
    expect(s().events.find((e) => e.id === id)).toBeUndefined();
    await expect(s().unlockEvent(id, 'not the password')).rejects.toThrow('not correct');
    await s().unlockEvent(id, PW);
    const e = s().events.find((x) => x.id === id)!;
    expect(e.assignments).toHaveLength(3);
    expect(e.audit.some((a) => a.action === 'Password protection turned on')).toBe(true);
  });

  it('is locked after a reload (keys are never persisted)', async () => {
    const id = await protectedExchange();
    expect(stored()).not.toContain('"keys"');
    // Simulate a page reload: fresh in-memory state, then load what was saved.
    const saved = stored();
    useEvents.setState({ events: [], vaults: {}, keys: {} });
    localStorage.setItem(STORAGE_KEY, saved);
    await useEvents.persist.rehydrate();
    expect(s().vaults[id]).toBeDefined();
    expect(s().events.find((e) => e.id === id)).toBeUndefined();
  });

  it('changes the password', async () => {
    const id = await protectedExchange();
    await expect(s().changePassword(id, 'wrong-password', 'new-password-1')).rejects.toThrow('not correct');
    await expect(s().changePassword(id, PW, 'short')).rejects.toThrow('at least 8');
    await s().changePassword(id, PW, 'new-password-1');
    await s().lockEvent(id);
    await expect(s().unlockEvent(id, PW)).rejects.toThrow('not correct');
    await s().unlockEvent(id, 'new-password-1');
  });

  it('turns protection off only with the right password', async () => {
    const id = await protectedExchange();
    await expect(s().removeProtection(id, 'wrong-password')).rejects.toThrow('not correct');
    await s().removeProtection(id, PW);
    expect(s().vaults[id]).toBeUndefined();
    expect(stored()).toContain('Board secret santa');
  });

  it('exports protected exchanges encrypted and imports them locked', async () => {
    const id = await protectedExchange();
    const plain = s().createEvent({ name: 'Open exchange' });
    const backup = JSON.stringify(await exportSnapshot());
    expect(backup).not.toContain('Board secret santa');
    expect(backup).toContain('Open exchange');
    s().clearAll();
    const parsed = parseBackup(backup);
    expect(s().importEvents(parsed.events, parsed.vaults)).toBe(2);
    expect(s().events.map((e) => e.id)).toEqual([plain]);
    await s().unlockEvent(id, PW);
    expect(s().events.find((e) => e.id === id)?.name).toBe('Board secret santa');
  });

  it('protects the next round with the same password', async () => {
    const id = await protectedExchange();
    const next = (await s().nextRound(id))!;
    expect(s().vaults[next]).toBeDefined();
    await s().lockAll();
    expect(s().events).toHaveLength(0);
    await s().unlockEvent(next, PW);
    expect(s().events.find((e) => e.id === next)?.history).toHaveLength(1);
  });

  it('deleting a locked exchange removes its encrypted data', async () => {
    const id = await protectedExchange();
    await s().lockEvent(id);
    s().deleteEvent(id);
    expect(s().vaults[id]).toBeUndefined();
    expect(JSON.parse(stored()).state.vaults[id]).toBeUndefined();
  });

  it('rejects weak passwords when turning protection on', async () => {
    const id = s().createEvent();
    await expect(s().protectEvent(id, 'short')).rejects.toThrow('at least 8');
    expect(s().vaults[id]).toBeUndefined();
  });

  it('never leaves an exchange missing from storage while turning protection on', async () => {
    const id = s().createEvent({ name: 'Atomic' });
    const writes: string[] = [];
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k, v) {
      if (k === STORAGE_KEY) writes.push(v);
      realSetItem.call(this, k, v);
    });
    await s().protectEvent(id, 'atomic-password');
    spy.mockRestore();
    expect(writes.length).toBeGreaterThan(0);
    // Every single write contains the exchange: either readable (before) or encrypted (after), never neither.
    for (const w of writes) expect(w.includes('Atomic') || !!JSON.parse(w).state.vaults[id]).toBe(true);
    expect(stored()).not.toContain('Atomic');
  });
});
