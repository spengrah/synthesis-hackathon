import type {
  CreateEntityRequest,
  CreateEdgeRequest,
  CreateEpisodeRequest,
  DelveRequest,
  DelveResult,
  ExpandResult,
} from "./types.js";

export interface BonfiresClientConfig {
  apiUrl: string;
  apiKey: string;
  bonfireId: string;
  agentId?: string;
}

export class BonfiresClient {
  private apiUrl: string;
  private apiKey: string;
  readonly bonfireId: string;
  private agentId: string | undefined;

  constructor(config: BonfiresClientConfig) {
    this.apiUrl = config.apiUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey;
    this.bonfireId = config.bonfireId;
    this.agentId = config.agentId;
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.apiUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Bonfires ${path} failed: ${res.status} ${res.statusText} — ${text}`,
      );
    }

    return (await res.json()) as T;
  }

  async createEntity(
    req: CreateEntityRequest,
  ): Promise<{ uuid: string }> {
    const body = {
      ...req,
      bonfire_id: req.bonfire_id ?? this.bonfireId,
      agent_id: req.agent_id ?? this.agentId,
    };
    const result = await this.request<{ success: boolean; entity: { uuid: string } }>(
      "/knowledge_graph/entity",
      body,
    );
    return { uuid: result.entity.uuid };
  }

  async createEdge(
    req: CreateEdgeRequest,
  ): Promise<{ uuid: string }> {
    const result = await this.request<{ success: boolean; edge: { uuid: string } }>(
      "/knowledge_graph/edge",
      req,
    );
    return { uuid: result.edge.uuid };
  }

  async createEpisode(
    req: Omit<CreateEpisodeRequest, "bonfire_id"> & { bonfire_id?: string },
  ): Promise<{ uuid: string }> {
    const body: CreateEpisodeRequest = {
      ...req,
      bonfire_id: req.bonfire_id ?? this.bonfireId,
    };
    const result = await this.request<{ success: boolean; episode: { uuid: string } }>(
      "/knowledge_graph/episode/create",
      body,
    );
    return { uuid: result.episode.uuid };
  }

  async delve(
    req: Omit<DelveRequest, "bonfire_id"> & { bonfire_id?: string },
  ): Promise<DelveResult> {
    return this.request<DelveResult>("/delve", {
      ...req,
      bonfire_id: req.bonfire_id ?? this.bonfireId,
    });
  }

  async expandEntity(req: {
    entity_uuid: string;
    limit?: number;
  }): Promise<ExpandResult> {
    return this.request<ExpandResult>("/knowledge_graph/expand/entity", {
      ...req,
      bonfire_id: this.bonfireId,
    });
  }

  async createAgent(req: {
    username: string;
    name: string;
    bonfireId?: string;
    isActive?: boolean;
    context?: string;
  }): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("/agents", {
      ...req,
      bonfireId: req.bonfireId ?? this.bonfireId,
      isActive: req.isActive ?? true,
    });
  }

  async registerAgent(req: {
    agent_id: string;
    bonfire_id?: string;
  }): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("/agents/register", {
      ...req,
      bonfire_id: req.bonfire_id ?? this.bonfireId,
    });
  }
}
