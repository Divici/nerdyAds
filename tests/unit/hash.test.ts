import { describe, it, expect } from 'vitest';
import { hashPrompt } from '@utils/hash.js';

describe('hashPrompt', () => {
  it('returns a 64-character hex string (SHA-256)', () => {
    const result = hashPrompt('test input');
    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic — same input produces same hash', () => {
    const input = 'Generate an ad for SAT prep targeting anxious parents';
    expect(hashPrompt(input)).toBe(hashPrompt(input));
  });

  it('produces different hashes for different inputs', () => {
    const a = hashPrompt('input A');
    const b = hashPrompt('input B');
    expect(a).not.toBe(b);
  });

  it('handles empty string', () => {
    const result = hashPrompt('');
    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });

  it('handles unicode content', () => {
    const result = hashPrompt('SAT prep — boost your score! 🎯');
    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });
});
