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
  /** All agreements that changed in any way (new, state, claims, zones, typed entities) */
  changedAgreementIds: Set<string>;
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
  private knownZoneCount = new Map<string, number>();
  private knownProposalCount = new Map<string, number>();
  private knownClaimCount = new Map<string, number>();
  private knownFeedbackCount = new Map<string, number>();
  private knownTypedEntityCount = new Map<string, number>();

  diff(snapshot: PonderSnapshot): SyncChangeset {
    const isFullSync = this.lastSnapshot === null;
    const newAgreementIds = new Set<string>();
    const changedAgreementIds = new Set<string>();
    const stateTransitions: StateTransition[] = [];
    const newClaimIds = new Set<string>();
    const adjudicatedClaimIds = new Set<string>();
    const closedAgreementIds = new Set<string>();

    for (const agr of snapshot.agreements) {
      // Detect new agreements
      if (!this.knownAgreementStates.has(agr.id)) {
        newAgreementIds.add(agr.id);
        changedAgreementIds.add(agr.id);
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
        changedAgreementIds.add(agr.id);
      }
      this.knownAgreementStates.set(agr.id, agr.state);

      // Detect closed agreements
      if (agr.closedAt && !this.knownAgreementClosed.has(agr.id)) {
        closedAgreementIds.add(agr.id);
        this.knownAgreementClosed.add(agr.id);
        changedAgreementIds.add(agr.id);
      }

      // Detect new zones
      const prevZones = this.knownZoneCount.get(agr.id) ?? 0;
      if (agr.trustZones.items.length !== prevZones) {
        changedAgreementIds.add(agr.id);
      }
      this.knownZoneCount.set(agr.id, agr.trustZones.items.length);

      // Detect new proposals
      const prevProposals = this.knownProposalCount.get(agr.id) ?? 0;
      if (agr.proposals.items.length !== prevProposals) {
        changedAgreementIds.add(agr.id);
      }
      this.knownProposalCount.set(agr.id, agr.proposals.items.length);

      // Detect new/adjudicated claims
      const prevClaims = this.knownClaimCount.get(agr.id) ?? 0;
      if (agr.claims.items.length !== prevClaims) {
        changedAgreementIds.add(agr.id);
      }
      this.knownClaimCount.set(agr.id, agr.claims.items.length);

      for (const claim of agr.claims.items) {
        if (!this.knownClaimVerdicts.has(claim.id)) {
          newClaimIds.add(claim.id);
        }
        const prevVerdict = this.knownClaimVerdicts.get(claim.id);
        if (prevVerdict === null && claim.verdict !== null) {
          adjudicatedClaimIds.add(claim.id);
          changedAgreementIds.add(agr.id);
        }
        this.knownClaimVerdicts.set(claim.id, claim.verdict);
      }

      // Detect new feedback
      const prevFeedback = this.knownFeedbackCount.get(agr.id) ?? 0;
      if (agr.reputationFeedbacks.items.length !== prevFeedback) {
        changedAgreementIds.add(agr.id);
      }
      this.knownFeedbackCount.set(agr.id, agr.reputationFeedbacks.items.length);

      // Detect new typed entities
      const typed = snapshot.typedEntities.get(agr.id);
      if (typed) {
        let typedCount = 0;
        for (const key of Object.keys(typed) as (keyof typeof typed)[]) {
          typedCount += typed[key].items.length;
        }
        const prevTyped = this.knownTypedEntityCount.get(agr.id) ?? 0;
        if (typedCount !== prevTyped) {
          changedAgreementIds.add(agr.id);
        }
        this.knownTypedEntityCount.set(agr.id, typedCount);
      }
    }

    this.lastSnapshot = snapshot;
    return { newAgreementIds, changedAgreementIds, stateTransitions, newClaimIds, adjudicatedClaimIds, closedAgreementIds, isFullSync };
  }
}
