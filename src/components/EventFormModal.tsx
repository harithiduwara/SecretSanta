import { useState, type FormEvent } from 'react';
import type { SantaEvent } from '../lib/types';
import { CURRENCIES, isPastDate, todayIso } from '../lib/format';
import { Button, Field, Input, Modal, Select, Textarea } from './ui';

export type EventFormValues = Pick<SantaEvent, 'name' | 'description' | 'date' | 'budget' | 'currency'>;

export function EventFormModal({
  open,
  onClose,
  onSubmit,
  initial,
  title,
  submitLabel,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (v: EventFormValues) => void;
  initial?: Partial<EventFormValues>;
  title: string;
  submitLabel: string;
}) {
  const [v, setV] = useState<EventFormValues>({
    name: initial?.name ?? `Holiday Gift Exchange ${new Date().getFullYear()}`,
    description: initial?.description ?? '',
    date: initial?.date ?? '',
    budget: initial?.budget ?? 25,
    currency: initial?.currency ?? 'USD',
  });
  const [errors, setErrors] = useState<{ name?: string; date?: string; budget?: string }>({});
  const today = todayIso();
  // An exchange that already took place keeps its date when other details are edited,
  // but a new or changed date can't be in the past.
  const keepsExistingPastDate = !!initial?.date && v.date === initial.date;
  const datePassed = isPastDate(v.date);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!v.name.trim()) next.name = 'Please give your exchange a name.';
    if (datePassed && !keepsExistingPastDate) next.date = 'Choose today or a later date.';
    if (!(v.budget >= 0)) next.budget = 'Budget must be zero or more.';
    setErrors(next);
    if (Object.keys(next).length) return;
    onSubmit({ ...v, name: v.name.trim(), description: v.description.trim() });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="event-form">
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id="event-form" onSubmit={submit} noValidate className="space-y-4">
        <Field label="Exchange name" error={errors.name}>
          {(id) => (
            <Input
              id={id}
              value={v.name}
              maxLength={120}
              onChange={(e) => setV({ ...v, name: e.target.value })}
              required
            />
          )}
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field
            label="Exchange date"
            error={errors.date}
            hint={datePassed && keepsExistingPastDate ? 'This date has passed.' : undefined}
          >
            {(id) => (
              <Input
                id={id}
                type="date"
                min={today}
                value={v.date}
                aria-invalid={!!errors.date}
                onChange={(e) => {
                  setV({ ...v, date: e.target.value });
                  if (errors.date) setErrors({ ...errors, date: undefined });
                }}
              />
            )}
          </Field>
          <Field label="Budget" error={errors.budget}>
            {(id) => (
              <Input
                id={id}
                type="number"
                min={0}
                step={1}
                value={Number.isNaN(v.budget) ? '' : v.budget}
                onChange={(e) => setV({ ...v, budget: e.target.valueAsNumber })}
              />
            )}
          </Field>
          <Field label="Currency">
            {(id) => (
              <Select id={id} value={v.currency} onChange={(e) => setV({ ...v, currency: e.target.value })}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field
          label="Message to participants"
          hint="Shown on every reveal page — location, theme, dress code…"
        >
          {(id) => (
            <Textarea
              id={id}
              value={v.description}
              maxLength={1000}
              onChange={(e) => setV({ ...v, description: e.target.value })}
              placeholder="Gifts will be exchanged at the end-of-year party in the main atrium. 🎄"
            />
          )}
        </Field>
      </form>
    </Modal>
  );
}
