/**
 * Fire-and-forget notification queue.
 * Decouples notification I/O (SMTP, webhooks, DB queries) from
 * the check loop so slow notifications don't block checks.
 */
class NotificationDispatcher {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;
  private readonly concurrency = 3;

  enqueue(fn: () => Promise<void>): void {
    this.queue.push(fn);
    this.drain();
  }

  private async drain(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, this.concurrency);
        await Promise.allSettled(
          batch.map(fn =>
            fn().catch(err => console.error('[NotificationDispatcher] Error:', err))
          )
        );
      }
    } finally {
      this.processing = false;
    }
  }
}

export const notificationDispatcher = new NotificationDispatcher();
