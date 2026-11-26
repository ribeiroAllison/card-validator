import { readFile } from "node:fs/promises";
import { config, azdoEnabled } from "./config.js";
import type { Card, CardSummary } from "./types.js";

/** Origem dos cards: Azure DevOps de verdade ou os exemplos locais (modo demo). */
export interface CardSource {
  mode: "azdo" | "demo";
  list(): Promise<CardSummary[]>;
  get(id: number): Promise<Card>;
  /** Publica um comentário (HTML) no card. */
  comment(id: number, html: string): Promise<{ published: boolean; url?: string }>;
}

export { HttpError } from "./errors.js";
import { HttpError } from "./errors.js";

// ---------------------------------------------------------------------------
// Modo demo
// ---------------------------------------------------------------------------
class DemoSource implements CardSource {
  mode = "demo" as const;
  private cache?: Card[];

  private async all(): Promise<Card[]> {
    this.cache ??= JSON.parse(await readFile(config.paths.samples, "utf8")) as Card[];
    return this.cache;
  }
  async list() {
    return (await this.all()).map(({ id, title, type, state }) => ({ id, title, type, state }));
  }
  async get(id: number) {
    const card = (await this.all()).find((c) => c.id === id);
    if (!card) throw new HttpError(404, `Card ${id} não encontrado nos exemplos.`);
    return card;
  }
  async comment() {
    // Em modo demo não há onde publicar; o front mostra a prévia do comentário.
    return { published: false };
  }
}

// ---------------------------------------------------------------------------
// Azure DevOps (REST API 7.1)
// ---------------------------------------------------------------------------
const API = "7.1";
const CLOSED_STATES = ["Closed", "Done", "Removed", "Resolved", "Fechado", "Concluído", "Removido"];
const CARD_TYPES = ["User Story", "Product Backlog Item", "Bug", "Requirement", "História de Usuário"];

class AzureDevOpsSource implements CardSource {
  mode = "azdo" as const;
  private base: string;
  private auth: string;

  constructor(private org: string, private project: string, pat: string) {
    this.base = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis`;
    this.auth = "Basic " + Buffer.from(":" + pat).toString("base64");
  }

  private async request<T>(url: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(url, {
      ...init,
      headers: { Authorization: this.auth, "Content-Type": "application/json", ...init.headers },
    }).catch((e: Error) => {
      throw new HttpError(502, `Não foi possível conectar ao Azure DevOps (${e.message}). Verifique a internet, a VPN ou o proxy.`);
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const hint =
        res.status === 401 || res.status === 203
          ? " Verifique o AZDO_PAT (validade e escopo Work Items: Read & write)."
          : "";
      throw new HttpError(res.status === 404 ? 404 : 502, `Azure DevOps respondeu ${res.status}.${hint} ${body.slice(0, 300)}`);
    }
    // PAT inválido às vezes devolve 203 com a página de login em HTML
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("json")) {
      throw new HttpError(502, "Azure DevOps não devolveu JSON. Verifique o AZDO_PAT e o nome da organização.");
    }
    return (await res.json()) as T;
  }

  async list(): Promise<CardSummary[]> {
    const quote = (s: string) => `'${s.replace(/'/g, "''")}'`;
    const query = `SELECT [System.Id] FROM WorkItems
      WHERE [System.TeamProject] = @project
        AND [System.WorkItemType] IN (${CARD_TYPES.map(quote).join(", ")})
        AND [System.State] NOT IN (${CLOSED_STATES.map(quote).join(", ")})
      ORDER BY [System.ChangedDate] DESC`;
    const wiql = await this.request<{ workItems: { id: number }[] }>(
      `${this.base}/wit/wiql?$top=50&api-version=${API}`,
      { method: "POST", body: JSON.stringify({ query }) },
    );
    const ids = wiql.workItems.map((w) => w.id);
    if (ids.length === 0) return [];
    const fields = ["System.Id", "System.Title", "System.WorkItemType", "System.State"].join(",");
    const batch = await this.request<{ value: { id: number; fields: Record<string, string> }[] }>(
      `https://dev.azure.com/${encodeURIComponent(this.org)}/_apis/wit/workitems?ids=${ids.join(",")}&fields=${fields}&api-version=${API}`,
    );
    const byId = new Map(batch.value.map((w) => [w.id, w]));
    return ids
      .map((id) => byId.get(id))
      .filter((w): w is NonNullable<typeof w> => Boolean(w))
      .map((w) => ({
        id: w.id,
        title: w.fields["System.Title"],
        type: w.fields["System.WorkItemType"],
        state: w.fields["System.State"],
      }));
  }

  async get(id: number): Promise<Card> {
    const w = await this.request<{ id: number; fields: Record<string, string>; _links?: { html?: { href: string } } }>(
      `${this.base}/wit/workitems/${id}?$expand=links&api-version=${API}`,
    );
    const f = w.fields;
    return {
      id: w.id,
      title: f["System.Title"] ?? "",
      type: f["System.WorkItemType"] ?? "",
      state: f["System.State"] ?? "",
      // Bugs costumam usar Repro Steps no lugar de Description
      description: f["System.Description"] || f["Microsoft.VSTS.TCM.ReproSteps"] || "",
      acceptanceCriteria: f["Microsoft.VSTS.Common.AcceptanceCriteria"] ?? "",
      url: w._links?.html?.href,
    };
  }

  async comment(id: number, html: string) {
    await this.request(`${this.base}/wit/workItems/${id}/comments?api-version=${API}-preview.4`, {
      method: "POST",
      body: JSON.stringify({ text: html }),
    });
    return { published: true };
  }
}

export function createCardSource(): CardSource {
  return azdoEnabled()
    ? new AzureDevOpsSource(config.azdo.org, config.azdo.project, config.azdo.pat)
    : new DemoSource();
}
