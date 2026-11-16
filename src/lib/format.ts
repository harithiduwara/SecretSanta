export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(
      amount,
    );
  } catch {
    return `${amount} ${currency}`;
  }
}

export function formatDate(iso: string): string {
  if (!iso) return 'No date set';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function daysUntil(iso: string, now = new Date()): number | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

/** Today's date as yyyy-mm-dd in the user's local timezone (what a date input shows). */
export function todayIso(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** True when `iso` is a valid date strictly before today (local time). Empty or invalid dates are not "past". */
export function isPastDate(iso: string, now = new Date()): boolean {
  const d = daysUntil(iso, now);
  return d !== null && d < 0;
}

/** Next occurrence of a month/day that is today or later, as yyyy-mm-dd. */
export function nextOccurrence(month: number, day: number, now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const thisYear = `${now.getFullYear()}-${pad(month)}-${pad(day)}`;
  return isPastDate(thisYear, now) ? `${now.getFullYear() + 1}-${pad(month)}-${pad(day)}` : thisYear;
}

export function relativeTime(iso: string, now = Date.now()): string {
  const diff = (new Date(iso).getTime() - now) / 1000;
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['day', 86_400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [u, s] of units) if (Math.abs(diff) >= s) return rtf.format(Math.round(diff / s), u);
  return 'just now';
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

export const CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'INR',
  'LKR',
  'AUD',
  'CAD',
  'JPY',
  'SGD',
  'AED',
  'CHF',
  'SEK',
];
