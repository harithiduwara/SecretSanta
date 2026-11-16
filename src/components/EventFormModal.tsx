import { useState, type FormEvent } from 'react';
import type { SantaEvent } from '../lib/types';
import { CURRENCIES } from '../lib/format';
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
  const [error, setError] = useState<string>();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!v.name.trim()) return setError('Please give your exchange a name.');
    if (!(v.budget >= 0)) return setError('Budget must be zero or more.');
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
      <form id="event-form" onSubmit={submit} className="space-y-4">
        <Field label="Exchange name" error={error}>
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
          <Field label="Exchange date">
            {(id) => (
              <Input
                id={id}
                type="date"
                value={v.date}
                onChange={(e) => setV({ ...v, date: e.target.value })}
              />
            )}
          </Field>
          <Field label="Budget">
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
