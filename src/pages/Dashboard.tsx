import { CalendarDays, CheckCircle2, Gift, Plus, Search, Sparkles, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { clsx } from 'clsx';
import { useEvents } from '../store/events';
import type { EventStatus, SantaEvent } from '../lib/types';
import { daysUntil, formatDate, formatMoney } from '../lib/format';
import { DEMO_PEOPLE } from '../lib/demo';
import { Badge, Button, Card, EmptyState, Input, Stat } from '../components/ui';
import { EventFormModal } from '../components/EventFormModal';
import { toast } from '../store/ui';

const filters: { value: EventStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Active' },
  { value: 'draft', label: 'Drafts' },
  { value: 'drawn', label: 'Drawn' },
  { value: 'archived', label: 'Archived' },
];

export function StatusBadge({ status }: { status: EventStatus }) {
  if (status === 'drawn') return <Badge tone="pine">Drawn</Badge>;
  if (status === 'archived') return <Badge>Archived</Badge>;
  return <Badge tone="amber">Draft</Badge>;
}

function EventCard({ e }: { e: SantaEvent }) {
  const days = daysUntil(e.date);
  const sent = Object.keys(e.notified).length;
  const pct = e.participants.length ? Math.round((sent / e.participants.length) * 100) : 0;
  return (
    <Link to={`/events/${e.id}`} className="group block animate-fade-up">
      <Card className="h-full p-5 transition group-hover:-translate-y-0.5 group-hover:border-brand-300 group-hover:shadow-lg dark:group-hover:border-brand-800">
        <div className="flex items-start justify-between gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
            <Gift size={20} />
          </div>
          <StatusBadge status={e.status} />
        </div>
        <h3 className="mt-4 line-clamp-1 font-semibold tracking-tight">{e.name}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1">
            <CalendarDays size={14} />
            {formatDate(e.date)}
          </span>
          <span>{formatMoney(e.budget, e.currency)}</span>
        </div>
        <div className="mt-5 flex items-center justify-between text-sm">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Users size={15} className="text-slate-400" />
            {e.participants.length} participants
          </span>
          {days !== null && days >= 0 && e.status !== 'archived' && (
            <span className="text-xs font-semibold text-brand-600">
              {days === 0 ? 'Today!' : `in ${days} days`}
            </span>
          )}
        </div>
        {e.status === 'drawn' && (
          <div className="mt-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-full rounded-full bg-pine-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              {sent}/{e.participants.length} links delivered
            </p>
          </div>
        )}
      </Card>
    </Link>
  );
}

export default function Dashboard() {
  const events = useEvents((s) => s.events);
  const createEvent = useEvents((s) => s.createEvent);
  const addParticipants = useEvents((s) => s.addParticipants);
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<EventStatus | 'all'>('all');
  const [q, setQ] = useState('');

  const visible = useMemo(
    () =>
      events.filter(
        (e) =>
          (filter === 'all' ? e.status !== 'archived' : e.status === filter) &&
          e.name.toLowerCase().includes(q.trim().toLowerCase()),
      ),
    [events, filter, q],
  );

  const active = events.filter((e) => e.status !== 'archived');
  const people = new Set(active.flatMap((e) => e.participants.map((p) => p.email || p.name))).size;
  const upcoming = active
    .map((e) => daysUntil(e.date))
    .filter((d): d is number => d !== null && d >= 0)
    .sort((a, b) => a - b)[0];

  const loadDemo = () => {
    const id = createEvent({
      name: `Team Holiday Exchange ${new Date().getFullYear()}`,
      date: `${new Date().getFullYear()}-12-19`,
      budget: 30,
      description: 'Gifts will be exchanged at the end-of-year party. Keep it fun and thoughtful! 🎄',
    });
    addParticipants(id, DEMO_PEOPLE);
    toast('Demo exchange created');
    navigate(`/events/${id}`);
  };

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
            <Sparkles size={13} /> Season's greetings
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Gift exchanges</h1>
          <p className="mt-2 max-w-xl text-slate-600 dark:text-slate-400">
            Run fair, constraint-aware Secret Santa draws for teams of any size and deliver private, encrypted
            reveal links.
          </p>
        </div>
        <Button size="lg" icon={<Plus size={18} />} onClick={() => setCreating(true)}>
          New exchange
        </Button>
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Active exchanges" value={active.length} icon={<Gift size={18} />} />
        <Stat label="Unique participants" value={people} icon={<Users size={18} />} />
        <Stat
          label="Draws completed"
          value={events.filter((e) => e.assignments.length).length}
          icon={<CheckCircle2 size={18} />}
        />
        <Stat
          label="Next exchange"
          value={upcoming === undefined ? '—' : upcoming === 0 ? 'Today' : `${upcoming}d`}
          icon={<CalendarDays size={18} />}
        />
      </section>

      {events.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Gift size={26} />}
            title="No exchanges yet"
            body="Create your first Secret Santa exchange, or explore with a pre-filled demo team."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
                  Create exchange
                </Button>
                <Button variant="secondary" onClick={loadDemo}>
                  Load demo team
                </Button>
              </div>
            }
          />
        </Card>
      ) : (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-900" role="tablist">
              {filters.map((f) => (
                <button
                  key={f.value}
                  role="tab"
                  aria-selected={filter === f.value}
                  onClick={() => setFilter(f.value)}
                  className={clsx(
                    'rounded-lg px-3 py-1.5 text-sm font-medium transition',
                    filter === f.value
                      ? 'bg-white shadow-sm dark:bg-slate-800'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="relative sm:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                aria-label="Search exchanges"
                placeholder="Search exchanges…"
                className="pl-9"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
          {visible.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((e) => (
                <EventCard key={e.id} e={e} />
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState
                icon={<Search size={24} />}
                title="No matches"
                body="Try a different filter or search term."
              />
            </Card>
          )}
        </section>
      )}

      <EventFormModal
        open={creating}
        onClose={() => setCreating(false)}
        title="New gift exchange"
        submitLabel="Create exchange"
        onSubmit={(v) => {
          const id = createEvent(v);
          setCreating(false);
          toast('Exchange created');
          navigate(`/events/${id}`);
        }}
      />
    </div>
  );
}
