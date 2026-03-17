import { TemplateRegistry } from "../registry.js";
import { budgetCapTemplate } from "./budget-cap.js";
import { targetAllowlistTemplate } from "./target-allowlist.js";
import { timeLockTemplate } from "./time-lock.js";
import { stakingTemplate } from "./staking.js";
import { reputationGateTemplate } from "./reputation-gate.js";
import { erc20BalanceTemplate } from "./erc20-balance.js";
import { allowlistTemplate } from "./allowlist.js";
import { hatWearingTemplate } from "./hat-wearing.js";

export function createDefaultRegistry(): TemplateRegistry {
  const registry = new TemplateRegistry();
  registry.register(budgetCapTemplate);
  registry.register(targetAllowlistTemplate);
  registry.register(timeLockTemplate);
  registry.register(stakingTemplate);
  registry.register(reputationGateTemplate);
  registry.register(erc20BalanceTemplate);
  registry.register(allowlistTemplate);
  registry.register(hatWearingTemplate);
  return registry;
}

export {
  budgetCapTemplate,
  targetAllowlistTemplate,
  timeLockTemplate,
  stakingTemplate,
  reputationGateTemplate,
  erc20BalanceTemplate,
  allowlistTemplate,
  hatWearingTemplate,
};
