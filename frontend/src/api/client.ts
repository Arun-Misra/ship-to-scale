/**
 * Typed fetch wrappers for all REST endpoints.
 * All functions throw on non-2xx responses.
 */
import type {
  QualityReport,
  DashboardSummary,
  Signal,
  FinalResult,
  Connection,
  SemanticDef,
  InvestigationRecord,
} from "@/types";

const BASE = import.meta.env.VITE_API_URL ?? "/api/v1";

async function apiFetch<T>(path: string, jwt: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "API error");
  }
  return res.json() as Promise<T>;
}

export async function getHealth() {
  const res = await fetch(`${BASE}/health`);
  return res.json();
}

// ── Connections ────────────────────────────────────────────────────────────────

export async function getConnections(jwt: string): Promise<{ connections: Connection[] }> {
  return apiFetch<{ connections: Connection[] }>("/connections", jwt);
}

export async function registerConnection(
  jwt: string,
  body: { kind: "postgres" | "demo"; dsn?: string; label: string }
) {
  return apiFetch<{ connection_id: string }>("/connections", jwt, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getSchema(jwt: string, connectionId: string) {
  return apiFetch(`/connections/${connectionId}/schema`, jwt);
}

export async function getQualityReport(jwt: string, connectionId: string): Promise<QualityReport> {
  return apiFetch<QualityReport>(`/connections/${connectionId}/quality`, jwt);
}

// ── Investigations ─────────────────────────────────────────────────────────────

export async function startInvestigation(
  jwt: string,
  body: { connection_id: string; question: string }
) {
  return apiFetch<{ investigation_id: string }>("/investigations", jwt, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function listInvestigations(jwt: string): Promise<{ investigations: InvestigationRecord[] }> {
  return apiFetch<{ investigations: InvestigationRecord[] }>("/investigations", jwt);
}

export async function getInvestigation(jwt: string, investigationId: string): Promise<InvestigationRecord> {
  return apiFetch<InvestigationRecord>(`/investigations/${investigationId}`, jwt);
}

// ── Signals ───────────────────────────────────────────────────────────────────

export async function getSignals(jwt: string): Promise<{ signals: Signal[] }> {
  return apiFetch<{ signals: Signal[] }>("/signals", jwt);
}

// ── Semantic ──────────────────────────────────────────────────────────────────

export async function getSemanticDefs(jwt: string): Promise<{ definitions: SemanticDef[] }> {
  return apiFetch<{ definitions: SemanticDef[] }>("/semantic", jwt);
}

export async function createSemanticDef(
  jwt: string,
  body: {
    term: string;
    natural_language: string;
    definition_sql: string;
    source?: string;
    materiality?: string;
  }
): Promise<{ status: string }> {
  return apiFetch<{ status: string }>("/semantic", jwt, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function deleteSemanticDef(jwt: string, defId: string): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(`/semantic/${defId}`, jwt, { method: "DELETE" });
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getDashboard(jwt: string): Promise<DashboardSummary> {
  return apiFetch<DashboardSummary>("/dashboard", jwt);
}

// ── Reports & Slack ───────────────────────────────────────────────────────────

export async function dispatchWeeklyReport(jwt: string) {
  return apiFetch("/reports/weekly/dispatch", jwt, { method: "POST" });
}

export async function getSlackInstallUrl(jwt: string, workspaceId: string) {
  return apiFetch<{ url: string }>(`/slack/install-url?workspace_id=${workspaceId}`, jwt);
}
