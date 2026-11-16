import { KeyRound, Lock, LockOpen, ShieldCheck, Trash2, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import type { ID } from '../../lib/types';
import { MIN_PASSWORD_LENGTH, passwordProblem, VaultError } from '../../lib/vault';
import { relativeTime } from '../../lib/format';
import { useEvents } from '../../store/events';
import { toast } from '../../store/ui';
import { Button, Card, Field, Input, Modal } from '../ui';

const errorText = (e: unknown) =>
  e instanceof VaultError ? e.message : 'Something went wrong. Please try again.';

function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  autoFocus,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: 'new-password' | 'current-password';
  autoFocus?: boolean;
}) {
  return (
    <Input
      id={id}
      type="password"
      value={value}
      autoComplete={autoComplete}
      autoFocus={autoFocus}
      maxLength={256}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** Turn on password protection for an exchange. */
export function ProtectModal({ id, open, onClose }: { id: ID; open: boolean; onClose: () => void }) {
  const protectEvent = useEvents((s) => s.protectEvent);
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [ack, setAck] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = passwordProblem(pw, confirm);
    if (problem) return setError(problem);
    if (!ack) return setError('Please confirm you have stored the password somewhere safe.');
    setBusy(true);
    try {
      await protectEvent(id, pw);
      toast('Password protection is on');
      setPw('');
      setConfirm('');
      setAck(false);
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Protect with a password"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="protect-form" disabled={busy} icon={<Lock size={15} />}>
            {busy ? 'Encrypting…' : 'Turn on protection'}
          </Button>
        </>
      }
    >
      <form id="protect-form" onSubmit={submit} className="space-y-4" noValidate>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          This exchange will be stored encrypted. To open it you'll need its ID{' '}
          <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">{id}</code> and this password.
          It locks again when you close the tab or after 15 minutes without activity.
        </p>
        <Field
          label="Password"
          hint={`At least ${MIN_PASSWORD_LENGTH} characters. A short sentence works well.`}
        >
          {(fid) => (
            <PasswordInput id={fid} value={pw} onChange={setPw} autoComplete="new-password" autoFocus />
          )}
        </Field>
        <Field label="Confirm password" error={error}>
          {(fid) => (
            <PasswordInput id={fid} value={confirm} onChange={setConfirm} autoComplete="new-password" />
          )}
        </Field>
        <label className="flex items-start gap-2.5 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
          />
          <span>
            I've stored this password safely. <strong>It can't be recovered</strong>: without it, this
            exchange can't be opened by anyone.
          </span>
        </label>
      </form>
    </Modal>
  );
}

export function ChangePasswordModal({ id, open, onClose }: { id: ID; open: boolean; onClose: () => void }) {
  const changePassword = useEvents((s) => s.changePassword);
  const [current, setCurrent] = useState('');
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = passwordProblem(pw, confirm);
    if (problem) return setError(problem);
    setBusy(true);
    try {
      await changePassword(id, current, pw);
      toast('Password changed');
      setCurrent('');
      setPw('');
      setConfirm('');
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change password"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="change-pw-form" disabled={busy || !current}>
            {busy ? 'Re-encrypting…' : 'Change password'}
          </Button>
        </>
      }
    >
      <form id="change-pw-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Current password">
          {(fid) => (
            <PasswordInput
              id={fid}
              value={current}
              onChange={setCurrent}
              autoComplete="current-password"
              autoFocus
            />
          )}
        </Field>
        <Field label="New password" hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}>
          {(fid) => <PasswordInput id={fid} value={pw} onChange={setPw} autoComplete="new-password" />}
        </Field>
        <Field label="Confirm new password" error={error}>
          {(fid) => (
            <PasswordInput id={fid} value={confirm} onChange={setConfirm} autoComplete="new-password" />
          )}
        </Field>
        <p className="text-xs text-slate-500">Backups exported earlier still open with the old password.</p>
      </form>
    </Modal>
  );
}

export function RemoveProtectionModal({ id, open, onClose }: { id: ID; open: boolean; onClose: () => void }) {
  const removeProtection = useEvents((s) => s.removeProtection);
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await removeProtection(id, pw);
      toast('Password protection is off', 'info');
      setPw('');
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Turn off password protection"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="remove-pw-form" variant="danger" disabled={busy || !pw}>
            {busy ? 'Checking…' : 'Turn off protection'}
          </Button>
        </>
      }
    >
      <form id="remove-pw-form" onSubmit={submit} className="space-y-4" noValidate>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          The exchange will be stored unencrypted in this browser, and anyone using it can open it.
        </p>
        <Field label="Password" error={error}>
          {(fid) => (
            <PasswordInput id={fid} value={pw} onChange={setPw} autoComplete="current-password" autoFocus />
          )}
        </Field>
      </form>
    </Modal>
  );
}

/** Status card on the exchange overview. */
export function ProtectionCard({ id }: { id: ID }) {
  const vault = useEvents((s) => s.vaults[id]);
  const lockEvent = useEvents((s) => s.lockEvent);
  const navigate = useNavigate();
  const [modal, setModal] = useState<'protect' | 'change' | 'remove' | null>(null);

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center gap-2">
        {vault ? (
          <ShieldCheck size={18} className="text-pine-600" />
        ) : (
          <LockOpen size={18} className="text-slate-400" />
        )}
        <h2 className="font-semibold">{vault ? 'Password protected' : 'Not password protected'}</h2>
      </div>
      <p className="text-sm text-slate-500">
        {vault
          ? `Stored encrypted. Last saved ${relativeTime(vault.updatedAt)}. Anyone opening it needs the ID and password.`
          : 'Anyone using this browser can open this exchange.'}
      </p>
      <div className="text-xs text-slate-500">
        Exchange ID <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">{id}</code>
      </div>
      <div className="flex flex-wrap gap-2">
        {vault ? (
          <>
            <Button
              size="sm"
              icon={<Lock size={14} />}
              onClick={async () => {
                await lockEvent(id);
                toast('Exchange locked', 'info');
                navigate('/');
              }}
            >
              Lock now
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={<KeyRound size={14} />}
              onClick={() => setModal('change')}
            >
              Change password
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setModal('remove')}>
              Turn off
            </Button>
          </>
        ) : (
          <Button size="sm" icon={<Lock size={14} />} onClick={() => setModal('protect')}>
            Protect with a password
          </Button>
        )}
      </div>
      <ProtectModal id={id} open={modal === 'protect'} onClose={() => setModal(null)} />
      <ChangePasswordModal id={id} open={modal === 'change'} onClose={() => setModal(null)} />
      <RemoveProtectionModal id={id} open={modal === 'remove'} onClose={() => setModal(null)} />
    </Card>
  );
}

/** Shown in place of a locked exchange. */
export function UnlockScreen({ id }: { id: ID }) {
  const unlockEvent = useEvents((s) => s.unlockEvent);
  const deleteEvent = useEvents((s) => s.deleteEvent);
  const navigate = useNavigate();
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (confirmDelete) setConfirmDelete(false);
      else navigate('/');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirmDelete, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pw) return setError('Enter the password.');
    setBusy(true);
    setError(undefined);
    try {
      await unlockEvent(id, pw);
      setPw('');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md py-6">
      <Card className="relative p-8">
        <button
          type="button"
          onClick={() => navigate('/')}
          aria-label="Close and go back to all exchanges"
          title="Back to all exchanges (Esc)"
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <X size={18} />
        </button>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-100 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
          <Lock size={24} />
        </div>
        <h1 className="mt-4 text-center text-xl font-bold">This exchange is locked</h1>
        <p className="mt-1 text-center text-sm text-slate-500">
          Exchange ID <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">{id}</code>
        </p>
        <form onSubmit={submit} className="mt-6 space-y-3" noValidate>
          <input type="text" name="username" value={id} autoComplete="username" readOnly hidden />
          <Field label="Password" error={error}>
            {(fid) => (
              <PasswordInput id={fid} value={pw} onChange={setPw} autoComplete="current-password" autoFocus />
            )}
          </Field>
          <Button type="submit" className="w-full" disabled={busy} icon={<LockOpen size={16} />}>
            {busy ? 'Unlocking…' : 'Unlock'}
          </Button>
        </form>
        <div className="mt-6 border-t border-slate-200 pt-4 text-center dark:border-slate-800">
          {confirmDelete ? (
            <div className="space-y-2">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Delete this exchange from this browser? This can't be undone.
              </p>
              <div className="flex justify-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => setConfirmDelete(false)}>
                  Keep it
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  icon={<Trash2 size={14} />}
                  onClick={() => {
                    deleteEvent(id);
                    toast('Exchange deleted', 'info');
                    navigate('/');
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ) : (
            <button
              className="text-xs text-slate-500 underline-offset-2 hover:underline"
              onClick={() => setConfirmDelete(true)}
            >
              Forgot the password? Delete this exchange
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}
