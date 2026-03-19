import type { BonfiresClient } from "../client.js";
import type { DelveResult } from "../types.js";

export function createAdjudicatorQueries(client: BonfiresClient) {
  return {
    async getDirectivesForZone(zoneAddr: string): Promise<DelveResult> {
      return client.delve({
        query: `directive rules for zone:${zoneAddr.toLowerCase()}`,
        num_results: 20,
        relationship_types: ["HOLDS_DIRECTIVE"],
      });
    },

    async getTweetReceiptsForZone(
      zoneAddr: string,
      windowStart?: string,
      windowEnd?: string,
    ): Promise<DelveResult> {
      return client.delve({
        query: `tweet receipts for zone:${zoneAddr.toLowerCase()}`,
        num_results: 100,
        window_start: windowStart,
        window_end: windowEnd,
      });
    },

    async getEvidenceForClaim(
      agreementAddr: string,
      claimId: string,
    ): Promise<DelveResult> {
      return client.delve({
        query: `evidence for claim:${agreementAddr.toLowerCase()}:${claimId}`,
        num_results: 50,
      });
    },

    async getAdjudicationContext(opts: {
      claimId: string;
      agreementAddr: string;
      zoneAddr: string;
      activatedAt?: string;
      claimTimestamp?: string;
    }) {
      const [claim, receipts, evidence, directives] = await Promise.all([
        client.delve({
          query: `claim:${opts.agreementAddr.toLowerCase()}:${opts.claimId}`,
          num_results: 1,
        }),
        client.delve({
          query: `tweet receipts for zone:${opts.zoneAddr.toLowerCase()}`,
          num_results: 100,
          window_start: opts.activatedAt,
          window_end: opts.claimTimestamp,
        }),
        client.delve({
          query: `evidence for claim:${opts.agreementAddr.toLowerCase()}:${opts.claimId}`,
          num_results: 50,
        }),
        client.delve({
          query: `directive tokens held by zone:${opts.zoneAddr.toLowerCase()}`,
          num_results: 20,
        }),
      ]);

      return { claim, receipts, evidence, directives };
    },
  };
}
