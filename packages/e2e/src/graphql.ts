import type { Address } from "viem";
import { createPonderBackend, type ReadBackend } from "@trust-zones/sdk";

const DEFAULT_TIMEOUT = 15_000;
const DEFAULT_INTERVAL = 250;

/** Poll a query until a predicate passes. */
export async function waitFor<T>(
  query: () => Promise<T>,
  predicate: (data: T) => boolean,
  timeoutMs: number = DEFAULT_TIMEOUT,
): Promise<T> {
  const start = Date.now();
  let lastError: Error | undefined;

  while (Date.now() - start < timeoutMs) {
    try {
      const data = await query();
      if (predicate(data)) return data;
    } catch (err) {
      lastError = err as Error;
    }
    await new Promise((r) => setTimeout(r, DEFAULT_INTERVAL));
  }

  const msg = lastError
    ? `waitFor timed out after ${timeoutMs}ms. Last error: ${lastError.message}`
    : `waitFor timed out after ${timeoutMs}ms. Predicate never passed.`;
  throw new Error(msg);
}

/** Wait for an agreement to reach a specific state. */
export async function waitForState(
  backend: ReadBackend,
  agreement: Address,
  expectedState: string,
): Promise<void> {
  await waitFor(
    () => backend.getAgreementState(agreement),
    (s) => s.currentState === expectedState,
  );
}

/** Wait for a specific number of trust zones to be indexed. */
export async function waitForZoneCount(
  backend: ReadBackend,
  agreement: Address,
  count: number,
  timeoutMs?: number,
): Promise<void> {
  await waitFor(
    () => backend.getAgreementState(agreement),
    (s) => {
      const nonZero = s.trustZones.filter(
        (z) => z !== "0x0000000000000000000000000000000000000000",
      );
      return nonZero.length >= count;
    },
    timeoutMs,
  );
}

/** Wait for a specific number of proposals to be indexed. */
export async function waitForProposalCount(
  backend: ReadBackend,
  agreement: Address,
  count: number,
): Promise<void> {
  await waitFor(
    () => backend.getProposalHistory(agreement),
    (proposals) => proposals.length >= count,
  );
}

/** Wait for a specific number of claims to be indexed. */
export async function waitForClaimCount(
  backend: ReadBackend,
  agreement: Address,
  count: number,
  timeoutMs?: number,
): Promise<void> {
  await waitFor(
    () => backend.getClaims(agreement),
    (claims) => claims.length >= count,
    timeoutMs,
  );
}

/** Create a read backend pointing at the given Ponder GraphQL URL. */
export function createBackend(ponderUrl: string): ReadBackend {
  return createPonderBackend(ponderUrl);
}
