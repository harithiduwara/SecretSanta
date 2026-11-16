import { describe, expect, it } from 'vitest';
import { daysUntil, formatDate, formatMoney, initials, relativeTime } from '../format';
import { accessCode, secureRandomInt, shuffle, uid } from '../random';

describe('format', () => {
  it('formats money with fallback', () => {
    expect(formatMoney(25, 'USD')).toMatch(/25/);
    expect(formatMoney(25, 'NOPE!')).toBe('25 NOPE!');
  });
  it('formats dates', () => {
    expect(formatDate('')).toBe('No date set');
    expect(formatDate('garbage')).toBe('garbage');
    expect(formatDate('2026-12-24')).toMatch(/2026/);
  });
  it('computes days until', () => {
    expect(daysUntil('2026-12-25', new Date(2026, 11, 20, 15))).toBe(5);
    expect(daysUntil('')).toBeNull();
    expect(daysUntil('x')).toBeNull();
  });
  it('relative time', () => {
    const now = Date.now();
    expect(relativeTime(new Date(now).toISOString(), now)).toBe('just now');
    expect(relativeTime(new Date(now - 3 * 3600_000).toISOString(), now)).toMatch(/3 hours ago/);
  });
  it('initials', () => expect(initials('ada  lovelace king')).toBe('AL'));
});

describe('random', () => {
  it('secureRandomInt stays in range and validates', () => {
    for (let i = 0; i < 1000; i++) expect(secureRandomInt(7)).toBeLessThan(7);
    expect(() => secureRandomInt(0)).toThrow(RangeError);
  });
  it('shuffle keeps elements', () => {
    expect(shuffle([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
  });
  it('ids and codes', () => {
    expect(uid('p')).toMatch(/^p_[a-z0-9]+$/);
    expect(accessCode()).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });
});
