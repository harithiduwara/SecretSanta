import { clsx } from 'clsx';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { useUi } from '../store/ui';

export function Toaster() {
  const { toasts, dismiss } = useUi();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2"
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={clsx(
            'pointer-events-auto flex animate-fade-up items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm shadow-lg backdrop-blur',
            'border-slate-200 bg-white/95 dark:border-slate-700 dark:bg-slate-900/95',
          )}
        >
          {t.tone === 'success' && <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" />}
          {t.tone === 'error' && <XCircle size={18} className="mt-0.5 shrink-0 text-red-500" />}
          {t.tone === 'info' && <Info size={18} className="mt-0.5 shrink-0 text-sky-500" />}
          <span>{t.message}</span>
        </button>
      ))}
    </div>
  );
}
