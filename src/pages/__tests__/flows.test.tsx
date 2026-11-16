import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../App';
import { useEvents } from '../../store/events';
import { sealPayload } from '../../lib/crypto';

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );

describe('organizer flow', () => {
  beforeEach(() => useEvents.getState().clearAll());

  it('creates an exchange from the dashboard', async () => {
    const user = userEvent.setup();
    renderAt('/');
    expect(await screen.findByText('No exchanges yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /new exchange/i }));
    const name = screen.getByLabelText('Exchange name');
    await user.clear(name);
    await user.type(name, 'Acme Holiday Party');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Create exchange' }));
    expect(await screen.findByRole('heading', { name: 'Acme Holiday Party' })).toBeInTheDocument();
    expect(useEvents.getState().events).toHaveLength(1);
  });

  it('adds participants and draws names', async () => {
    const user = userEvent.setup();
    const id = useEvents.getState().createEvent({ name: 'Flow' });
    renderAt(`/events/${id}?tab=participants`);
    for (const n of ['Alice', 'Bob', 'Carol']) {
      await user.type(await screen.findByLabelText('Name'), n);
      await user.click(screen.getByRole('button', { name: 'Add' }));
    }
    expect(useEvents.getState().events[0]!.participants).toHaveLength(3);
    expect(screen.getByText('(3)')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /draw & distribute/i }));
    await user.click(await screen.findByRole('button', { name: /draw names/i }));
    expect(await screen.findByText('Names drawn', {}, { timeout: 3000 })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole('button', { name: /copy link/i })[0]).toBeEnabled());
  });

  it('loads the demo team', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.click(await screen.findByRole('button', { name: /load demo team/i }));
    expect(await screen.findByText(/8 participants/)).toBeInTheDocument();
  });
});

describe('reveal page', () => {
  const payload = {
    v: 1 as const,
    event: 'Party',
    date: '2026-12-19',
    budget: 20,
    currency: 'USD',
    giver: 'Ava',
    receiver: 'Liam',
    wishlist: 'Socks',
  };

  it('reveals an open link after tapping the gift', async () => {
    const user = userEvent.setup();
    renderAt(`/reveal/${await sealPayload(payload)}`);
    await user.click(await screen.findByRole('button', { name: /open your gift/i }));
    expect(screen.getByText('Liam')).toBeInTheDocument();
    expect(screen.getByText('Socks')).toBeInTheDocument();
  });

  it('requires an access code for protected links', async () => {
    const user = userEvent.setup();
    renderAt(`/reveal/${await sealPayload(payload, 'XYZ234')}`);
    await user.type(await screen.findByLabelText('Access code'), 'WRONG2');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    expect(await screen.findByText(/not correct/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Access code'));
    await user.type(screen.getByLabelText('Access code'), 'xyz234');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    expect(
      await screen.findByRole('button', { name: /open your gift/i }, { timeout: 5000 }),
    ).toBeInTheDocument();
  });

  it('shows an error for malformed links', async () => {
    renderAt('/reveal/nonsense');
    expect(await screen.findByText(/malformed/)).toBeInTheDocument();
  });
});

describe('link protection', () => {
  beforeEach(() => useEvents.getState().clearAll());

  it('never exposes old unprotected links after access codes are enabled', async () => {
    const user = userEvent.setup();
    const { act } = await import('@testing-library/react');
    const store = useEvents.getState();
    const id = store.createEvent({ name: 'Secure' });
    store.addParticipants(
      id,
      ['A', 'B', 'C'].map((name) => ({ name, email: '' })),
    );
    store.runDraw(id);
    renderAt(`/events/${id}?tab=draw`);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(await screen.findByRole('button', { name: /show pairings/i }));
    await waitFor(() =>
      expect(screen.getAllByRole('link', { name: /preview/i })[0]).toHaveAttribute(
        'href',
        expect.stringContaining('#/reveal/k.'),
      ),
    );
    act(() => useEvents.getState().setRules(id, { pinProtectedLinks: true }));
    // Immediately after the change no stale (unprotected) link may be reachable.
    for (const a of screen.queryAllByRole('link', { name: /preview/i }))
      expect(a.getAttribute('href')).not.toContain('#/reveal/k.');
    await waitFor(
      () =>
        expect(screen.getAllByRole('link', { name: /preview/i })[0]).toHaveAttribute(
          'href',
          expect.stringContaining('#/reveal/p.'),
        ),
      { timeout: 5000 },
    );
    expect(screen.getByRole('button', { name: /export links/i })).toBeEnabled();
    confirm.mockRestore();
  });
});

describe('password protection flow', () => {
  beforeEach(() => {
    useEvents.getState().clearAll();
    localStorage.clear();
  });

  it('protects, locks, hides details on the dashboard, and unlocks with ID + password', async () => {
    const user = userEvent.setup();
    const id = useEvents.getState().createEvent({ name: 'Leadership exchange' });
    renderAt(`/events/${id}`);

    await user.click(await screen.findByRole('button', { name: /protect with a password/i }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Password'), 'sleigh-bells-ring');
    await user.type(within(dialog).getByLabelText('Confirm password'), 'sleigh-bells-ring');
    await user.click(within(dialog).getByRole('button', { name: /turn on protection/i }));
    expect(await within(dialog).findByText(/confirm you have stored/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('checkbox'));
    await user.click(within(dialog).getByRole('button', { name: /turn on protection/i }));
    expect(await screen.findByText('Password protected', {}, { timeout: 5000 })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Lock now' }));
    // Dashboard: the locked exchange shows only its ID.
    expect(await screen.findByText('Locked exchange')).toBeInTheDocument();
    expect(screen.getByText(id)).toBeInTheDocument();
    expect(screen.queryByText('Leadership exchange')).not.toBeInTheDocument();

    await user.click(screen.getByText('Locked exchange'));
    expect(await screen.findByText('This exchange is locked')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    expect(
      await screen.findByText('That password is not correct.', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Password'));
    await user.type(screen.getByLabelText('Password'), 'sleigh-bells-ring');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    expect(
      await screen.findByRole('heading', { name: 'Leadership exchange' }, { timeout: 5000 }),
    ).toBeInTheDocument();
  }, 20000);

  it('keeps an exchange unlocked when another tab saves', async () => {
    const store = useEvents.getState();
    const id = store.createEvent({ name: 'Tab test' });
    await store.protectEvent(id, 'tab-password-1');
    window.dispatchEvent(new StorageEvent('storage', { key: 'secretsanta:v1' }));
    await new Promise((r) => setTimeout(r, 50));
    expect(useEvents.getState().events.find((e) => e.id === id)?.name).toBe('Tab test');
  });
});

describe('WhatsApp delivery', () => {
  beforeEach(() => useEvents.getState().clearAll());

  it('adds a local number using the exchange country code and offers a WhatsApp link', async () => {
    const user = userEvent.setup();
    const store = useEvents.getState();
    const id = store.createEvent({ name: 'WA test', phoneCountryCode: '94' });
    store.addParticipants(id, [
      { name: 'Bob', email: '' },
      { name: 'Cara', email: '' },
    ]);
    renderAt(`/events/${id}?tab=participants`);
    await user.type(await screen.findByLabelText('Name'), 'Ava Perera');
    await user.type(screen.getByLabelText('WhatsApp number'), '077 123 4567');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    const ava = useEvents.getState().events[0]!.participants.find((p) => p.name === 'Ava Perera')!;
    expect(ava.phone).toBe('+94771234567');
    expect(screen.getByText('+94771234567')).toBeInTheDocument();

    useEvents.getState().runDraw(id);
    await user.click(screen.getByRole('tab', { name: /draw & distribute/i }));
    const wa = await screen.findByRole('link', { name: /send ava perera their link on whatsapp/i });
    await waitFor(() =>
      expect(wa).toHaveAttribute('href', expect.stringContaining('https://wa.me/94771234567?text=')),
    );
    const text = new URL(wa.getAttribute('href')!).searchParams.get('text')!;
    expect(text).toContain('Hi Ava,');
    expect(text).toMatch(/#\/reveal\/k\./);
    // Only people with a number get a WhatsApp button.
    expect(screen.getAllByRole('link', { name: /on whatsapp/i })).toHaveLength(1);
    await user.click(wa);
    expect(useEvents.getState().events[0]!.notified[ava.id]).toBeTruthy();
  });

  it('shows a clear error for a local number when no country code is set', async () => {
    const user = userEvent.setup();
    const id = useEvents.getState().createEvent({ name: 'No CC' });
    renderAt(`/events/${id}?tab=participants`);
    await user.type(await screen.findByLabelText('Name'), 'Ava');
    await user.type(screen.getByLabelText('WhatsApp number'), '077 123 4567');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText(/Add the country code/)).toBeInTheDocument();
    expect(useEvents.getState().events[0]!.participants).toHaveLength(0);
  });
});

describe('locked exchange screen', () => {
  beforeEach(() => useEvents.getState().clearAll());

  it('has a close button and Esc that return to the dashboard', async () => {
    const user = userEvent.setup();
    const store = useEvents.getState();
    const id = store.createEvent({ name: 'Closable' });
    await store.protectEvent(id, 'close-me-please');
    await store.lockEvent(id);

    renderAt(`/events/${id}`);
    expect(await screen.findByText('This exchange is locked')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /close and go back/i }));
    expect(await screen.findByText('Gift exchanges')).toBeInTheDocument();
    cleanup();

    renderAt(`/events/${id}`);
    expect(await screen.findByText('This exchange is locked')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(await screen.findByText('Gift exchanges')).toBeInTheDocument();
  });
});
