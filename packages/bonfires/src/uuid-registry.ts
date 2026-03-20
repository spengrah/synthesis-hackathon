import { readFile, writeFile } from "node:fs/promises";
import type { BonfiresClient } from "./client.js";
import type { CreateEntityRequest, CreateEdgeRequest } from "./types.js";

interface RegistryData {
  entities: Record<string, string>;
  edges: string[];
}

export class UuidRegistry {
  private map = new Map<string, string>();
  private edges = new Set<string>();
  private inflight = new Map<string, Promise<string>>();
  private dirty = false;

  constructor(private filePath: string) {}

  async load(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, "utf-8");
      const data = JSON.parse(raw);

      // Support both old format (flat object) and new format ({ entities, edges })
      if (data.entities) {
        const typed = data as RegistryData;
        for (const [name, uuid] of Object.entries(typed.entities)) {
          this.map.set(name, uuid);
        }
        for (const key of typed.edges) {
          this.edges.add(key);
        }
      } else {
        // Legacy: flat { name: uuid } object
        for (const [name, uuid] of Object.entries(data as Record<string, string>)) {
          this.map.set(name, uuid);
        }
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

  /** Returns true if this edge has already been created. */
  hasEdge(source: string, target: string, edgeName: string): boolean {
    return this.edges.has(`${source}:${target}:${edgeName}`);
  }

  /** Mark an edge as created. */
  addEdge(source: string, target: string, edgeName: string): void {
    this.edges.add(`${source}:${target}:${edgeName}`);
    this.dirty = true;
  }

  async save(): Promise<void> {
    if (!this.dirty) return;
    const data: RegistryData = {
      entities: Object.fromEntries(this.map),
      edges: [...this.edges],
    };
    await writeFile(this.filePath, JSON.stringify(data, null, 2));
    this.dirty = false;
  }

  /**
   * Return existing UUID if known, otherwise create the entity and store the UUID.
   * Safe for concurrent calls with the same name — deduplicates in-flight requests.
   */
  async ensureEntity(
    client: BonfiresClient,
    req: CreateEntityRequest,
  ): Promise<string> {
    const existing = this.map.get(req.name);
    if (existing) return existing;

    const pending = this.inflight.get(req.name);
    if (pending) return pending;

    const promise = client.createEntity(req).then(({ uuid }) => {
      this.set(req.name, uuid);
      this.inflight.delete(req.name);
      return uuid;
    });
    this.inflight.set(req.name, promise);
    return promise;
  }

  /**
   * Create an edge if not already created. Returns true if created, false if skipped.
   */
  async ensureEdge(
    client: BonfiresClient,
    req: CreateEdgeRequest,
  ): Promise<boolean> {
    if (this.hasEdge(req.source_uuid, req.target_uuid, req.edge_name)) {
      return false;
    }

    await client.createEdge(req);
    this.addEdge(req.source_uuid, req.target_uuid, req.edge_name);
    return true;
  }
}
