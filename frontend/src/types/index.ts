// Shared TypeScript types — mirrors the Pydantic schemas in backend/app/agent/schemas.py

export type ChartType = "line" | "bar" | "area" | "scatter" | "pie";

export interface ChartConfig {
  chart_type: ChartType;
  x_axis: string;
  y_axis: string;
  series_label: string;
}

export type ActionType = "sql_query" | "conclude" | "clarify";
export type Verdict = "confirmed" | "refuted" | "inconclusive";
export type Confidence = "low" | "medium" | "high";
export type ObservationStatus =
  | "ok"
  | "explain_error"
  | "exec_error"
  | "validation_error"
  | "timeout"
  | "row_cap";

export interface SqlQueryAction {
  type: "sql_query";
  step: number;
  sql: string;
  intent: string;
}

export interface ConcludeAction {
  type: "conclude";
  step: number;
  verdict: Verdict;
  root_cause: string;
  confidence: Confidence;
  recommended_action: string;
  chart: ChartConfig | null;
}

export interface ClarifyAction {
  type: "clarify";
  step: number;
  question: string;
}

export type Action = SqlQueryAction | ConcludeAction | ClarifyAction;

export interface Observation {
  step: number;
  status: ObservationStatus;
  row_count: number | null;
  columns: string[] | null;
  preview: unknown[][] | null;
  truncated: boolean;
  error: string | null;
}

export interface DefinitionReceipt {
  term: string;
  definition: string;
  source: string;
}

export interface FinalResult {
  investigation_id: string;
  verdict: Verdict;
  root_cause: string;
  confidence: Confidence;
  recommended_action: string;
  chart: ChartConfig | null;
  data: unknown[][];
  definition_receipts: DefinitionReceipt[];
}

export interface StepState {
  step: number;
  budgetRemaining: number;
  action: Action | null;
  observation: Observation | null;
  reasoning: string;
}

export interface InvestigationState {
  investigationId: string | null;
  question: string;
  steps: StepState[];
  final: FinalResult | null;
  error: string | null;
  isStreaming: boolean;
}

// Chat types
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  investigation_id?: string;
  status?: "streaming" | "done" | "needs_clarification";
  steps?: StepState[];
  final?: FinalResult | null;
  is_clarification?: boolean;
  timestamp?: string;
}

export interface ChatConversation {
  id: string;
  connection_id: string;
  messages: ChatMessage[];
}

// Quality scan types
export type IssueType =
  | "date_format_inconsistency"
  | "text_as_number"
  | "unexpected_nulls"
  | "likely_duplicates"
  | "cardinality_anomaly";

export type Severity = "high" | "medium" | "low";

export interface QualityIssue {
  id: string;
  type: IssueType;
  severity: Severity;
  table: string;
  column: string;
  affected_rows: number;
  examples: string[];
  message: string;
}

export interface QualityReport {
  connection_id: string;
  scanned_at: string;
  issues: QualityIssue[];
  summary: { high: number; medium: number; low: number };
}

// Signal types
export interface SignalInvestigation {
  verdict: Verdict;
  root_cause: string;
  confidence: Confidence;
  recommended_action: string;
  chart: ChartConfig | null;
  data: unknown[][];
}

export interface Signal {
  id: string;
  title: string;
  details: string;
  priority: "critical" | "warning" | "informational";
  detected_at: string;
  investigation: SignalInvestigation | null;
}

// Connection types
export interface Connection {
  id: string;
  label: string;
  kind: "postgres" | "demo";
}

// Semantic definition type
export interface SemanticDef {
  $id: string;
  term: string;
  natural_language: string;
  definition_sql: string;
  source: string;
  materiality: string;
}

// Investigation record (list/history)
export interface InvestigationRecord {
  id: string;
  question: string;
  connection_id: string;
  status: string;
  verdict: Verdict | null;
  root_cause: string | null;
  confidence: Confidence | null;
  recommended_action: string | null;
  created_at: string | null;
}

// Dashboard types
export interface DashboardSummary {
  connected_sources: number;
  connections: Array<{ id: string; label: string; kind: string }>;
  last_query_at: string | null;
  key_metrics: Array<{ label: string; value: string; trend: string | null }>;
  recent_conversations: Array<{
    id: string;
    title: string;
    message_count: number;
    connection_id: string;
  }>;
}
