import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CalendarDays,
  Check,
  Download,
  Gift,
  History,
  ListChecks,
  Pencil,
  Repeat,
  Shield,
  Shuffle,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { clsx } from 'clsx';
import { useEvent, useEvents } from '../store/events';
import type { SantaEvent } from '../lib/types';
import { daysUntil, formatDate, formatMoney } from '../lib/format';
import { download } from '../lib/download';
import { toast } from '../store/ui';
import { Button, Card, EmptyState } from '../components/ui';
import { EventFormModal } from '../components/EventFormModal';
import { ParticipantsTab } from '../components/event/ParticipantsTab';
import { RulesTab } from '../components/event/RulesTab';
import { DrawTab } from '../components/event/DrawTab';
import { ActivityTab } from '../components/event/ActivityTab';
import { StatusBadge } from './Dashboard';

const tabs = [
  { id: 'overview', label: 'Overview', icon: ListChecks },
  { id: 'participants', label: 'Participants', icon: Users },
  { id: 'rules', label: 'Rules', icon: Shield },
  { id: 'draw', label: 'Draw & distribute', icon: Shuffle },
  { id: 'activity', label: 'Activity', icon: History },
] as const;
type TabId = (typeof tabs)[number]['id'];

function Step({
  done,
  title,
  body,
  action,
}: {
  done: boolean;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <li className="flex items-start gap-4 py-4">
      <span
        className={clsx(
          'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-xs font-bold',
          done
            ? 'border-pine-500 bg-pine-500 text-white'
            : 'border-slate-300 text-slate-400 dark:border-slate-700',
        )}
      >
        {done ? <Check size={14} strokeWidth={3} /> : null}
      </span>
      <div className="flex-1">
        <div className={clsx('font-medium', done && 'text-slate-500 line-through decoration-slate-300')}>
          {title}
        </div>
        <div className="text-sm text-slate-500">{body}</div>
      </div>
      {action}
    </li>
  );
}

function Overview({ event, go }: { event: SantaEvent; go: (t: TabId) => void }) {
  const sent = Object.keys(event.notified).length;
  const n = event.participants.length;
  const days = daysUntil(event.date);
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="p-5 lg:col-span-2">
        <h2 className="font-semibold">Launch checklist</h2>
        <ol className="divide-y divide-slate-100 dark:divide-slate-800">
          <Step
            done={n >= 3}
            title="Invite at least 3 participants"
            body={`${n} added so far.`}
            action={
              <Button size="sm" variant="secondary" onClick={() => go('participants')}>
                Manage
              </Button>
            }
          />
          <Step
            done={event.exclusions.length > 0 || event.rules.avoidSameDepartment || event.status !== 'draft'}
            title="Review rules & exclusions"
            body="Keep couples apart, avoid repeats from last year, choose a draw mode."
            action={
              <Button size="sm" variant="secondary" onClick={() => go('rules')}>
                Configure
              </Button>
            }
          />
          <Step
            done={event.assignments.length > 0}
            title="Draw names"
            body="Secure, verified, and reproducibly fair."
            action={
              <Button size="sm" variant="secondary" onClick={() => go('draw')}>
                Open
              </Button>
            }
          />
          <Step
            done={n > 0 && sent === n && event.assignments.length > 0}
            title="Deliver private reveal links"
            body={event.assignments.length ? `${sent}/${n} delivered.` : 'Available after the draw.'}
          />
        </ol>
      </Card>
      <div className="space-y-4">
        <Card className="space-y-4 p-5">
          <div className="flex items-center gap-3">
            <CalendarDays size={18} className="text-slate-400" />
            <div>
              <div className="text-xs text-slate-500">Exchange date</div>
              <div className="font-medium">
                {formatDate(event.date)}
                {days !== null && days >= 0 && (
                  <span className="ml-2 text-xs text-brand-600">
                    ({days === 0 ? 'today' : `${days} days`})
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Wallet size={18} className="text-slate-400" />
            <div>
              <div className="text-xs text-slate-500">Budget per gift</div>
              <div className="font-medium">{formatMoney(event.budget, event.currency)}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Repeat size={18} className="text-slate-400" />
            <div>
              <div className="text-xs text-slate-500">Previous rounds</div>
              <div className="font-medium">{event.history.length}</div>
            </div>
          </div>
        </Card>
        {event.description && (
          <Card className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Message to participants
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm">{event.description}</p>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function EventPage() {
  const { id } = useParams();
  const event = useEvent(id);
  const { updateEvent, deleteEvent, archiveEvent, nextRound } = useEvents();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(false);
  const tab = (tabs.find((t) => t.id === params.get('tab'))?.id ?? 'overview') as TabId;
  const go = (t: TabId) => setParams({ tab: t }, { replace: true });

  if (!event)
    return (
      <Card>
        <EmptyState
          icon={<Gift size={26} />}
          title="Exchange not found"
          body="It may have been deleted, or it lives in another browser."
          action={<Button onClick={() => navigate('/')}>Back to dashboard</Button>}
        />
      </Card>
    );

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft size={15} /> All exchanges
        </Link>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="truncate text-2xl font-extrabold tracking-tight sm:text-3xl">{event.name}</h1>
              <StatusBadge status={event.status} />
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {event.participants.length} participants · {formatMoney(event.budget, event.currency)} ·{' '}
              {formatDate(event.date)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {event.status !== 'archived' && (
              <Button
                variant="secondary"
                size="sm"
                icon={<Pencil size={14} />}
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              icon={<Repeat size={14} />}
              onClick={() => {
                const nid = nextRound(event.id);
                if (nid) {
                  toast('Next round created — previous pairings will be avoided');
                  navigate(`/events/${nid}`);
                }
              }}
            >
              Start next round
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Download size={14} />}
              onClick={() =>
                download(
                  `${event.name.replace(/[^\w-]+/g, '_')}.json`,
                  JSON.stringify({ events: [event] }, null, 2),
                )
              }
            >
              Export
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={event.status === 'archived' ? <ArchiveRestore size={14} /> : <Archive size={14} />}
              onClick={() => archiveEvent(event.id, event.status !== 'archived')}
            >
              {event.status === 'archived' ? 'Restore' : 'Archive'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
              icon={<Trash2 size={14} />}
              onClick={() => {
                if (!window.confirm(`Delete “${event.name}” permanently? This cannot be undone.`)) return;
                deleteEvent(event.id);
                toast('Exchange deleted', 'info');
                navigate('/');
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div
          role="tablist"
          aria-label="Exchange sections"
          className="flex min-w-max gap-1 border-b border-slate-200 dark:border-slate-800"
        >
          {tabs.map(({ id: tid, label, icon: Icon }) => (
            <button
              key={tid}
              role="tab"
              aria-selected={tab === tid}
              onClick={() => go(tid)}
              className={clsx(
                '-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition',
                tab === tid
                  ? 'border-brand-600 text-brand-700 dark:text-brand-300'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white',
              )}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel" className="animate-fade-up" key={tab}>
        {tab === 'overview' && <Overview event={event} go={go} />}
        {tab === 'participants' && <ParticipantsTab event={event} />}
        {tab === 'rules' && <RulesTab event={event} />}
        {tab === 'draw' && <DrawTab event={event} />}
        {tab === 'activity' && <ActivityTab event={event} />}
      </div>

      <EventFormModal
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit exchange"
        submitLabel="Save changes"
        initial={event}
        onSubmit={(v) => {
          updateEvent(event.id, v);
          setEditing(false);
          toast('Exchange updated');
        }}
      />
    </div>
  );
}
