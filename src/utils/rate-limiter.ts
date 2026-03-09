export interface RateLimiterOptions {
  minDelayMs: number;
  maxConcurrent: number;
  maxRetries?: number;
  backoffBaseMs?: number;
}

/**
 * Lightweight rate limiter for API calls.
 * Enforces minimum delay between calls, caps concurrency, and retries with exponential backoff.
 */
export class RateLimiter {
  private readonly minDelayMs: number;
  private readonly maxConcurrent: number;
  private readonly maxRetries: number;
  private readonly backoffBaseMs: number;

  private activeCount = 0;
  private lastCallTime = 0;
  private queue: Array<() => void> = [];

  constructor(options: RateLimiterOptions) {
    this.minDelayMs = options.minDelayMs;
    this.maxConcurrent = options.maxConcurrent;
    this.maxRetries = options.maxRetries ?? 3;
    this.backoffBaseMs = options.backoffBaseMs ?? 1000;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.waitForSlot();
    try {
      return await this.executeWithRetry(fn);
    } finally {
      this.activeCount--;
      this.processQueue();
    }
  }

  private waitForSlot(): Promise<void> {
    if (this.activeCount < this.maxConcurrent) {
      this.activeCount++;
      return this.waitForDelay();
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.activeCount++;
        this.waitForDelay().then(resolve);
      });
    });
  }

  private async waitForDelay(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastCallTime;
    if (elapsed < this.minDelayMs) {
      await this.sleep(this.minDelayMs - elapsed);
    }
    this.lastCallTime = Date.now();
  }

  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < this.maxRetries) {
          const delay = this.backoffBaseMs * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }
    throw lastError;
  }

  private processQueue(): void {
    if (this.queue.length > 0 && this.activeCount < this.maxConcurrent) {
      const next = this.queue.shift()!;
      next();
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
