import { useEffect } from 'react';
import { useEvents } from '../store/events';
import { toast } from '../store/ui';

export const AUTO_LOCK_MS = 15 * 60 * 1000;

/** Locks every unlocked protected exchange after a period without user activity. */
export function useAutoLock(timeoutMs = AUTO_LOCK_MS) {
  const anyUnlocked = useEvents((s) => Object.keys(s.keys).length > 0);
  useEffect(() => {
    if (!anyUnlocked) return;
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        await useEvents.getState().lockAll();
        toast('Protected exchanges were locked after 15 minutes without activity', 'info');
      }, timeoutMs);
    };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, arm, { passive: true }));
    arm();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, arm));
    };
  }, [anyUnlocked, timeoutMs]);
}
