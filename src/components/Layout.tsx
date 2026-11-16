import { Gift, Monitor, Moon, Settings, Sun } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router';
import { clsx } from 'clsx';
import { useUi, type Theme } from '../store/ui';
import { useApplyTheme } from '../hooks/useApplyTheme';
import { Toaster } from './Toaster';

const themes: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: 'light', icon: Sun, label: 'Light theme' },
  { value: 'system', icon: Monitor, label: 'System theme' },
  { value: 'dark', icon: Moon, label: 'Dark theme' },
];

function ThemeSwitcher() {
  const { theme, setTheme } = useUi();
  return (
    <div className="flex rounded-xl border border-slate-200 bg-white p-0.5 dark:border-slate-800 dark:bg-slate-900">
      {themes.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          aria-label={label}
          aria-pressed={theme === value}
          onClick={() => setTheme(value)}
          className={clsx(
            'grid h-7 w-7 place-items-center rounded-lg transition',
            theme === value
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white',
          )}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}

export function Layout() {
  useApplyTheme();
  return (
    <div className="bg-festive min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/70 backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-950/70">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 font-bold tracking-tight">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md shadow-brand-600/30">
              <Gift size={18} />
            </span>
            <span className="text-lg">
              Secret<span className="text-brand-600">Santa</span>
            </span>
            <span className="hidden rounded-md bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white sm:inline dark:bg-white dark:text-slate-900">
              Enterprise
            </span>
          </Link>
          <nav className="flex items-center gap-2">
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                clsx(
                  'flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition',
                  isActive
                    ? 'bg-slate-100 dark:bg-slate-800'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                )
              }
            >
              <Settings size={15} />
              <span className="hidden sm:inline">Settings</span>
            </NavLink>
            <ThemeSwitcher />
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-7xl px-4 pb-10 text-xs text-slate-500 sm:px-6">
        All data stays in your browser. Reveal links are end-to-end encrypted in the URL fragment.
      </footer>
      <Toaster />
    </div>
  );
}
