import { normalizePhone } from './phone';

/** Minimal RFC 4180 parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string, delimiter?: string): string[][] {
  const d = delimiter ?? detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === d) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

function detectDelimiter(text: string): string {
  const first = text.split(/\r?\n/, 1)[0] ?? '';
  const counts = [',', ';', '\t'].map((d) => [d, first.split(d).length] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0]![0];
}

export function toCsv(rows: (string | number)[][]): string {
  return rows
    .map((r) =>
      r
        .map((v) => {
          let s = String(v);
          // Neutralise spreadsheet formula injection.
          if (/^[=+\-@]/.test(s)) s = `'${s}`;
          return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(','),
    )
    .join('\r\n');
}

export interface ImportedPerson {
  name: string;
  email: string;
  department?: string;
  wishlist?: string;
  /** E.164, already normalised by the importer. */
  phone?: string;
}

const HEADER_ALIASES: Record<keyof ImportedPerson, string[]> = {
  name: ['name', 'full name', 'fullname', 'participant', 'employee'],
  email: ['email', 'e-mail', 'mail', 'email address'],
  department: ['department', 'dept', 'team', 'group', 'household'],
  wishlist: ['wishlist', 'wish list', 'wishes', 'interests', 'notes'],
  phone: [
    'phone',
    'mobile',
    'whatsapp',
    'phone number',
    'mobile number',
    'cell',
    'cell phone',
    'telephone',
    'tel',
  ],
};

export interface ImportResult {
  people: ImportedPerson[];
  errors: string[];
}

export function importParticipants(text: string, phoneCountryCode?: string): ImportResult {
  const rows = parseCsv(text.trim());
  const errors: string[] = [];
  if (!rows.length) return { people: [], errors: ['No rows found.'] };
  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  const idx = (k: keyof ImportedPerson) => header.findIndex((h) => HEADER_ALIASES[k].includes(h));
  let cols = {
    name: idx('name'),
    email: idx('email'),
    department: idx('department'),
    wishlist: idx('wishlist'),
    phone: idx('phone'),
  };
  let body = rows.slice(1);
  if (cols.name < 0) {
    // No header row: assume name, email, department, wishlist, phone.
    cols = { name: 0, email: 1, department: 2, wishlist: 3, phone: 4 };
    body = rows;
  }
  const people: ImportedPerson[] = [];
  body.forEach((r, i) => {
    const get = (c: number) => (c >= 0 ? (r[c] ?? '').trim() : '');
    const name = get(cols.name);
    const email = get(cols.email);
    const line = i + (body === rows ? 1 : 2);
    if (!name) return void errors.push(`Line ${line}: missing name.`);
    if (email && !isEmail(email)) return void errors.push(`Line ${line}: invalid email "${email}".`);
    const rawPhone = get(cols.phone);
    let phone: string | undefined;
    if (rawPhone) {
      const res = normalizePhone(rawPhone, phoneCountryCode);
      if (!res.ok) return void errors.push(`Line ${line}: phone "${rawPhone}": ${res.reason}`);
      phone = res.e164;
    }
    people.push({
      name,
      email,
      department: get(cols.department) || undefined,
      wishlist: get(cols.wishlist) || undefined,
      ...(phone ? { phone } : {}),
    });
  });
  return { people, errors };
}

export function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
