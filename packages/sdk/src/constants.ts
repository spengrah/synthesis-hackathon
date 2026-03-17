import { keccak256, toHex, type Hex } from "viem";

// ---- Agreement states ----

export const PROPOSED = keccak256(toHex("PROPOSED"));
export const NEGOTIATING = keccak256(toHex("NEGOTIATING"));
export const ACCEPTED = keccak256(toHex("ACCEPTED"));
export const READY = keccak256(toHex("READY"));
export const ACTIVE = keccak256(toHex("ACTIVE"));
export const CLOSED = keccak256(toHex("CLOSED"));
export const REJECTED = keccak256(toHex("REJECTED"));

// ---- Input IDs ----

export const PROPOSE = keccak256(toHex("PROPOSE"));
export const COUNTER = keccak256(toHex("COUNTER"));
export const ACCEPT = keccak256(toHex("ACCEPT"));
export const REJECT = keccak256(toHex("REJECT"));
export const SET_UP = keccak256(toHex("SET_UP"));
export const ACTIVATE = keccak256(toHex("ACTIVATE"));
export const CLAIM = keccak256(toHex("CLAIM"));
export const ADJUDICATE = keccak256(toHex("ADJUDICATE"));
export const WITHDRAW = keccak256(toHex("WITHDRAW"));
export const COMPLETE = keccak256(toHex("COMPLETE"));
export const EXIT = keccak256(toHex("EXIT"));
export const FINALIZE = keccak256(toHex("FINALIZE"));

// ---- Adjudication action types ----

export const PENALIZE = keccak256(toHex("PENALIZE"));
export const REWARD = keccak256(toHex("REWARD"));
export const FEEDBACK = keccak256(toHex("FEEDBACK"));
export const DEACTIVATE = keccak256(toHex("DEACTIVATE"));
export const CLOSE = keccak256(toHex("CLOSE"));

// ---- Outcomes ----

export const COMPLETED = keccak256(toHex("COMPLETED"));
export const EXITED = keccak256(toHex("EXITED"));
export const EXPIRED = keccak256(toHex("EXPIRED"));
export const ADJUDICATED = keccak256(toHex("ADJUDICATED"));

// ---- State lookup: bytes32 → human-readable ----

export const STATE_LABELS: Record<Hex, string> = {
  [PROPOSED]: "PROPOSED",
  [NEGOTIATING]: "NEGOTIATING",
  [ACCEPTED]: "ACCEPTED",
  [READY]: "READY",
  [ACTIVE]: "ACTIVE",
  [CLOSED]: "CLOSED",
  [REJECTED]: "REJECTED",
};

export const OUTCOME_LABELS: Record<Hex, string> = {
  [COMPLETED]: "COMPLETED",
  [EXITED]: "EXITED",
  [EXPIRED]: "EXPIRED",
  [ADJUDICATED]: "ADJUDICATED",
};

export const ACTION_LABELS: Record<Hex, string> = {
  [PENALIZE]: "PENALIZE",
  [REWARD]: "REWARD",
  [FEEDBACK]: "FEEDBACK",
  [DEACTIVATE]: "DEACTIVATE",
  [CLOSE]: "CLOSE",
};

// Combined lookup for decodeState()
export const BYTES32_LABELS: Record<Hex, string> = {
  ...STATE_LABELS,
  ...OUTCOME_LABELS,
  ...ACTION_LABELS,
};

// ---- Module kinds ----

export const MODULE_KIND_HATS_MODULE = 0;
export const MODULE_KIND_ERC7579_HOOK = 1;
export const MODULE_KIND_EXTERNAL = 2;

// ---- Deployed addresses (placeholder — filled after deployment) ----

export const ADDRESSES = {
  hats: "0x3bc1A0Ad72417f2d411118085256fC53CBdDd137" as const,
  identityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as const,
  reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" as const,
  agreementRegistry: "0x0000000000000000000000000000000000000000" as const,
  resourceTokenRegistry:
    "0x0000000000000000000000000000000000000000" as const,
} as const;
