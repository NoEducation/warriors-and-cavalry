// A set of callbacks told about each value of type T, e.g. the world's changes.

export class Listeners<T> {
  private readonly listeners = new Set<(value: T) => void>();

  /** Calls `listener` for every value notified from now on. Returns a function that unsubscribes it. */
  public add(listener: (value: T) => void): () => void {
    // Wrapped, so subscribing the same function twice gives two independent subscriptions.
    const wrapped = (value: T): void => listener(value);
    this.listeners.add(wrapped);
    return (): void => {
      this.listeners.delete(wrapped);
    };
  }

  /** Calls every listener with `value`, in subscription order; listeners may unsubscribe while being called. */
  public notify(value: T): void {
    for (const listener of [...this.listeners]) listener(value);
  }
}
