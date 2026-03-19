// ─── Entity labels ──────────────────────────────────────────────

export const ENTITY_LABELS = {
  Agreement: ["Agreement"],
  TrustZone: ["TrustZone"],
  Actor: ["Actor"],
  Proposal: ["Proposal"],
  Permission: ["Permission", "ResourceToken"],
  Responsibility: ["Responsibility", "ResourceToken"],
  Directive: ["Directive", "ResourceToken"],
  Constraint: ["Constraint", "Mechanism"],
  Eligibility: ["Eligibility", "Mechanism"],
  Incentive: ["Incentive", "Mechanism"],
  DecisionModel: ["DecisionModel", "Mechanism"],
  PrincipalAlignment: ["PrincipalAlignment", "Mechanism"],
  Claim: ["Claim"],
  ReputationFeedback: ["ReputationFeedback"],
} as const;

export const ENTITY_TYPES = Object.keys(ENTITY_LABELS);

// ─── Edge names ─────────────────────────────────────────────────

export const EDGE = {
  HAS_ZONE: "HAS_ZONE",
  PARTY_OF: "PARTY_OF",
  OPERATES: "OPERATES",
  HOLDS_PERMISSION: "HOLDS_PERMISSION",
  HOLDS_RESPONSIBILITY: "HOLDS_RESPONSIBILITY",
  HOLDS_DIRECTIVE: "HOLDS_DIRECTIVE",
  HAS_CONSTRAINT: "HAS_CONSTRAINT",
  HAS_ELIGIBILITY: "HAS_ELIGIBILITY",
  HAS_INCENTIVE: "HAS_INCENTIVE",
  HAS_DECISION_MODEL: "HAS_DECISION_MODEL",
  HAS_PRINCIPAL_ALIGNMENT: "HAS_PRINCIPAL_ALIGNMENT",
  FILED_BY: "FILED_BY",
  CLAIM_IN: "CLAIM_IN",
  FEEDBACK_FOR: "FEEDBACK_FOR",
  FEEDBACK_IN: "FEEDBACK_IN",
  PROPOSAL_IN: "PROPOSAL_IN",
  PROPOSED_BY: "PROPOSED_BY",
  PROPOSED_IN: "PROPOSED_IN",
} as const;

// ─── API request/response shapes ────────────────────────────────

export interface CreateEntityRequest {
  name: string;
  bonfire_id?: string;
  agent_id?: string;
  labels?: string[];
  summary?: string;
  attributes?: Record<string, unknown>;
}

export interface CreateEdgeRequest {
  source_uuid: string;
  target_uuid: string;
  edge_name: string;
  fact?: string;
  group_id: string;
}

export interface CreateEpisodeRequest {
  bonfire_id: string;
  name: string;
  episode_body: string;
  source?: string;
  source_description?: string;
  reference_time?: string;
  group_id?: string;
  uuid?: string;
  entity_types?: string[];
}

export interface DelveRequest {
  query: string;
  bonfire_id: string;
  agent_id?: string;
  num_results?: number;
  window_start?: string;
  window_end?: string;
  relationship_types?: string[];
}

export interface EntityResponse {
  success: boolean;
  entity: Record<string, unknown>;
  edges?: Record<string, unknown>[];
}

export interface EdgeResponse {
  success: boolean;
  edge: Record<string, unknown>;
}

export interface EpisodeResponse {
  success: boolean;
  episode: Record<string, unknown>;
}

export interface DelveResult {
  success: boolean;
  query: string;
  num_results: number;
  episodes: Record<string, unknown>[];
  entities: Record<string, unknown>[];
  edges: Record<string, unknown>[];
  nodes?: Record<string, unknown>[];
}

export interface ExpandResult {
  success: boolean;
  entity: Record<string, unknown>;
  edges: Record<string, unknown>[];
  nodes: Record<string, unknown>[];
}
