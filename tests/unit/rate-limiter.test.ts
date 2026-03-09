import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RateLimiter } from '@utils/rate-limiter.js';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('executes a single task and returns its result', async () => {
    const limiter = new RateLimiter({ minDelayMs: 0, maxConcurrent: 5 });
    const result = await limiter.execute(() => Promise.resolve('done'));
    expect(result).toBe('done');
  });

  it('enforces minimum delay between sequential calls', async () => {
    const limiter = new RateLimiter({ minDelayMs: 100, maxConcurrent: 5 });
    const timestamps: number[] = [];

    const task = () => {
      timestamps.push(Date.now());
      return Promise.resolve('ok');
    };

    // Run two tasks sequentially
    const p1 = limiter.execute(task);
    const p2 = limiter.execute(task);

    // Advance timers enough for both to complete
    await vi.advanceTimersByTimeAsync(300);
    await Promise.all([p1, p2]);

    expect(timestamps).toHaveLength(2);
    expect(timestamps[1] - timestamps[0]).toBeGreaterThanOrEqual(100);
  });

  it('limits concurrent executions', async () => {
    const limiter = new RateLimiter({ minDelayMs: 0, maxConcurrent: 2 });
    let activeCalls = 0;
    let maxActiveCalls = 0;

    const task = () =>
      new Promise<string>((resolve) => {
        activeCalls++;
        maxActiveCalls = Math.max(maxActiveCalls, activeCalls);
        setTimeout(() => {
          activeCalls--;
          resolve('ok');
        }, 50);
      });

    const promises = [
      limiter.execute(task),
      limiter.execute(task),
      limiter.execute(task),
      limiter.execute(task),
    ];

    await vi.advanceTimersByTimeAsync(500);
    await Promise.all(promises);

    expect(maxActiveCalls).toBeLessThanOrEqual(2);
  });

  it('retries on failure up to maxRetries times', async () => {
    const limiter = new RateLimiter({
      minDelayMs: 0,
      maxConcurrent: 5,
      maxRetries: 3,
      backoffBaseMs: 10,
    });

    let attempts = 0;
    const task = () => {
      attempts++;
      if (attempts < 3) {
        return Promise.reject(new Error('transient error'));
      }
      return Promise.resolve('success');
    };

    const p = limiter.execute(task);
    // Advance enough for retries with backoff (10ms, 20ms)
    await vi.advanceTimersByTimeAsync(500);
    const result = await p;

    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('throws after exhausting all retries', async () => {
    const limiter = new RateLimiter({
      minDelayMs: 0,
      maxConcurrent: 5,
      maxRetries: 2,
      backoffBaseMs: 10,
    });

    const task = () => Promise.reject(new Error('permanent error'));

    const p = limiter.execute(task);
    // Attach rejection handler immediately to avoid unhandled rejection
    const resultPromise = p.catch((e: Error) => e);
    await vi.advanceTimersByTimeAsync(500);
    const error = await resultPromise;

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('permanent error');
  });

  it('uses exponential backoff on retries', async () => {
    const limiter = new RateLimiter({
      minDelayMs: 0,
      maxConcurrent: 5,
      maxRetries: 3,
      backoffBaseMs: 100,
    });

    const timestamps: number[] = [];
    let attempts = 0;

    const task = () => {
      timestamps.push(Date.now());
      attempts++;
      if (attempts < 3) {
        return Promise.reject(new Error('fail'));
      }
      return Promise.resolve('ok');
    };

    const p = limiter.execute(task);
    await vi.advanceTimersByTimeAsync(5000);
    await p;

    // First retry after ~100ms, second after ~200ms
    expect(timestamps[1] - timestamps[0]).toBeGreaterThanOrEqual(100);
    expect(timestamps[2] - timestamps[1]).toBeGreaterThanOrEqual(200);
  });
});
