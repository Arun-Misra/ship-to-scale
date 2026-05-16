/**
 * P4 — SSE stream consumer hook.
 *
 * RULES (from TRD §2.3):
 * - Use fetch + ReadableStream, NEVER EventSource (auto-reconnect = restarts from step 1)
 * - AbortController MUST live in useRef (not local variable — double-click creates orphan controllers)
 * - AbortError = silent clean exit, NOT an error to show the user
 * - reasoning events: append to buffer, NEVER JSON.parse
 * - All other events: JSON.parse guaranteed to succeed (backend invariant)
 * - Abort old stream before starting new one (double-click safe)
 */
import { useRef, useReducer, useCallback, useEffect } from "react";
import type { InvestigationState, StepState } from "@/types";

const BASE = import.meta.env.VITE_API_URL ?? "/api/v1";

type StreamAction =
  | { type: "step_start"; payload: { step: number; budget_remaining: number } }
  | { type: "reasoning"; step: number; text: string }
  | { type: "action"; payload: Record<string, unknown> }
  | { type: "observation"; payload: Record<string, unknown> }
  | { type: "step_end"; payload: { step: number } }
  | { type: "final"; payload: Record<string, unknown> }
  | { type: "error"; payload: { code: string; message: string } }
  | { type: "reset"; question: string };

function reducer(state: InvestigationState, action: StreamAction): InvestigationState {
  switch (action.type) {
    case "reset":
      return { investigationId: null, question: action.question, steps: [], final: null, error: null, isStreaming: true };
    case "step_start": {
      const newStep: StepState = { step: action.payload.step, budgetRemaining: action.payload.budget_remaining, action: null, observation: null, reasoning: "" };
      return { ...state, steps: [...state.steps, newStep] };
    }
    case "reasoning": {
      const steps = state.steps.map((s) =>
        s.step === action.step ? { ...s, reasoning: s.reasoning + action.text } : s
      );
      return { ...state, steps };
    }
    case "action": {
      const steps = state.steps.map((s) =>
        s.step === (action.payload.step as number) ? { ...s, action: action.payload as never } : s
      );
      return { ...state, steps };
    }
    case "observation": {
      const steps = state.steps.map((s) =>
        s.step === (action.payload.step as number) ? { ...s, observation: action.payload as never } : s
      );
      return { ...state, steps };
    }
    case "final":
      return { ...state, final: action.payload as never, isStreaming: false };
    case "error":
      return { ...state, error: action.payload.message, isStreaming: false };
    default:
      return state;
  }
}

const initialState: InvestigationState = {
  investigationId: null, question: "", steps: [], final: null, error: null, isStreaming: false,
};

export function useInvestigationStream() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const abortRef = useRef<AbortController | null>(null);
  const currentStep = useRef<number>(0);

  const startStream = useCallback(async (investigationId: string, jwt: string, question: string) => {
    // Abort any in-flight stream (double-click safe)
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    dispatch({ type: "reset", question });

    try {
      const response = await fetch(`${BASE}/investigations/${investigationId}/stream`, {
        headers: { Authorization: `Bearer ${jwt}` },
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`Stream request failed: ${response.status}`);

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop()!; // keep incomplete trailing frame

        for (const frame of frames) {
          if (!frame.trim()) continue;

          const eventMatch = frame.match(/^event: (.+)$/m);
          const dataMatch = frame.match(/^data: (.+)$/ms);

          if (!eventMatch || !dataMatch) continue; // keepalive comment or malformed — skip

          const eventType = eventMatch[1].trim();
          const dataStr = dataMatch[1].trim();

          if (eventType === "reasoning") {
            // NEVER JSON.parse — opaque text
            dispatch({ type: "reasoning", step: currentStep.current, text: dataStr.replace(/\\n/g, "\n") });
          } else {
            // All structured events are guaranteed complete JSON (backend invariant)
            const payload = JSON.parse(dataStr);
            if (eventType === "step_start") currentStep.current = payload.step;
            // Inject current step into action payload — backend Action schemas don't include a step field
            const enriched = eventType === "action"
              ? { ...payload, step: currentStep.current }
              : payload;
            dispatch({ type: eventType as StreamAction["type"], payload: enriched } as StreamAction);
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return; // clean exit — user navigated away or asked a new question
      }
      dispatch({ type: "error", payload: { code: "stream_error", message: "Stream connection lost. Please try again." } });
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // Clean up on unmount
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  return { state, startStream, stop };
}
