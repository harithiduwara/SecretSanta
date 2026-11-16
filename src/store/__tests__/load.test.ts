import { describe, expect, it, vi } from 'vitest';

// Regression: restoring saved data runs synchronously while the store module is first loaded. A real page
// load always starts with data in storage, so test exactly that rather than an already-running store.
describe('loading saved data on startup', () => {
  it('restores plain exchanges and locked exchanges from storage', async () => {
    const { STORAGE_KEY, newEvent, useEvents: first } = await import('../events');
    const plain = newEvent({ name: 'Saved plain exchange' });
    first.getState().clearAll();
    first.setState({ events: [plain] });
    await first.getState().protectEvent(plain.id, 'startup-password'); // becomes a locked vault on reload
    const other = newEvent({ name: 'Second plain exchange' });
    first.setState((s) => ({ events: [...s.events, other] }));
    const saved = localStorage.getItem(STORAGE_KEY)!;

    vi.resetModules();
    localStorage.setItem(STORAGE_KEY, saved);
    const { useEvents } = await import('../events');
    const s = useEvents.getState();
    expect(s.events.map((e) => e.name)).toEqual(['Second plain exchange']);
    expect(Object.keys(s.vaults)).toEqual([plain.id]);
    expect(s.keys).toEqual({});
    await s.unlockEvent(plain.id, 'startup-password');
    expect(useEvents.getState().events.find((e) => e.id === plain.id)?.name).toBe('Saved plain exchange');
  });
});
