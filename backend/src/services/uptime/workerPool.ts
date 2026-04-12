/**
 * Semaphore-based worker pool for bounded concurrency.
 * Unlike rigid batching, slots free up immediately — the next
 * task starts as soon as one finishes.
 */
export class WorkerPool {
  private running = 0;
  private waitQueue: Array<() => void> = [];

  constructor(private readonly concurrency: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running >= this.concurrency) {
      await new Promise<void>(resolve => this.waitQueue.push(resolve));
    }
    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
      const next = this.waitQueue.shift();
      if (next) next();
    }
  }

  get active(): number {
    return this.running;
  }

  get pending(): number {
    return this.waitQueue.length;
  }
}
