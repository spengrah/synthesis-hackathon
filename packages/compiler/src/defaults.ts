import type { Address } from "viem";
import type { CompilerConfig } from "./types.js";

/**
 * Default compiler config for Base mainnet.
 * Addresses are filled in as modules are deployed.
 * Zero addresses indicate the module is not yet deployed.
 */
export const BASE_MAINNET_CONFIG: CompilerConfig = {
  modules: {
    // Constraint templates (ERC7579Hook singletons)
    "budget-cap": "0x0000000000000000000000000000000000000000" as Address, // SpendingLimitHook — needs deployment
    "target-allowlist": "0x0000000000000000000000000000000000000000" as Address, // PermissionsHook — needs deployment
    "time-lock": "0x7E31543b269632ddc55a23553f902f84C9DD8454" as Address, // ColdStorageHook

    // Eligibility templates (HatsModule implementations)
    "staking": "0x9E01030aF633Be5a439DF122F2eEf750b44B8aC7" as Address, // StakingEligibility
    "reputation-gate": "0x0000000000000000000000000000000000000000" as Address, // 8004ReputationEligibility — needs building
    "erc20-balance": "0xbA5b218e6685D0607139c06f81442681a32a0EC3" as Address, // ERC20Eligibility
    "allowlist": "0x80336fb7b6B653686eBe71d2c3ee685b70108B8f" as Address, // AllowlistEligibility
    "hat-wearing": "0xa2e614CE4FAaD60e266127F4006b812d69977265" as Address, // HatWearingEligibility
  },
  adjudicators: {
    "stub-adjudicator": "0x0000000000000000000000000000000000000000" as Address, // needs deployment
    "genlayer-adjudicator": "0x0000000000000000000000000000000000000000" as Address, // TBD
  },
};
