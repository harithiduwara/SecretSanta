import {
  CheckCircle2,
  Copy,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  Mail,
  RotateCcw,
  Shuffle,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import type { ID, SantaEvent } from '../../lib/types';
import { diagnose } from '../../lib/draw';
import { revealUrl, sealPayload } from '../../lib/crypto';
import { toCsv } from '../../lib/csv';
import { formatDate, formatMoney } from '../../lib/format';
import { useEvents } from '../../store/events';
import { toast } from '../../store/ui';
import { Avatar, Badge, Button, Card } from '../ui';
import { download } from '../../lib/download';

/** Generates (and caches per draw) the encrypted reveal link for every giver. */
function useRevealLinks(event: SantaEvent) {
  const [links, setLinks] = useState<Record<ID, string>>({});
  const [progress, setProgress] = useState(0);
  const { assignments, participants, rules, drawnAt } = event;
  useEffect(() => {
    let cancelled = false;
    // Drop stale links immediately: e.g. after enabling access codes, old unprotected links must not be
    // copyable or exportable while the new ones are being encrypted.
    setLinks({});
    setProgress(0);
    if (!assignments.length) return;
    let done = 0;
    const byId = new Map(participants.map((p) => [p.id, p]));
    Promise.all(
      assignments.map(async (a) => {
        const g = byId.get(a.giverId);
        const r = byId.get(a.receiverId);
        if (!g || !r) return [a.giverId, ''] as const;
        const token = await sealPayload(
          {
            v: 1,
            event: event.name,
            date: event.date,
            budget: event.budget,
            currency: event.currency,
            giver: g.name,
            receiver: r.name,
            wishlist: r.wishlist,
            message: event.description || undefined,
          },
          rules.pinProtectedLinks ? g.accessCode : undefined,
        );
        if (!cancelled && ++done % 25 === 0) setProgress(done);
        return [a.giverId, revealUrl(token)] as const;
      }),
    ).then((entries) => {
      if (cancelled) return;
      setLinks(Object.fromEntries(entries));
      setProgress(entries.length);
    });
    return () => {
      cancelled = true;
    };
    // Regenerate only when the draw, link protection or shared details change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    drawnAt,
    rules.pinProtectedLinks,
    event.name,
    event.date,
    event.budget,
    event.currency,
    event.description,
    participants,
  ]);
  return { links, progress };
}

export function DrawTab({ event }: { event: SantaEvent }) {
  const { runDraw, resetDraw, setNotified } = useEvents();
  const [drawing, setDrawing] = useState(false);
  const [showPairs, setShowPairs] = useState(false);
  const { links, progress } = useRevealLinks(event);
  const issues = diagnose(event);
  const byId = new Map(event.participants.map((p) => [p.id, p]));
  const locked = event.status === 'archived';
  const sent = Object.keys(event.notified).length;
  const linksReady = event.assignments.every((a) => links[a.giverId]);

  const doDraw = async () => {
    setDrawing(true);
    await new Promise((r) => setTimeout(r, 900)); // let the animation breathe
    const res = runDraw(event.id);
    setDrawing(false);
    setShowPairs(false);
    if (res.ok) toast('Names drawn! Distribute the private links below. 🎉');
    else toast(res.reason, 'error');
  };

  const copy = async (pid: ID) => {
    const link = links[pid];
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast('Link copied to clipboard');
    } catch {
      window.prompt('Copy this link:', link);
    }
  };

  const mailto = (pid: ID) => {
    const p = byId.get(pid);
    const link = links[pid];
    if (!p || !link) return '#';
    const subject = `Your Secret Santa match for ${event.name} 🎁`;
    const body = [
      `Hi ${p.name.split(' ')[0]},`,
      '',
      `The names for ${event.name} have been drawn! Open your private link to find out who you're gifting:`,
      '',
      link,
      '',
      event.rules.pinProtectedLinks ? 'You will receive your personal access code separately.' : '',
      `Budget: ${formatMoney(event.budget, event.currency)}${event.date ? ` · Exchange: ${formatDate(event.date)}` : ''}`,
      '',
      'Please keep it a secret! 🤫',
    ]
      .filter((l, i, a) => l !== '' || a[i - 1] !== '')
      .join('\n');
    return `mailto:${encodeURIComponent(p.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      [
        'Name',
        'Email',
        'Department',
        ...(event.rules.pinProtectedLinks ? ['Access code'] : []),
        'Reveal link',
      ],
      ...event.assignments.map((a) => {
        const p = byId.get(a.giverId)!;
        return [
          p.name,
          p.email,
          p.department ?? '',
          ...(event.rules.pinProtectedLinks ? [p.accessCode] : []),
          links[a.giverId] ?? '',
        ];
      }),
    ];
    download(`${event.name.replace(/[^\w-]+/g, '_')}_links.csv`, toCsv(rows), 'text/csv');
    toast('Distribution list exported');
  };

  if (!event.assignments.length) {
    return (
      <Card className="relative overflow-hidden p-8 text-center sm:p-12">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-500/5 via-transparent to-pine-500/10" />
        <div className="relative mx-auto max-w-md">
          <div
            className={clsx(
              'mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-xl shadow-brand-600/30',
              drawing && 'animate-spin',
            )}
          >
            <Shuffle size={34} />
          </div>
          <h2 className="mt-6 text-2xl font-bold tracking-tight">
            {drawing ? 'Drawing names…' : 'Ready when you are'}
          </h2>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            {event.participants.length} participants · {event.exclusions.length} exclusions ·{' '}
            {event.rules.mode === 'single-loop' ? 'single gift chain' : 'random matching'}. The draw uses a
            cryptographically secure RNG and is verified against every rule before being saved.
          </p>
          {issues.length > 0 && (
            <ul className="mt-4 rounded-xl bg-amber-50 p-3 text-left text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
              {issues.map((i) => (
                <li key={i}>• {i}</li>
              ))}
            </ul>
          )}
          <Button
            size="lg"
            className="mt-6"
            icon={<Sparkles size={18} />}
            disabled={drawing || issues.length > 0 || locked}
            onClick={doDraw}
          >
            Draw names
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <h2 className="font-semibold">Names drawn</h2>
            <p className="text-sm text-slate-500">
              {sent} of {event.assignments.length} links delivered
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={14} />}
            onClick={exportCsv}
            disabled={!linksReady}
          >
            {linksReady ? 'Export links' : `Encrypting ${progress}/${event.assignments.length}…`}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={showPairs ? <EyeOff size={14} /> : <Eye size={14} />}
            onClick={() => {
              if (
                !showPairs &&
                !window.confirm(
                  'Reveal all pairings? As organizer you may want to keep the surprise for yourself too.',
                )
              )
                return;
              setShowPairs(!showPairs);
            }}
          >
            {showPairs ? 'Hide pairings' : 'Show pairings'}
          </Button>
          {!locked && (
            <>
              <Button
                variant="secondary"
                size="sm"
                icon={<Shuffle size={14} />}
                onClick={() =>
                  window.confirm('Re-draw? All previously shared links become outdated.') && doDraw()
                }
              >
                Re-draw
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<RotateCcw size={14} />}
                onClick={() =>
                  window.confirm('Reset the draw? Shared links become outdated.') && resetDraw(event.id)
                }
              >
                Reset
              </Button>
            </>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="hidden grid-cols-[1.4fr_1fr_auto] gap-4 border-b border-slate-200 bg-slate-50/80 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid dark:border-slate-800 dark:bg-slate-800/40">
          <span>Giver</span>
          <span>{showPairs ? 'Gives to' : 'Status'}</span>
          <span className="text-right">Distribute</span>
        </div>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {event.assignments.map((a) => {
            const g = byId.get(a.giverId);
            const r = byId.get(a.receiverId);
            if (!g || !r) return null;
            const done = !!event.notified[g.id];
            return (
              <li
                key={g.id}
                className="grid gap-3 px-5 py-3.5 md:grid-cols-[1.4fr_1fr_auto] md:items-center md:gap-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={g.name} />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{g.name}</div>
                    <div className="flex items-center gap-2 truncate text-xs text-slate-500">
                      {g.email || 'No email'}
                      {event.rules.pinProtectedLinks && (
                        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          <KeyRound size={11} /> {g.accessCode}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  {showPairs ? (
                    <span className="inline-flex items-center gap-2 text-sm font-medium">
                      <Avatar name={r.name} size={24} /> {r.name}
                    </span>
                  ) : done ? (
                    <Badge tone="pine">Delivered</Badge>
                  ) : (
                    <Badge tone="amber">Pending</Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Copy size={13} />}
                    disabled={!links[g.id]}
                    onClick={() => copy(g.id)}
                  >
                    Copy link
                  </Button>
                  {g.email && (
                    <a
                      href={mailto(g.id)}
                      onClick={() => setNotified(event.id, g.id, true)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                    >
                      <Mail size={13} /> Email
                    </a>
                  )}
                  {showPairs && links[g.id] && (
                    <a
                      href={links[g.id]}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Preview ${g.name}'s reveal page`}
                      className="grid h-8 w-8 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                  <label className="ml-1 inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-pine-600"
                      checked={done}
                      onChange={(e) => setNotified(event.id, g.id, e.target.checked)}
                    />
                    Sent
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
