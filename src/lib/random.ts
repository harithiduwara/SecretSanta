// Pool CSPRNG output: one getRandomValues call per 1,024 draws instead of per draw (large-roster performance).
const POOL_SIZE = 1024;
const pool = new Uint32Array(POOL_SIZE);
let poolIndex = POOL_SIZE;

function nextUint32(): number {
  if (poolIndex >= POOL_SIZE) {
    crypto.getRandomValues(pool);
    poolIndex = 0;
  }
  return pool[poolIndex++]!;
}

/** Cryptographically secure random integer in [0, max). Uses rejection sampling to avoid modulo bias. */
export function secureRandomInt(max: number): number {
  if (!Number.isInteger(max) || max <= 0) throw new RangeError('max must be a positive integer');
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  for (;;) {
    const n = nextUint32();
    if (n < limit) return n % max;
  }
}

/** Fisher–Yates shuffle returning a new array. */
export function shuffle<T>(items: readonly T[], rand: (max: number) => number = secureRandomInt): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function uid(prefix = ''): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  const s = Array.from(bytes, (b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 14);
  return prefix ? `${prefix}_${s}` : s;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I ambiguity

export function accessCode(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[secureRandomInt(CODE_ALPHABET.length)];
  return out;
}
