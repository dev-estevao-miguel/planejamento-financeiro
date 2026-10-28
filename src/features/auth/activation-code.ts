/**
 * One-time activation codes ("XXXX-XXXX") used for first access and password
 * reset. No 0/O, 1/I/L so they can be read aloud or typed from a message.
 * Kept dependency-free: also imported by scripts/accounts.mts.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ACTIVATION_CODE_LENGTH = 8;

/** Uniformly random code (rejection sampling avoids modulo bias). */
export function generateActivationCode(): string {
  const limit = 256 - (256 % ALPHABET.length);
  let code = "";
  while (code.length < ACTIVATION_CODE_LENGTH) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    for (const byte of bytes) {
      if (byte < limit && code.length < ACTIVATION_CODE_LENGTH) code += ALPHABET[byte % ALPHABET.length];
    }
  }
  return code;
}

/** "abcd-2345 " -> "ABCD2345" */
export function normalizeActivationCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** "ABCD2345" -> "ABCD-2345" */
export function formatActivationCode(code: string): string {
  const normalized = normalizeActivationCode(code);
  return normalized.length > 4 ? `${normalized.slice(0, 4)}-${normalized.slice(4)}` : normalized;
}
