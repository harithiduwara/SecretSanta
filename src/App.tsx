import { lazy, Suspense } from 'react';
import { HashRouter, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';

const EventPage = lazy(() => import('./pages/EventPage'));
const Reveal = lazy(() => import('./pages/Reveal'));
const Settings = lazy(() => import('./pages/Settings'));
const NotFound = lazy(() => import('./pages/NotFound'));

export function AppRoutes() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-sm text-slate-500">Loading…</div>}>
      <Routes>
        <Route path="/reveal/:token" element={<Reveal />} />
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="/events/:id" element={<EventPage />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

// HashRouter keeps deep links working on static hosting (GitHub Pages) and keeps reveal tokens client-side.
export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </ErrorBoundary>
  );
}
