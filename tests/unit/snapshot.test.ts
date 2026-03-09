import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { saveSnapshot, loadSnapshot } from '@utils/snapshot.js';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

describe('snapshot', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'nerdyads-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('saves and loads a JSON snapshot', async () => {
    const data = { runId: 'test-001', ads: [{ id: 'ad-1', score: 8.5 }] };
    await saveSnapshot(tempDir, 'run-001', 'results.json', data);
    const loaded = await loadSnapshot(tempDir, 'run-001', 'results.json');
    expect(loaded).toEqual(data);
  });

  it('creates nested directories if they do not exist', async () => {
    const data = { status: 'ok' };
    await saveSnapshot(tempDir, 'run-002', 'meta.json', data);
    const files = await readdir(path.join(tempDir, 'run-002'));
    expect(files).toContain('meta.json');
  });

  it('returns null when loading a non-existent snapshot', async () => {
    const result = await loadSnapshot(tempDir, 'nope', 'missing.json');
    expect(result).toBeNull();
  });

  it('round-trips complex nested data', async () => {
    const data = {
      scores: [
        { dimension: 'clarity', score: 9, rationale: 'Very clear' },
        { dimension: 'cta', score: 6, rationale: 'Weak CTA' },
      ],
      metadata: { model: 'gemini-2.0-flash', timestamp: '2026-03-09T12:00:00Z' },
    };
    await saveSnapshot(tempDir, 'run-003', 'eval.json', data);
    const loaded = await loadSnapshot(tempDir, 'run-003', 'eval.json');
    expect(loaded).toEqual(data);
  });

  it('overwrites existing snapshot file', async () => {
    await saveSnapshot(tempDir, 'run-004', 'data.json', { v: 1 });
    await saveSnapshot(tempDir, 'run-004', 'data.json', { v: 2 });
    const loaded = await loadSnapshot(tempDir, 'run-004', 'data.json');
    expect(loaded).toEqual({ v: 2 });
  });
});
