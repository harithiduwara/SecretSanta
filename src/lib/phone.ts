/**
 * Phone numbers are stored in E.164 form ("+94771234567") so WhatsApp click-to-chat links work everywhere.
 * Numbers written with a leading 0 are local and need the exchange's country code to be turned into E.164.
 */
export type PhoneResult = { ok: true; e164: string } | { ok: false; reason: string };

/** Digits of a country calling code ("+94", "0094", "94" → "94"), or '' when empty or invalid. */
export function cleanCountryCode(input: string | undefined): string {
  const d = (input ?? '').replace(/[^\d]/g, '').replace(/^00/, '');
  return /^[1-9]\d{0,2}$/.test(d) ? d : '';
}

export function normalizePhone(raw: string, defaultCountryCode?: string): PhoneResult {
  const s = raw.trim();
  if (!s) return { ok: false, reason: 'Enter a phone number.' };
  if (/[^\d\s()+.\-/]/.test(s)) return { ok: false, reason: 'Use digits only, e.g. +94 77 123 4567.' };
  let digits: string;
  if (s.startsWith('+')) digits = s.slice(1).replace(/\D/g, '');
  else {
    const d = s.replace(/\D/g, '');
    const cc = cleanCountryCode(defaultCountryCode);
    if (d.startsWith('00')) digits = d.slice(2);
    else if (cc && !d.startsWith('0') && d.startsWith(cc) && d.length - cc.length >= 7) {
      // Already international, just without "+" (spreadsheets often drop it): 94771234567.
      digits = d;
    } else {
      if (!cc) return { ok: false, reason: 'Add the country code, e.g. +94 77 123 4567.' };
      // Local format: drop the trunk prefix "0" (e.g. 077… in Sri Lanka, 07… in the UK).
      digits = cc + d.replace(/^0/, '');
    }
  }
  if (digits.startsWith('0')) return { ok: false, reason: 'A country code never starts with 0.' };
  if (digits.length < 8 || digits.length > 15)
    return { ok: false, reason: 'That number has the wrong length.' };
  return { ok: true, e164: `+${digits}` };
}

/** WhatsApp click-to-chat link with a pre-filled message. Works on phone, desktop app and WhatsApp Web. */
export function whatsappLink(e164: string, text: string): string {
  return `https://wa.me/${e164.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}
