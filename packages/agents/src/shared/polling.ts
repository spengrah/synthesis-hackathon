export async function pollUntil<T>(
  fn: () => Promise<T | null>,
  opts: { intervalMs: number; timeoutMs?: number; label: string },
): Promise<T> {
  const start = Date.now();

  while (true) {
    const result = await fn();
    if (result !== null) return result;

    if (opts.timeoutMs !== undefined && Date.now() - start >= opts.timeoutMs) {
      throw new Error(`pollUntil timed out after ${opts.timeoutMs}ms: ${opts.label}`);
    }

    await new Promise((resolve) => setTimeout(resolve, opts.intervalMs));
  }
}
