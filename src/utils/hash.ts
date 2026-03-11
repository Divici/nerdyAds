import { createHash } from 'node:crypto';

/** Returns a SHA-256 hex digest of the given prompt string. */
export function hashPrompt(prompt: string): string {
  return createHash('sha256').update(prompt, 'utf8').digest('hex');
}

/** Derives a positive integer seed offset from a string (e.g. runId). */
export function seedOffsetFromString(value: string): number {
  const hash = createHash('sha256').update(value, 'utf8').digest();
  // Read first 4 bytes as unsigned 32-bit integer
  return hash.readUInt32BE(0);
}
