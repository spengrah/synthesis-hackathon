import type { Address } from "viem";
import type { MechanismTemplate, CompilerConfig } from "./types.js";

export class TemplateRegistry {
  private templates = new Map<string, MechanismTemplate>();

  register(template: MechanismTemplate): void {
    this.templates.set(template.name, template);
  }

  get(name: string): MechanismTemplate | undefined {
    return this.templates.get(name);
  }

  /** Reverse-lookup: find the template whose config.modules entry matches the given address. */
  findByAddress(
    address: Address,
    config: CompilerConfig,
  ): MechanismTemplate | undefined {
    const lower = address.toLowerCase();
    for (const [name, addr] of Object.entries(config.modules)) {
      if (addr.toLowerCase() === lower) {
        return this.templates.get(name);
      }
    }
    return undefined;
  }

  names(): string[] {
    return Array.from(this.templates.keys());
  }
}
