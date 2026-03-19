import type { Address } from "viem";
import {
  compile,
  createDefaultRegistry,
  BASE_MAINNET_CONFIG,
  type TZSchemaDocument,
  type CompilerConfig,
} from "@trust-zones/compiler";
import type { ProposalData } from "@trust-zones/sdk";
import { USDC, PRE_DEPLOYED } from "./constants.js";

const registry = createDefaultRegistry();

/**
 * Create the initial proposal TZSchemaDocument for the demo scenario.
 * Reciprocal data exchange with staking bonds on each zone.
 */
export function createProposalSchemaDoc(
  partyA: Address,
  partyB: Address,
  adjudicator: Address,
  deadline: number,
): TZSchemaDocument {
  return {
    version: "0.1.0",
    zones: [
      {
        actor: { address: partyA, agentId: 0 },
        hatMaxSupply: 1,
        hatDetails: "Zone A — Market Data Provider",
        incentives: [
          {
            template: "staking",
            params: { token: USDC, minStake: "1000000", cooldownPeriod: 86400 },
          },
        ],
        permissions: [
          { resource: "social-graph-read", value: 100, period: "hour", params: { purpose: "Access social graph data from Party B" } },
        ],
        responsibilities: [
          { obligation: "Provide market data with <5s latency", criteria: "99.5% uptime" },
        ],
        directives: [
          { rule: "Do not re-publish or redistribute received data to third parties", severity: "high" },
          { rule: "Do not use received data to produce outputs that harm individuals or groups", severity: "high" },
        ],
      },
      {
        actor: { address: partyB, agentId: 0 },
        hatMaxSupply: 1,
        hatDetails: "Zone B — Social Graph Provider",
        incentives: [
          {
            template: "staking",
            params: { token: USDC, minStake: "1000000", cooldownPeriod: 86400 },
          },
        ],
        permissions: [
          { resource: "market-data-read", value: 50, period: "hour", params: { purpose: "Access market data from Party A" } },
        ],
        responsibilities: [
          { obligation: "Provide social graph data", criteria: "99% uptime" },
        ],
        directives: [
          { rule: "Do not re-publish or redistribute received data to third parties", severity: "high" },
          { rule: "Do not use received data to produce outputs that harm individuals or groups", severity: "high" },
        ],
      },
    ],
    adjudicator: { address: adjudicator },
    deadline,
  };
}

/**
 * Create a counter-proposal with modified rate limits (partyB wants higher limits).
 */
export function createCounterSchemaDoc(
  partyA: Address,
  partyB: Address,
  adjudicator: Address,
  deadline: number,
): TZSchemaDocument {
  const doc = createProposalSchemaDoc(partyA, partyB, adjudicator, deadline);

  // partyB counters: wants higher rate limit on their access to market data
  doc.zones[1].permissions = [
    { resource: "market-data-read", value: 200, period: "hour", params: { purpose: "Access market data from Party A — increased limit" } },
  ];

  return doc;
}

/**
 * Compile a TZSchemaDocument into ProposalData using real module addresses.
 */
export function compileSchemaDoc(doc: TZSchemaDocument): ProposalData {
  const config: CompilerConfig = {
    ...BASE_MAINNET_CONFIG,
    modules: {
      ...BASE_MAINNET_CONFIG.modules,
      staking: PRE_DEPLOYED.stakingEligibility,
    },
  };
  return compile(doc, config, registry);
}

/** The minStake value used in the demo scenario (1 USDC = 1_000_000 with 6 decimals). */
export const DEMO_MIN_STAKE = 1_000_000n;
