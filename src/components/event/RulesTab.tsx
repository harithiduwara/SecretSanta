import { ArrowLeftRight, ArrowRight, Ban, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { clsx } from 'clsx';
import type { DrawMode, SantaEvent } from '../../lib/types';
import { diagnose } from '../../lib/draw';
import { useEvents } from '../../store/events';
import { toast } from '../../store/ui';
import { Button, Card, EmptyState, Field, Select, Toggle } from '../ui';

const modes: { value: DrawMode; title: string; body: string }[] = [
  {
    value: 'random',
    title: 'Random matching',
    body: 'Any valid assignment. Small sub-groups may form closed loops.',
  },
  {
    value: 'single-loop',
    title: 'Single gift chain',
    body: 'Everyone forms one big circle: A → B → C → … → A.',
  },
];

export function RulesTab({ event }: { event: SantaEvent }) {
  const { setRules, addExclusion, removeExclusion } = useEvents();
  const [giver, setGiver] = useState('');
  const [receiver, setReceiver] = useState('');
  const [mutual, setMutual] = useState(true);
  const locked = event.status === 'archived';
  const name = (id: string) => event.participants.find((p) => p.id === id)?.name ?? 'Unknown';
  const issues = diagnose({ ...event });

  const change = (patch: Parameters<typeof setRules>[1]) => {
    const onlyPin = Object.keys(patch).every((k) => k === 'pinProtectedLinks');
    if (
      event.status === 'drawn' &&
      !onlyPin &&
      !window.confirm('Changing draw rules will reset the current draw. Continue?')
    )
      return;
    setRules(event.id, patch);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <Card className="p-5">
          <h2 className="font-semibold">Draw mode</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {modes.map((m) => (
              <button
                key={m.value}
                disabled={locked}
                aria-pressed={event.rules.mode === m.value}
                onClick={() => event.rules.mode !== m.value && change({ mode: m.value })}
                className={clsx(
                  'rounded-xl border p-4 text-left transition',
                  event.rules.mode === m.value
                    ? 'border-brand-500 bg-brand-50/60 ring-4 ring-brand-500/10 dark:bg-brand-900/20'
                    : 'border-slate-200 hover:border-slate-300 dark:border-slate-700',
                )}
              >
                <div className="text-sm font-semibold">{m.title}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{m.body}</div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="divide-y divide-slate-100 px-5 py-2 dark:divide-slate-800">
          <Toggle
            label="No reciprocal pairs"
            description="Prevent two people from drawing each other."
            checked={event.rules.avoidReciprocal}
            disabled={locked}
            onChange={(v) => change({ avoidReciprocal: v })}
          />
          <Toggle
            label="Avoid same department / household"
            description="People with the same department value never draw each other."
            checked={event.rules.avoidSameDepartment}
            disabled={locked}
            onChange={(v) => change({ avoidSameDepartment: v })}
          />
          <Toggle
            label="Avoid previous pairings"
            description={`Uses ${event.history.length} previous round${event.history.length === 1 ? '' : 's'} carried over via “Start next round”.`}
            checked={event.rules.avoidPreviousPairs}
            disabled={locked}
            onChange={(v) => change({ avoidPreviousPairs: v })}
          />
          <Toggle
            label="Protect reveal links with access codes"
            description="Each person needs their personal code to open their link. Send codes through a separate channel."
            checked={event.rules.pinProtectedLinks}
            disabled={locked}
            onChange={(v) => change({ pinProtectedLinks: v })}
          />
        </Card>

        {issues.length > 0 && event.participants.length > 0 && (
          <Card className="border-amber-300 bg-amber-50/80 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            <p className="font-semibold">Heads up — the draw can't run yet</p>
            <ul className="mt-1 list-disc pl-5">
              {issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <Card>
        <div className="border-b border-slate-200 p-5 dark:border-slate-800">
          <h2 className="font-semibold">Exclusions</h2>
          <p className="mt-1 text-sm text-slate-500">
            Couples, managers & reports, or anyone who shouldn't be paired.
          </p>
          {!locked && event.participants.length >= 2 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr]">
              <Field label="Giver">
                {(id) => (
                  <Select id={id} value={giver} onChange={(e) => setGiver(e.target.value)}>
                    <option value="">Select…</option>
                    {event.participants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Should not draw">
                {(id) => (
                  <Select id={id} value={receiver} onChange={(e) => setReceiver(e.target.value)}>
                    <option value="">Select…</option>
                    {event.participants
                      .filter((p) => p.id !== giver)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </Select>
                )}
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-600"
                  checked={mutual}
                  onChange={(e) => setMutual(e.target.checked)}
                />
                Apply both ways
              </label>
              <Button
                icon={<Plus size={16} />}
                disabled={!giver || !receiver}
                onClick={() => {
                  if (
                    event.status === 'drawn' &&
                    !window.confirm('Adding an exclusion will reset the current draw. Continue?')
                  )
                    return;
                  if (addExclusion(event.id, { giverId: giver, receiverId: receiver, mutual })) {
                    toast('Exclusion added');
                    setGiver('');
                    setReceiver('');
                  } else toast('That exclusion already exists.', 'error');
                }}
              >
                Add exclusion
              </Button>
            </div>
          )}
        </div>
        {event.exclusions.length === 0 ? (
          <EmptyState
            icon={<Ban size={24} />}
            title="No exclusions"
            body="Everyone can draw anyone (except themselves)."
          />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {event.exclusions.map((x) => (
              <li key={x.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="font-medium">{name(x.giverId)}</span>
                {x.mutual ? (
                  <ArrowLeftRight size={15} className="text-brand-500" />
                ) : (
                  <ArrowRight size={15} className="text-brand-500" />
                )}
                <span className="flex-1 font-medium">{name(x.receiverId)}</span>
                {!locked && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Remove exclusion"
                    icon={<Trash2 size={14} />}
                    onClick={() => {
                      if (
                        event.status === 'drawn' &&
                        !window.confirm('Removing an exclusion will reset the current draw. Continue?')
                      )
                        return;
                      removeExclusion(event.id, x.id);
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
