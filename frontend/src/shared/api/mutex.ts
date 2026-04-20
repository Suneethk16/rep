// Minimal async mutex — no external dep. Used to single-flight token refresh.
export class Mutex {
  private chain: Promise<void> = Promise.resolve();

  async acquire(): Promise<() => void> {
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    const previous = this.chain;
    this.chain = previous.then(() => next);
    await previous;
    return release;
  }
}
