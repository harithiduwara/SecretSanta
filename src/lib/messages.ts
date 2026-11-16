import type { Participant, SantaEvent } from './types';
import { formatDate, formatMoney } from './format';

/**
 * The invitation text sent to one giver, used for email and WhatsApp alike. It never includes the access code:
 * with access codes on, the code must travel through a different channel than the link.
 */
export function inviteMessage(
  event: Pick<SantaEvent, 'name' | 'budget' | 'currency' | 'date' | 'rules'>,
  giver: Pick<Participant, 'name'>,
  link: string,
): string {
  return [
    `Hi ${giver.name.trim().split(/\s+/)[0]},`,
    '',
    `The names for ${event.name} have been drawn! Open your private link to find out who you're gifting:`,
    '',
    link,
    '',
    event.rules.pinProtectedLinks ? 'You will receive your personal access code separately.' : '',
    `Budget: ${formatMoney(event.budget, event.currency)}${event.date ? ` · Exchange: ${formatDate(event.date)}` : ''}`,
    '',
    'Please keep it a secret! 🤫',
  ]
    .filter((l, i, a) => l !== '' || a[i - 1] !== '')
    .join('\n');
}

export const inviteSubject = (event: Pick<SantaEvent, 'name'>) =>
  `Your Secret Santa match for ${event.name} 🎁`;
