import { CalendarDays, Gift, KeyRound, Lock, Wallet } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router';
import { clsx } from 'clsx';
import { openPayload, RevealError, tokenNeedsCode } from '../lib/crypto';
import type { RevealPayload } from '../lib/types';
import { formatDate, formatMoney } from '../lib/format';
import { Button, Card, Input } from '../components/ui';
import { useApplyTheme } from '../hooks/useApplyTheme';

type State =
  | { kind: 'loading' }
  | { kind: 'locked'; error?: string }
  | { kind: 'ready'; data: RevealPayload }
  | { kind: 'error'; message: string };

const SNOW = Array.from({ length: 28 }, (_, i) => i);

export default function Reveal() {
  useApplyTheme();
  const { token = '' } = useParams();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [code, setCode] = useState('');
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = 'Your Secret Santa match';
    if (tokenNeedsCode(token)) return setState({ kind: 'locked' });
    openPayload(token)
      .then((data) => setState({ kind: 'ready', data }))
      .catch((e: unknown) =>
        setState({ kind: 'error', message: e instanceof RevealError ? e.message : 'Unable to open link.' }),
      );
  }, [token]);

  const unlock = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await openPayload(token, code);
      setState({ kind: 'ready', data });
    } catch (err) {
      setState({ kind: 'locked', error: err instanceof RevealError ? err.message : 'Unable to unlock.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-gradient-to-b from-rose-950 via-slate-950 to-emerald-950 px-4 py-12 text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {SNOW.map((i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white/70"
            style={{
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 100}%`,
              width: 2 + (i % 4),
              height: 2 + (i % 4),
              opacity: 0.25 + (i % 5) / 10,
            }}
          />
        ))}
      </div>
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2 text-sm font-semibold text-white/80">
          <Gift size={16} /> SecretSanta
        </div>

        {state.kind === 'loading' && (
          <Card className="p-10 text-center text-slate-500 bg-white dark:bg-slate-900">Unwrapping…</Card>
        )}

        {state.kind === 'error' && (
          <Card className="p-8 text-center text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900">
            <h1 className="text-xl font-bold">Link can't be opened</h1>
            <p className="mt-2 text-sm text-slate-500">{state.message} Ask your organizer to resend it.</p>
          </Card>
        )}

        {state.kind === 'locked' && (
          <Card className="p-8 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-100 text-brand-600 dark:bg-brand-900/40">
              <Lock size={24} />
            </div>
            <h1 className="mt-4 text-center text-xl font-bold">This gift is locked</h1>
            <p className="mt-1 text-center text-sm text-slate-500">
              Enter the personal access code your organizer sent you.
            </p>
            <form onSubmit={unlock} className="mt-6 space-y-3">
              <div className="relative">
                <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  aria-label="Access code"
                  className="pl-9 text-center font-mono text-lg uppercase tracking-[0.3em]"
                  autoComplete="one-time-code"
                  maxLength={12}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoFocus
                />
              </div>
              {state.error && <p className="text-center text-sm text-red-600">{state.error}</p>}
              <Button type="submit" className="w-full" disabled={!code.trim() || busy}>
                {busy ? 'Checking…' : 'Unlock'}
              </Button>
            </form>
          </Card>
        )}

        {state.kind === 'ready' && (
          <Card className="overflow-hidden text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900">
            <div className="bg-gradient-to-br from-brand-600 to-brand-800 px-8 pb-8 pt-7 text-center text-white">
              <p className="text-sm text-white/80">Hi {state.data.giver}, for</p>
              <h1 className="mt-1 text-lg font-bold">{state.data.event}</h1>
              <p className="mt-6 text-sm uppercase tracking-[0.2em] text-white/70">you are gifting</p>
              {opened ? (
                <div className="mt-3 animate-flip text-4xl font-extrabold tracking-tight">
                  {state.data.receiver}
                </div>
              ) : (
                <button
                  onClick={() => setOpened(true)}
                  className="group mx-auto mt-4 grid h-28 w-28 place-items-center rounded-3xl bg-white/15 ring-1 ring-white/30 transition hover:scale-105 hover:bg-white/25"
                  aria-label="Open your gift"
                >
                  <Gift size={52} className="transition group-hover:-rotate-6" />
                </button>
              )}
              {!opened && <p className="mt-3 text-xs text-white/70">Tap the gift to reveal</p>}
            </div>
            <div className={clsx('space-y-4 p-6 transition-opacity', opened ? 'opacity-100' : 'opacity-40')}>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Wallet size={13} /> Budget
                  </div>
                  <div className="mt-0.5 font-semibold">
                    {formatMoney(state.data.budget, state.data.currency)}
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <CalendarDays size={13} /> Exchange
                  </div>
                  <div className="mt-0.5 font-semibold">{formatDate(state.data.date)}</div>
                </div>
              </div>
              {opened && (
                <div className="rounded-xl border border-dashed border-slate-300 p-4 dark:border-slate-700">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Their wishlist
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">
                    {state.data.wishlist || 'No wishlist provided — surprise them! ✨'}
                  </p>
                </div>
              )}
              {state.data.message && (
                <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-400">
                  {state.data.message}
                </p>
              )}
              <p className="text-center text-xs text-slate-400">
                🤫 Keep it secret. This page was decrypted on your device only.
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
