/**
 * Generic high-entropy token fallback (B-02, decision D-2).
 *
 * Named vendor patterns only catch secrets we already know the shape of.
 * This catches the rest — custom tokens, internal service credentials, tokens
 * from vendors that did not exist when the pattern list was written.
 *
 * The risk runs the other way here: over-redaction mangles the stack traces
 * crashpack exists to preserve. The allowlist below is what keeps that from
 * happening, and `fixtures/no-redact-corpus.txt` is its regression gate.
 *
 * If that corpus fails, fix the allowlist. Never lower ENTROPY_FLOOR — doing
 * so silently un-redacts real secrets to make a false positive go away.
 */

/** Strings that look random but carry no secret. */
const ALLOWLIST: RegExp[] = [
  /^[0-9a-f]{7,64}$/i,                                                 // git SHAs, content digests
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,   // UUID
  /^\d+$/,                                                             // pure digits
  /^v?\d+\.\d+\.\d+/,                                                  // semver
  /^0x[0-9a-f]+$/i,                                                    // memory addresses
  /^(?:sha\d{3}|md5)-/i,                                               // npm integrity hashes
  /^\[redacted/,                                                       // already handled
];

const MIN_LENGTH = 24;
const ENTROPY_FLOOR = 3.5;

/**
 * Candidate charset deliberately excludes '/' and '.', which is what keeps
 * file paths, URLs, dotted class names and package specifiers out of the
 * candidate set before entropy is ever measured.
 */
const CANDIDATE = /\b[A-Za-z0-9_-]{24,}={0,2}\b/g;

export function shannon(input: string): number {
  if (!input) return 0;
  const freq = new Map<string, number>();
  for (const ch of input) freq.set(ch, (freq.get(ch) ?? 0) + 1);

  let bits = 0;
  for (const n of freq.values()) {
    const p = n / input.length;
    bits -= p * Math.log2(p);
  }
  return bits;
}

export function looksSecret(token: string): boolean {
  if (token.length < MIN_LENGTH) return false;
  if (ALLOWLIST.some((re) => re.test(token))) return false;

  // Mixed case plus a digit. This single check rejects lowercase hashes,
  // SCREAMING_CONSTANTS and ordinary prose before entropy is considered.
  if (!/[a-z]/.test(token) || !/[A-Z]/.test(token) || !/\d/.test(token)) return false;

  return shannon(token) >= ENTROPY_FLOOR;
}

/** Returns the redacted text and how many tokens were masked. */
export function redactHighEntropy(input: string): { text: string; count: number } {
  let count = 0;
  const text = input.replace(CANDIDATE, (token) => {
    if (!looksSecret(token)) return token;
    count++;
    return '[redacted]';
  });
  return { text, count };
}
