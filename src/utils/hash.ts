import { createHash } from 'node:crypto';

/** Returns a SHA-256 hex digest of the given prompt string. */
export function hashPrompt(prompt: string): string {
  return createHash('sha256').update(prompt, 'utf8').digest('hex');
}
