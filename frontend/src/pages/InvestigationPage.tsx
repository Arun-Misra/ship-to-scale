import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, Database, Send, ChevronRight, HelpCircle, X } from "lucide-react";
import { useAppwrite } from "@/hooks/useAppwrite";
import { useChatStream } from "@/hooks/useChatStream";
import { startChat, getConnections, getChatHistory } from "@/api/client";
import { StepCard } from "@/components/investigation/StepCard";
import { FinalReport } from "@/components/investigation/FinalReport";
import type { Connection, ChatMessage } from "@/types";

const DEMO_CONNECTION: Connection = { id: "demo", label: "Demo dataset", kind: "demo" };

// ── Single AI message bubble ──────────────────────────────────────────────────

function AiMessageBubble({ msg }: { msg: ChatMessage }) {
  const [stepsOpen, setStepsOpen] = useState(false);
  const stepCount = msg.steps?.length ?? 0;
  const isStreaming = msg.status === "streaming";
  const isClarification = msg.is_clarification || msg.status === "needs_clarification";

  const bubbleBorder = isClarification
    ? "border-amber-600/50 bg-amber-950/30"
    : "border-gray-700 bg-gray-900";

  return (
    <div className="flex flex-col gap-2 max-w-[80%]">
      <div className={`rounded-2xl rounded-tl-sm border px-4 py-3 text-sm ${bubbleBorder}`}>
        {/* Streaming indicator */}
        {isStreaming && !msg.content && (
          <div className="flex items-center gap-1.5 text-gray-400">
            <span className="animate-bounce delay-0 w-1.5 h-1.5 bg-sky-400 rounded-full inline-block" />
            <span className="animate-bounce delay-75 w-1.5 h-1.5 bg-sky-400 rounded-full inline-block" />
            <span className="animate-bounce delay-150 w-1.5 h-1.5 bg-sky-400 rounded-full inline-block" />
            {/* Show latest reasoning while streaming */}
            {stepCount > 0 && msg.steps && msg.steps[msg.steps.length - 1].reasoning && (
              <span className="ml-2 font-mono text-xs text-gray-500 truncate max-w-xs">
                {msg.steps[msg.steps.length - 1].reasoning.slice(0, 80)}
                {msg.steps[msg.steps.length - 1].reasoning.length > 80 ? "…" : ""}
              </span>
            )}
          </div>
        )}

        {/* Main content */}
        {msg.content && (
          <p className={`leading-relaxed ${isClarification ? "text-amber-200" : "text-gray-100"}`}>
            {isClarification && (
              <HelpCircle className="inline-block w-4 h-4 mr-1.5 text-amber-400 shrink-0 align-text-bottom" />
            )}
            {msg.content}
          </p>
        )}
      </div>

      {/* SQL steps toggle */}
      {stepCount > 0 && (
        <div className="pl-1">
          <button
            onClick={() => setStepsOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <ChevronRight
              className={`w-3.5 h-3.5 transition-transform ${stepsOpen ? "rotate-90" : ""}`}
            />
            {stepCount} SQL step{stepCount !== 1 ? "s" : ""}
          </button>

          {stepsOpen && (
            <div className="mt-2 space-y-2 border-l-2 border-gray-700 pl-4">
              {msg.steps!.map((step) => (
                <StepCard key={step.step} step={step} />
              ))}
              {msg.final && (
                <div className="mt-2">
                  <FinalReport result={msg.final} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── User message bubble ───────────────────────────────────────────────────────

function UserMessageBubble({ msg }: { msg: ChatMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-gray-700 px-4 py-3 text-sm text-gray-100">
        {msg.content}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function InvestigationPage() {
  const { session } = useAppwrite();
  const { state, dispatch, streamResponse, stop, reset } = useChatStream();
  const [searchParams] = useSearchParams();

  const [input, setInput] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [connections, setConnections] = useState<Connection[]>([DEMO_CONNECTION]);
  const [selectedConn, setSelectedConn] = useState<Connection>(DEMO_CONNECTION);
  const [connOpen, setConnOpen] = useState(false);
  const connRef = useRef<HTMLDivElement>(null);
  const autoSentRef = useRef(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load connections, then apply ?conn= pre-selection if present
  useEffect(() => {
    if (!session) return;
    const connParam = searchParams.get("conn");
    getConnections(session.jwt)
      .then((res) => {
        const all: Connection[] = [
          DEMO_CONNECTION,
          ...res.connections.filter((c) => c.id !== "demo"),
        ];
        setConnections(all);
        if (connParam) {
          const match = all.find((c) => c.id === connParam);
          if (match) setSelectedConn(match);
        }
      })
      .catch(() => {/* keep default */});
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load existing conversation when ?c= param is present
  useEffect(() => {
    const convId = searchParams.get("c");
    if (!convId || !session) return;
    if (state.conversationId === convId) return; // already loaded
    getChatHistory(session.jwt, convId)
      .then((res) => {
        dispatch({
          type: "load_conversation",
          id: convId,
          messages: res.messages as ChatMessage[],
        });
      })
      .catch(() => {});
  }, [searchParams, session]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset when navigating to bare /chat (no ?c=)
  useEffect(() => {
    if (!searchParams.get("c")) {
      reset();
      autoSentRef.current = false;
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps


  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (connRef.current && !connRef.current.contains(e.target as Node)) {
        setConnOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages.length, state.isStreaming]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 88) + "px"; // max ~3 lines
  };

  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim() || state.isStreaming || !session) return;

    setInput("");
    setSubmitError(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    // Optimistically add user message
    const optimisticUserId = crypto.randomUUID();
    dispatch({
      type: "add_user_msg",
      msg: {
        id: optimisticUserId,
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
      },
    });

    try {
      const { conversation_id, message_id, investigation_id } = await startChat(
        session.jwt,
        {
          conversation_id: state.conversationId ?? undefined,
          connection_id: selectedConn.id,
          message,
        }
      );

      // Set conversation id if new
      if (!state.conversationId) {
        dispatch({ type: "set_conv_id", id: conversation_id });
      }

      // Add AI placeholder message
      dispatch({
        type: "add_ai_msg",
        msg: {
          id: message_id,
          role: "assistant",
          content: "",
          investigation_id,
          status: "streaming",
          steps: [],
          timestamp: new Date().toISOString(),
        },
      });

      // Stream the response
      await streamResponse(conversation_id, investigation_id, message_id, session.jwt);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to send message.");
    }
  }, [state.isStreaming, state.conversationId, session, selectedConn, dispatch, streamResponse]);

  // Wrapper used by keyboard handler and Send button — reads current input state
  const handleSend = useCallback(() => sendMessage(input), [sendMessage, input]);

  // Auto-send when arriving from a signal deep-link (?prompt=...)
  // searchParams.get() already decodes percent-encoding — do NOT call decodeURIComponent again
  useEffect(() => {
    const prompt = searchParams.get("prompt");
    if (!prompt || autoSentRef.current || !session || state.isStreaming) return;
    setInput(prompt);
    autoSentRef.current = true;
    // Small delay so selectedConn from the connections effect settles first
    const t = setTimeout(() => sendMessage(prompt), 200);
    return () => clearTimeout(t);
  }, [session, selectedConn]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };


  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 overflow-hidden">
      {/* ── Top bar ── */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 bg-gray-950 border-b border-gray-800">
        <h1 className="text-sm font-semibold text-gray-200 mr-auto">viriya chat</h1>

        {/* Connection selector */}
        <div className="relative" ref={connRef}>
          <button
            type="button"
            onClick={() => setConnOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-300 transition-colors hover:border-gray-600"
          >
            <Database className="h-3.5 w-3.5 text-gray-500 shrink-0" />
            <span className="max-w-[120px] truncate">{selectedConn.label}</span>
            <ChevronDown className="h-3 w-3 text-gray-500 shrink-0" />
          </button>
          {connOpen && (
            <div className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-gray-700 bg-gray-900 shadow-xl z-20">
              {connections.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setSelectedConn(c); setConnOpen(false); }}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-xs transition-colors hover:bg-gray-800 first:rounded-t-lg last:rounded-b-lg ${
                    c.id === selectedConn.id ? "text-sky-400" : "text-gray-300"
                  }`}
                >
                  <Database className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                  <div className="min-w-0">
                    <div className="truncate">{c.label}</div>
                    <div className="font-mono text-xs text-gray-500">{c.kind}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── Messages area ── */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {state.messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center max-w-sm">
              <p className="text-gray-400 text-sm">
                Connected to{" "}
                <span className="text-gray-200 font-medium">{selectedConn.label}</span>.
              </p>
              <p className="text-gray-500 text-sm mt-1">
                Ask anything about your data in plain English.
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6">
            {state.messages.map((msg) =>
              msg.role === "user" ? (
                <UserMessageBubble key={msg.id} msg={msg} />
              ) : (
                <div key={msg.id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-sky-500/20 border border-sky-500/40 flex items-center justify-center shrink-0">
                      <span className="text-xs text-sky-400 font-bold">v</span>
                    </div>
                    <span className="text-xs text-gray-500">viriya</span>
                  </div>
                  <div className="pl-8">
                    <AiMessageBubble msg={msg} />
                  </div>
                </div>
              )
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── Error banner ── */}
      {submitError && (
        <div className="shrink-0 mx-4 mb-2">
          <div className="flex items-center gap-2 rounded-lg border border-red-800 bg-red-950/50 px-4 py-2 text-xs text-red-300">
            <span className="flex-1">{submitError}</span>
            <button onClick={() => setSubmitError(null)}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Input bar ── */}
      <div className="shrink-0 border-t border-gray-800 bg-gray-950 px-4 py-3">
        <div className="mx-auto max-w-3xl flex items-end gap-3">
          <div className="flex-1 rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 focus-within:border-sky-500/50 transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask a Question... (Enter to send, Shift+Enter for newline)"
              rows={1}
              disabled={state.isStreaming}
              className="w-full resize-none bg-transparent text-sm text-gray-100 placeholder-gray-500 outline-none leading-relaxed disabled:opacity-50"
            />
          </div>

          {state.isStreaming ? (
            <button
              type="button"
              onClick={stop}
              className="shrink-0 flex items-center gap-2 rounded-xl bg-gray-700 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-600"
            >
              <X className="h-4 w-4" />
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || !session}
              className="shrink-0 flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
