export type ID = string;

export interface Participant {
  id: ID;
  name: string;
  email: string;
  department?: string;
  wishlist?: string;
  /** Mobile number in E.164 form ("+94771234567"), used for WhatsApp. */
  phone?: string;
  /** Per-participant access code used to encrypt their reveal link (when PIN protection is on). */
  accessCode: string;
}

/** `giverId` must not be assigned `receiverId`. When `mutual`, the reverse is also forbidden. */
export interface Exclusion {
  id: ID;
  giverId: ID;
  receiverId: ID;
  mutual: boolean;
}

export interface Assignment {
  giverId: ID;
  receiverId: ID;
}

export type DrawMode = 'random' | 'single-loop';

export interface DrawRules {
  mode: DrawMode;
  avoidSameDepartment: boolean;
  avoidPreviousPairs: boolean;
  /** Prevent A→B and B→A in the same draw (only meaningful for 3+ participants). */
  avoidReciprocal: boolean;
  pinProtectedLinks: boolean;
}

export type EventStatus = 'draft' | 'drawn' | 'archived';

export interface AuditEntry {
  id: ID;
  at: string;
  action: string;
  detail?: string;
}

export interface SantaEvent {
  id: ID;
  name: string;
  description: string;
  /** ISO date (yyyy-mm-dd) of the exchange. */
  date: string;
  budget: number;
  currency: string;
  /** Country calling code (digits, e.g. "94") applied to phone numbers written in local format. */
  phoneCountryCode?: string;
  status: EventStatus;
  participants: Participant[];
  exclusions: Exclusion[];
  rules: DrawRules;
  assignments: Assignment[];
  /** Assignments from previous rounds, newest last. */
  history: Assignment[][];
  /** participantId → ISO timestamp when the organizer marked their link as delivered. */
  notified: Record<ID, string>;
  audit: AuditEntry[];
  createdAt: string;
  updatedAt: string;
  drawnAt?: string;
}

export interface RevealPayload {
  v: 1;
  event: string;
  date: string;
  budget: number;
  currency: string;
  giver: string;
  receiver: string;
  wishlist?: string;
  message?: string;
}
