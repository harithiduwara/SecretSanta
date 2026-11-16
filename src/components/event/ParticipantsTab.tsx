import { FileUp, Pencil, Search, Trash2, UserPlus, Users } from 'lucide-react';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import type { Participant, SantaEvent } from '../../lib/types';
import { importParticipants, isEmail } from '../../lib/csv';
import { useEvents } from '../../store/events';
import { toast } from '../../store/ui';
import { Avatar, Badge, Button, Card, EmptyState, Field, Input, Modal, Textarea } from '../ui';

const empty = { name: '', email: '', department: '', wishlist: '' };

function ParticipantForm({
  initial = empty,
  onSubmit,
  submitLabel,
  compact,
}: {
  initial?: typeof empty;
  onSubmit: (v: typeof empty) => boolean | void;
  submitLabel: string;
  compact?: boolean;
}) {
  const [v, setV] = useState(initial);
  const [err, setErr] = useState<string>();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!v.name.trim()) return setErr('Name is required.');
    if (v.email.trim() && !isEmail(v.email.trim())) return setErr('Please enter a valid email.');
    setErr(undefined);
    if (onSubmit(v) !== false && compact) setV(empty);
  };
  return (
    <form
      onSubmit={submit}
      className={compact ? 'grid gap-3 sm:grid-cols-[1fr_1fr_0.8fr_auto] sm:items-end' : 'space-y-4'}
    >
      <Field label="Name" error={err}>
        {(id) => (
          <Input
            id={id}
            value={v.name}
            maxLength={80}
            onChange={(e) => setV({ ...v, name: e.target.value })}
            placeholder="Jane Doe"
          />
        )}
      </Field>
      <Field label="Email">
        {(id) => (
          <Input
            id={id}
            type="email"
            value={v.email}
            maxLength={120}
            onChange={(e) => setV({ ...v, email: e.target.value })}
            placeholder="jane@company.com"
          />
        )}
      </Field>
      <Field label="Department / household">
        {(id) => (
          <Input
            id={id}
            value={v.department}
            maxLength={60}
            onChange={(e) => setV({ ...v, department: e.target.value })}
            placeholder="Engineering"
          />
        )}
      </Field>
      {!compact && (
        <Field label="Wishlist" hint="Shared with whoever draws this person.">
          {(id) => (
            <Textarea
              id={id}
              value={v.wishlist}
              maxLength={500}
              onChange={(e) => setV({ ...v, wishlist: e.target.value })}
            />
          )}
        </Field>
      )}
      <Button
        type="submit"
        icon={compact ? <UserPlus size={16} /> : undefined}
        className={compact ? '' : 'w-full'}
      >
        {submitLabel}
      </Button>
    </form>
  );
}

function ImportModal({ open, onClose, event }: { open: boolean; onClose: () => void; event: SantaEvent }) {
  const [text, setText] = useState('');
  const addParticipants = useEvents((s) => s.addParticipants);
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (text.trim() ? importParticipants(text) : null), [text]);

  const onFile = async (f?: File) => {
    if (!f) return;
    if (f.size > 2_000_000) return toast('File is too large (max 2 MB).', 'error');
    setText(await f.text());
  };

  const commit = () => {
    if (!preview?.people.length) return;
    const { added, skipped } = addParticipants(event.id, preview.people);
    toast(
      `Imported ${added} participant${added === 1 ? '' : 's'}${skipped ? ` · ${skipped} duplicates skipped` : ''}`,
    );
    setText('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bulk import participants"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={commit} disabled={!preview?.people.length}>
            Import {preview?.people.length || ''}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Paste CSV or upload a file exported from your HR system or spreadsheet. Supported columns:{' '}
        <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">name, email, department, wishlist</code>
        . Comma, semicolon and tab delimiters are detected automatically.
      </p>
      <div className="mt-4 space-y-3">
        <Textarea
          aria-label="CSV data"
          className="min-h-[160px] font-mono text-xs"
          placeholder={
            'name,email,department\nJane Doe,jane@acme.com,Engineering\nJohn Roe,john@acme.com,Sales'
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt,text/csv"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <Button
            variant="secondary"
            size="sm"
            icon={<FileUp size={14} />}
            onClick={() => fileRef.current?.click()}
          >
            Upload file
          </Button>
          {preview && (
            <span className="text-sm text-slate-500">
              {preview.people.length} valid row{preview.people.length === 1 ? '' : 's'}
              {preview.errors.length > 0 && ` · ${preview.errors.length} skipped`}
            </span>
          )}
        </div>
        {preview && preview.errors.length > 0 && (
          <ul className="max-h-24 overflow-auto rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            {preview.errors.slice(0, 20).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        {preview && preview.people.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800/50">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Department</th>
                </tr>
              </thead>
              <tbody>
                {preview.people.slice(0, 6).map((p, i) => (
                  <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-1.5">{p.name}</td>
                    <td className="px-3 py-1.5">{p.email}</td>
                    <td className="px-3 py-1.5">{p.department}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.people.length > 6 && (
              <p className="px-3 py-2 text-xs text-slate-500">…and {preview.people.length - 6} more</p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

export function ParticipantsTab({ event }: { event: SantaEvent }) {
  const { addParticipants, updateParticipant, removeParticipant } = useEvents();
  const [q, setQ] = useState('');
  const [importing, setImporting] = useState(false);
  const [editing, setEditing] = useState<Participant | null>(null);
  const locked = event.status === 'archived';

  const list = event.participants.filter((p) =>
    [p.name, p.email, p.department ?? ''].some((f) => f.toLowerCase().includes(q.trim().toLowerCase())),
  );

  const confirmIfDrawn = () =>
    event.status !== 'drawn' ||
    window.confirm('Names have already been drawn. Changing the roster will reset the draw. Continue?');

  return (
    <div className="space-y-6">
      {!locked && (
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Add participant</h2>
            <Button
              variant="secondary"
              size="sm"
              icon={<FileUp size={14} />}
              onClick={() => setImporting(true)}
            >
              Bulk import CSV
            </Button>
          </div>
          <ParticipantForm
            compact
            submitLabel="Add"
            onSubmit={(v) => {
              if (!confirmIfDrawn()) return false;
              const { added } = addParticipants(event.id, [v]);
              if (!added) {
                toast('That person is already in this exchange.', 'error');
                return false;
              }
              toast(`${v.name.trim()} added`);
            }}
          />
        </Card>
      )}

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <h2 className="font-semibold">
            Roster{' '}
            <span className="ml-1 text-sm font-normal text-slate-500">({event.participants.length})</span>
          </h2>
          <div className="relative sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              aria-label="Search participants"
              className="h-9 pl-9"
              placeholder="Search…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        {event.participants.length === 0 ? (
          <EmptyState
            icon={<Users size={24} />}
            title="No participants yet"
            body="Add people one by one or bulk-import a CSV from your directory."
          />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {list.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={p.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{p.name}</span>
                    {p.department && <Badge>{p.department}</Badge>}
                  </div>
                  <div className="truncate text-sm text-slate-500">{p.email || 'No email'}</div>
                  {p.wishlist && (
                    <div className="mt-0.5 truncate text-xs text-slate-400">🎁 {p.wishlist}</div>
                  )}
                </div>
                {!locked && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Edit ${p.name}`}
                      icon={<Pencil size={14} />}
                      onClick={() => setEditing(p)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${p.name}`}
                      className="hover:text-red-600"
                      icon={<Trash2 size={14} />}
                      onClick={() => {
                        if (!confirmIfDrawn()) return;
                        removeParticipant(event.id, p.id);
                        toast(`${p.name} removed`, 'info');
                      }}
                    />
                  </div>
                )}
              </li>
            ))}
            {list.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-slate-500">No participants match “{q}”.</li>
            )}
          </ul>
        )}
      </Card>

      <ImportModal open={importing} onClose={() => setImporting(false)} event={event} />
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit participant">
        {editing && (
          <ParticipantForm
            submitLabel="Save changes"
            initial={{
              name: editing.name,
              email: editing.email,
              department: editing.department ?? '',
              wishlist: editing.wishlist ?? '',
            }}
            onSubmit={(v) => {
              const deptChanged =
                v.department.trim().toLowerCase() !== (editing.department ?? '').trim().toLowerCase();
              if (deptChanged && event.rules.avoidSameDepartment && !confirmIfDrawn()) return false;
              const saved = updateParticipant(event.id, editing.id, {
                name: v.name.trim(),
                email: v.email.trim(),
                department: v.department.trim() || undefined,
                wishlist: v.wishlist.trim() || undefined,
              });
              if (!saved) {
                toast('Another participant already uses that email.', 'error');
                return false;
              }
              setEditing(null);
              toast('Participant updated');
            }}
          />
        )}
      </Modal>
    </div>
  );
}
