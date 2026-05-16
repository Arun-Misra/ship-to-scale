/**
 * Typed fetch wrappers for all REST endpoints from api-contract.json.
 * All functions throw on non-2xx responses.
 */
import type { QualityReport, DashboardSummary, Signal, FinalResult } from "@/types";

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

export async function registerConnection(jwt: string, body: { kind: "postgres" | "demo"; dsn?: string; label: string }) {
  return apiFetch<{ connection_id: string }>("/connections", jwt, { method: "POST", body: JSON.stringify(body) });
}

export async function getSchema(jwt: string, connectionId: string) {
  return apiFetch(`/connections/${connectionId}/schema`, jwt);
}

export async function getQualityReport(jwt: string, connectionId: string): Promise<QualityReport> {
  return apiFetch<QualityReport>(`/connections/${connectionId}/quality`, jwt);
}

export async function startInvestigation(jwt: string, body: { connection_id: string; question: string }) {
  return apiFetch<{ investigation_id: string }>("/investigations", jwt, { method: "POST", body: JSON.stringify(body) });
}

export async function getInvestigation(jwt: string, investigationId: string): Promise<FinalResult> {
  return apiFetch<FinalResult>(`/investigations/${investigationId}`, jwt);
}

export async function getSignals(jwt: string): Promise<{ signals: Signal[] }> {
  return apiFetch<{ signals: Signal[] }>("/signals", jwt);
}

export async function getSemanticDefs(jwt: string) {
  return apiFetch("/semantic", jwt);
}

export async function getDashboard(jwt: string): Promise<DashboardSummary> {
  return apiFetch<DashboardSummary>("/dashboard", jwt);
}

export async function dispatchWeeklyReport(jwt: string) {
  return apiFetch("/reports/weekly/dispatch", jwt, { method: "POST" });
}

export async function getSlackInstallUrl(jwt: string, workspaceId: string) {
  return apiFetch<{ url: string }>(`/slack/install-url?workspace_id=${workspaceId}`, jwt);
}
