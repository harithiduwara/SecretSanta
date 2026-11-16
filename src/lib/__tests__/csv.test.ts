import { describe, expect, it } from 'vitest';
import { importParticipants, isEmail, parseCsv, toCsv } from '../csv';

describe('csv', () => {
  it('parses quotes, escaped quotes and CRLF', () => {
    expect(parseCsv('a,"b, c","d ""e"""\r\n1,2,3\n')).toEqual([
      ['a', 'b, c', 'd "e"'],
      ['1', '2', '3'],
    ]);
  });

  it('detects semicolon and tab delimiters', () => {
    expect(parseCsv('a;b\n1;2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(parseCsv('a\tb\n1\t2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('imports with header aliases in any order', () => {
    const r = importParticipants('Email,Full Name,Team\njane@acme.com,Jane Doe,Eng\n,Bob,\nbad,Eve,');
    expect(r.people).toEqual([
      { name: 'Jane Doe', email: 'jane@acme.com', department: 'Eng', wishlist: undefined },
      { name: 'Bob', email: '', department: undefined, wishlist: undefined },
    ]);
    expect(r.errors).toEqual(['Line 4: invalid email "bad".']);
  });

  it('imports headerless rows positionally and reports missing names', () => {
    const r = importParticipants('Jane,jane@a.co,Eng,Books\n,x@y.z');
    expect(r.people[0]).toEqual({ name: 'Jane', email: 'jane@a.co', department: 'Eng', wishlist: 'Books' });
    expect(r.errors).toEqual(['Line 2: missing name.']);
    expect(importParticipants('   ').errors).toEqual(['No rows found.']);
  });

  it('escapes output and neutralises formula injection', () => {
    expect(toCsv([['a,b', 'x"y', '=SUM(A1)', 3]])).toBe('"a,b","x""y",\'=SUM(A1),3');
  });

  it('validates emails', () => {
    expect(isEmail('a@b.co')).toBe(true);
    expect(isEmail('a@b')).toBe(false);
  });

  it('imports phone numbers, applying the country code to local numbers', () => {
    const r = importParticipants(
      'name,email,mobile\nJane,jane@a.co,077 123 4567\nRaj,,+91 98765 43210\nBob,,12\nNo Phone,np@a.co,',
      '94',
    );
    expect(r.people.map((p) => p.phone)).toEqual(['+94771234567', '+919876543210', undefined]);
    expect(r.errors).toEqual([expect.stringMatching(/^Line 4: phone "12"/)]);
  });

  it('rejects local phone numbers when no country code is set', () => {
    const r = importParticipants('name,whatsapp\nJane,077 123 4567');
    expect(r.people).toEqual([]);
    expect(r.errors[0]).toMatch(/country code/);
  });
});
