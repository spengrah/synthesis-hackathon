import type { PonderSnapshot, PonderAgreement, PonderClaim } from "./queries.js";

export interface StateTransition {
  agreementId: string;
  fromState: string;
  toState: string;
  timestamp: string;
}

export interface SyncChangeset {
  /** Agreements not seen in previous snapshot */
  newAgreementIds: Set<string>;
  /** Agreements whose state/outcome changed */
  stateTransitions: StateTransition[];
  /** Claims not seen in previous snapshot */
  newClaimIds: Set<string>;
  /** Claims whose verdict changed (was null, now set) */
  adjudicatedClaimIds: Set<string>;
  /** Agreements that closed since last snapshot */
  closedAgreementIds: Set<string>;
  /** Whether this is the first sync (everything is new) */
  isFullSync: boolean;
}

export class Differ {
  private lastSnapshot: PonderSnapshot | null = null;
  private knownAgreementStates = new Map<string, string>();
  private knownClaimVerdicts = new Map<string, boolean | null>();
  private knownAgreementClosed = new Set<string>();

  diff(snapshot: PonderSnapshot): SyncChangeset {
    const isFullSync = this.lastSnapshot === null;
    const newAgreementIds = new Set<string>();
    const stateTransitions: StateTransition[] = [];
    const newClaimIds = new Set<string>();
    const adjudicatedClaimIds = new Set<string>();
    const closedAgreementIds = new Set<string>();

    for (const agr of snapshot.agreements) {
      // Detect new agreements
      if (!this.knownAgreementStates.has(agr.id)) {
        newAgreementIds.add(agr.id);
      }

      // Detect state transitions
      const prevState = this.knownAgreementStates.get(agr.id);
      if (prevState && prevState !== agr.state) {
        stateTransitions.push({
          agreementId: agr.id,
          fromState: prevState,
          toState: agr.state,
          timestamp: agr.closedAt ?? agr.activatedAt ?? agr.setUpAt ?? agr.createdAt,
        });
      }
      this.knownAgreementStates.set(agr.id, agr.state);

      // Detect closed agreements
      if (agr.closedAt && !this.knownAgreementClosed.has(agr.id)) {
        closedAgreementIds.add(agr.id);
        this.knownAgreementClosed.add(agr.id);
      }

      // Detect new/adjudicated claims
      for (const claim of agr.claims.items) {
        if (!this.knownClaimVerdicts.has(claim.id)) {
          newClaimIds.add(claim.id);
        }
        const prevVerdict = this.knownClaimVerdicts.get(claim.id);
        if (prevVerdict === null && claim.verdict !== null) {
          adjudicatedClaimIds.add(claim.id);
        }
        this.knownClaimVerdicts.set(claim.id, claim.verdict);
      }
    }

    this.lastSnapshot = snapshot;
    return { newAgreementIds, stateTransitions, newClaimIds, adjudicatedClaimIds, closedAgreementIds, isFullSync };
  }
}
