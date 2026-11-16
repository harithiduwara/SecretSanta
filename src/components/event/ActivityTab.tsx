import { History } from 'lucide-react';
import type { SantaEvent } from '../../lib/types';
import { relativeTime } from '../../lib/format';
import { Card, EmptyState } from '../ui';

export function ActivityTab({ event }: { event: SantaEvent }) {
  return (
    <Card>
      <div className="border-b border-slate-200 p-5 dark:border-slate-800">
        <h2 className="font-semibold">Audit log</h2>
        <p className="mt-1 text-sm text-slate-500">
          Every change to this exchange, newest first. Pairings are never logged.
        </p>
      </div>
      {event.audit.length === 0 ? (
        <EmptyState icon={<History size={24} />} title="No activity yet" body="Changes will appear here." />
      ) : (
        <ol className="relative space-y-0 p-5">
          {event.audit.map((a, i) => (
            <li key={a.id} className="relative flex gap-4 pb-5 last:pb-0">
              {i < event.audit.length - 1 && (
                <span className="absolute left-[5px] top-4 h-full w-px bg-slate-200 dark:bg-slate-800" />
              )}
              <span className="relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-brand-500 bg-white dark:bg-slate-900" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{a.action}</span>
                  <time
                    className="text-xs text-slate-500"
                    dateTime={a.at}
                    title={new Date(a.at).toLocaleString()}
                  >
                    {relativeTime(a.at)}
                  </time>
                </div>
                {a.detail && <p className="truncate text-sm text-slate-500">{a.detail}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
