import type { Address, Hex } from "viem";

// ---- Enums ----

export enum TZParamType {
  Constraint = 0,
  Permission = 1,
  Responsibility = 2,
  Directive = 3,
  Eligibility = 4,
  Reward = 5,
  Penalty = 6,
  PrincipalAlignment = 7,
  DecisionModel = 8,
}

// ---- Core structs (mirror Solidity) ----

export interface TZMechanism {
  paramType: TZParamType;
  module: Address;
  initData: Hex;
}

export interface TZResourceTokenConfig {
  tokenType: TZParamType;
  metadata: Hex;
}

export interface TZConfig {
  party: Address;
  agentId: bigint;
  hatMaxSupply: number;
  hatDetails: string;
  mechanisms: TZMechanism[];
  resources: TZResourceTokenConfig[];
}

export interface ProposalData {
  termsDocUri: string;
  zones: TZConfig[];
  adjudicator: Address;
  deadline: bigint;
}

export interface AdjudicationAction {
  mechanismIndex: bigint;
  targetIndex: bigint;
  actionType: Hex;
  params: Hex;
}

// ---- SDK interface types ----

export interface SubmitInputArgs {
  inputId: Hex;
  payload: Hex;
}

// ---- Read types ----

export interface AgreementState {
  currentState: string;
  outcome: string | null;
  parties: [Address, Address];
  agentIds: [bigint, bigint];
  termsHash: Hex;
  termsUri: string;
  adjudicator: Address;
  deadline: bigint;
  trustZones: [Address, Address];
  zoneHatIds: [bigint, bigint];
  claimCount: bigint;
}

export interface ParsedPermission {
  tokenId: bigint;
  resource: string;
  rateLimit: string | null;
  expiry: bigint | null;
  purpose: string | null;
}

export interface ParsedResponsibility {
  tokenId: bigint;
  obligation: string;
  criteria: string | null;
  deadline: bigint | null;
}

export interface ParsedDirective {
  tokenId: bigint;
  rule: string;
  severity: string | null;
  params: string | null;
}

export interface ParsedConstraint {
  module: Address;
}

export interface ClaimSummary {
  claimId: bigint;
  mechanismIndex: bigint;
  claimant: Address;
  verdict: boolean | null;
  actionTypes: string[] | null;
  timestamp: bigint;
  adjudicatedAt: bigint | null;
}

export interface ZoneDetails {
  address: Address;
  party: Address;
  hatId: bigint;
  zoneIndex: number;
  active: boolean;
  permissions: ParsedPermission[];
  responsibilities: ParsedResponsibility[];
  directives: ParsedDirective[];
  constraints: ParsedConstraint[];
  claims: ClaimSummary[];
}

export interface ProposalSummary {
  sequence: number;
  proposer: Address;
  termsHash: Hex;
  termsDocUri: string;
  adjudicator: Address;
  deadline: bigint;
  zoneCount: number;
  timestamp: bigint;
}

export interface ERC8128SignedRequest {
  keyId: string;
  signature: Hex;
  message: Hex;
}

export interface ContractAddresses {
  agreementRegistry: Address;
  hats: Address;
  resourceTokenRegistry: Address;
  identityRegistry: Address;
  reputationRegistry: Address;
}

// ---- Read backend interface ----

export interface ReadBackend {
  getAgreementState(agreement: Address): Promise<AgreementState>;
  getZoneDetails(zoneAccount: Address): Promise<ZoneDetails>;
  getZonePermissions(zoneAccount: Address): Promise<ParsedPermission[]>;
  getZoneDirectives(zoneAccount: Address): Promise<ParsedDirective[]>;
  getProposalHistory(agreement: Address): Promise<ProposalSummary[]>;
  getClaims(agreement: Address): Promise<ClaimSummary[]>;
  isHatWearer(wearer: Address, hatId: bigint): Promise<boolean>;
  getResourceTokenBalance(holder: Address, tokenId: bigint): Promise<bigint>;
}

// ---- SDK config ----

export interface TrustZonesSDKConfig {
  rpcUrl: string;
  ponderUrl?: string;
  addresses: ContractAddresses;
}
