import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
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
