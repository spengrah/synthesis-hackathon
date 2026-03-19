import { readFile, writeFile } from "node:fs/promises";
import type { BonfiresClient } from "./client.js";
import type { CreateEntityRequest } from "./types.js";

export class UuidRegistry {
  private map = new Map<string, string>();
  private dirty = false;

  constructor(private filePath: string) {}

  async load(): Promise<void> {
    try {
      const data = await readFile(this.filePath, "utf-8");
      const entries = JSON.parse(data) as Record<string, string>;
      for (const [name, uuid] of Object.entries(entries)) {
        this.map.set(name, uuid);
      }
    } catch {
      // File doesn't exist yet — start fresh
    }
  }

  get(name: string): string | undefined {
    return this.map.get(name);
  }

  set(name: string, uuid: string): void {
    this.map.set(name, uuid);
    this.dirty = true;
  }

  has(name: string): boolean {
    return this.map.has(name);
  }

  async save(): Promise<void> {
    if (!this.dirty) return;
    const obj = Object.fromEntries(this.map);
    await writeFile(this.filePath, JSON.stringify(obj, null, 2));
    this.dirty = false;
  }

  /**
   * Return existing UUID if known, otherwise create the entity and store the UUID.
   */
  async ensureEntity(
    client: BonfiresClient,
    req: CreateEntityRequest,
  ): Promise<string> {
    const existing = this.map.get(req.name);
    if (existing) return existing;

    const { uuid } = await client.createEntity(req);
    this.set(req.name, uuid);
    return uuid;
  }
}
