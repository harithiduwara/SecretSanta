import { describe, expect, it } from 'vitest';
import { cleanCountryCode, normalizePhone, whatsappLink } from '../phone';
import { inviteMessage } from '../messages';

const ok = (raw: string, cc?: string) => {
  const r = normalizePhone(raw, cc);
  if (!r.ok) throw new Error(`${raw}: ${r.reason}`);
  return r.e164;
};

describe('normalizePhone', () => {
  it('accepts international formats with any punctuation', () => {
    expect(ok('+94 77 123 4567')).toBe('+94771234567');
    expect(ok('+1 (415) 555-0123')).toBe('+14155550123');
    expect(ok('0044 7700 900123')).toBe('+447700900123');
    expect(ok('+44.7700.900123')).toBe('+447700900123');
  });

  it('turns local numbers into international ones with the exchange country code', () => {
    expect(ok('077 123 4567', '94')).toBe('+94771234567');
    expect(ok('077 123 4567', '+94')).toBe('+94771234567');
    expect(ok('771234567', '94')).toBe('+94771234567');
    expect(ok('07700 900123', '44')).toBe('+447700900123');
  });

  it('recognises international numbers saved without "+" (common in spreadsheets)', () => {
    expect(ok('94771234567', '94')).toBe('+94771234567');
  });

  it('rejects numbers it cannot place or that are malformed', () => {
    expect(normalizePhone('077 123 4567')).toEqual({
      ok: false,
      reason: expect.stringMatching(/country code/),
    });
    expect(normalizePhone('')).toMatchObject({ ok: false });
    expect(normalizePhone('call me')).toMatchObject({ ok: false });
    expect(normalizePhone('+12345')).toMatchObject({ ok: false, reason: expect.stringMatching(/length/) });
    expect(normalizePhone('+0123456789')).toMatchObject({ ok: false });
    expect(normalizePhone('+1234567890123456')).toMatchObject({ ok: false });
  });

  it('cleans country codes', () => {
    expect(cleanCountryCode('+94')).toBe('94');
    expect(cleanCountryCode('0044')).toBe('44');
    expect(cleanCountryCode('971')).toBe('971');
    expect(cleanCountryCode('')).toBe('');
    expect(cleanCountryCode('+0')).toBe('');
    expect(cleanCountryCode('12345')).toBe('');
  });
});

describe('whatsappLink and invite message', () => {
  const event = {
    name: 'Team Party',
    budget: 30,
    currency: 'USD',
    date: '2026-12-19',
    rules: {
      mode: 'random',
      avoidSameDepartment: false,
      avoidPreviousPairs: true,
      avoidReciprocal: true,
      pinProtectedLinks: true,
    },
  } as const;

  it('builds a wa.me link with the encoded message', () => {
    const msg = inviteMessage(
      event,
      { name: 'Ava Thompson' },
      'https://x.github.io/SecretSanta/#/reveal/k.a.b.c',
    );
    const url = new URL(whatsappLink('+94771234567', msg));
    expect(url.origin + url.pathname).toBe('https://wa.me/94771234567');
    expect(url.searchParams.get('text')).toBe(msg);
    expect(msg).toContain('Hi Ava,');
    expect(msg).toContain('#/reveal/k.a.b.c');
  });

  it('never puts the access code in the same message as the link', () => {
    const msg = inviteMessage(event, { name: 'Ava' }, 'https://example.test/#/reveal/p.s.i.c');
    expect(msg).toContain('access code separately');
    expect(msg).not.toMatch(/\b[A-HJ-NP-Z2-9]{6}\b/);
  });
});
