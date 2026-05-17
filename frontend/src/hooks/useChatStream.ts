/**
 * Multi-turn chat stream hook.
 *
 * RULES (same as useInvestigationStream):
 * - Use fetch + ReadableStream, NEVER EventSource
 * - AbortController in useRef (not local variable)
 * - AbortError = silent clean exit
 * - reasoning events: append raw text, NEVER JSON.parse
 * - All other events: JSON.parse guaranteed to succeed
 */
import { useRef, useReducer, useCallback, useEffect } from "react";
import type { ChatMessage, StepState, FinalResult } from "@/types";

const BASE = import.meta.env.VITE_API_URL ?? "/api/v1";

interface ChatState {
  conversationId: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;
}

type ChatAction =
  | { type: "reset" }
  | { type: "set_conv_id"; id: string }
  | { type: "load_conversation"; id: string; messages: ChatMessage[] }
  | { type: "add_user_msg"; msg: ChatMessage }
  | { type: "add_ai_msg"; msg: ChatMessage }
  | { type: "step_start"; msgId: string; step: StepState }
  | { type: "reasoning"; msgId: string; stepIdx: number; text: string }
  | { type: "step_action"; msgId: string; stepIdx: number; action: unknown }
  | { type: "step_observation"; msgId: string; stepIdx: number; obs: unknown }
  | { type: "final"; msgId: string; final: FinalResult }
  | { type: "chat_response"; msgId: string; text: string }
  | { type: "clarification"; msgId: string; question: string }
  | { type: "stream_error"; msgId: string; message: string }
  | { type: "done_streaming" };

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "reset":
      return { conversationId: null, messages: [], isStreaming: false };
    case "set_conv_id":
      return { ...state, conversationId: action.id };
    case "load_conversation":
      return { conversationId: action.id, messages: action.messages, isStreaming: false };
    case "add_user_msg":
      return { ...state, messages: [...state.messages, action.msg] };
    case "add_ai_msg":
      return { ...state, messages: [...state.messages, action.msg], isStreaming: true };
    case "step_start": {
      const messages = state.messages.map((m) =>
        m.id === action.msgId
          ? { ...m, steps: [...(m.steps ?? []), action.step] }
          : m
      );
      return { ...state, messages };
    }
    case "reasoning": {
      const messages = state.messages.map((m) => {
        if (m.id !== action.msgId) return m;
        const steps = (m.steps ?? []).map((s, i) =>
          i === action.stepIdx ? { ...s, reasoning: s.reasoning + action.text } : s
        );
        return { ...m, steps };
      });
      return { ...state, messages };
    }
    case "step_action": {
      const messages = state.messages.map((m) => {
        if (m.id !== action.msgId) return m;
        const steps = (m.steps ?? []).map((s, i) =>
          i === action.stepIdx ? { ...s, action: action.action as never } : s
        );
        return { ...m, steps };
      });
      return { ...state, messages };
    }
    case "step_observation": {
      const messages = state.messages.map((m) => {
        if (m.id !== action.msgId) return m;
        const steps = (m.steps ?? []).map((s, i) =>
          i === action.stepIdx ? { ...s, observation: action.obs as never } : s
        );
        return { ...m, steps };
      });
      return { ...state, messages };
    }
    case "final": {
      const messages = state.messages.map((m) =>
        m.id === action.msgId ? { ...m, final: action.final } : m
      );
      return { ...state, messages };
    }
    case "chat_response": {
      const messages = state.messages.map((m) =>
        m.id === action.msgId
          ? { ...m, content: action.text, status: "done" as const }
          : m
      );
      return { ...state, messages, isStreaming: false };
    }
    case "clarification": {
      const messages = state.messages.map((m) =>
        m.id === action.msgId
          ? {
              ...m,
              content: action.question,
              status: "needs_clarification" as const,
              is_clarification: true,
            }
          : m
      );
      return { ...state, messages, isStreaming: false };
    }
    case "stream_error": {
      const messages = state.messages.map((m) =>
        m.id === action.msgId
          ? { ...m, content: action.message, status: "done" as const }
          : m
      );
      return { ...state, messages, isStreaming: false };
    }
    case "done_streaming":
      return { ...state, isStreaming: false };
    default:
      return state;
  }
}

const initialState: ChatState = {
  conversationId: null,
  messages: [],
  isStreaming: false,
};

export function useChatStream() {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const abortRef = useRef<AbortController | null>(null);
  const currentStepIdxRef = useRef<number>(-1);

  const streamResponse = useCallback(
    async (
      conversationId: string,
      investigationId: string,
      aiMsgId: string,
      jwt: string
    ) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      currentStepIdxRef.current = -1;

      try {
        const response = await fetch(
          `${BASE}/chat/${conversationId}/stream/${investigationId}`,
          {
            headers: { Authorization: `Bearer ${jwt}` },
            signal: controller.signal,
          }
        );
        if (!response.ok) throw new Error(`Stream failed: ${response.status}`);

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop()!;

          for (const frame of frames) {
            if (!frame.trim()) continue;

            const eventMatch = frame.match(/^event: (.+)$/m);
            const dataMatch = frame.match(/^data: (.+)$/ms);
            if (!eventMatch || !dataMatch) continue;

            const eventType = eventMatch[1].trim();
            const dataStr = dataMatch[1].trim();

            if (eventType === "reasoning") {
              // NEVER JSON.parse reasoning tokens
              dispatch({
                type: "reasoning",
                msgId: aiMsgId,
                stepIdx: currentStepIdxRef.current,
                text: dataStr.replace(/\\n/g, "\n"),
              });
            } else {
              const payload = JSON.parse(dataStr);

              if (eventType === "step_start") {
                currentStepIdxRef.current += 1;
                const newStep: StepState = {
                  step: payload.step,
                  budgetRemaining: payload.budget_remaining,
                  action: null,
                  observation: null,
                  reasoning: "",
                };
                dispatch({ type: "step_start", msgId: aiMsgId, step: newStep });
              } else if (eventType === "action") {
                dispatch({
                  type: "step_action",
                  msgId: aiMsgId,
                  stepIdx: currentStepIdxRef.current,
                  action: payload,
                });
              } else if (eventType === "observation") {
                dispatch({
                  type: "step_observation",
                  msgId: aiMsgId,
                  stepIdx: currentStepIdxRef.current,
                  obs: payload,
                });
              } else if (eventType === "final") {
                dispatch({ type: "final", msgId: aiMsgId, final: payload as FinalResult });
              } else if (eventType === "chat_response") {
                dispatch({ type: "chat_response", msgId: aiMsgId, text: payload.text });
              } else if (eventType === "clarification") {
                dispatch({ type: "clarification", msgId: aiMsgId, question: payload.question });
              } else if (eventType === "error") {
                dispatch({ type: "stream_error", msgId: aiMsgId, message: payload.message });
              }
            }
          }
        }
        dispatch({ type: "done_streaming" });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        dispatch({
          type: "stream_error",
          msgId: aiMsgId,
          message: "Connection lost. Please try again.",
        });
      }
    },
    []
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: "reset" });
  }, []);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  return { state, dispatch, streamResponse, stop, reset };
}
