/**
 * P6 [STUB] — Signals feed: pre-computed anomalies.
 * Owner: FE
 */
import { useEffect, useState } from "react";
import { useAppwrite } from "@/hooks/useAppwrite";
import { getSignals } from "@/api/client";
import type { Signal } from "@/types";
import { formatDate } from "@/lib/utils";

export default function SignalsPage() {
  const { session } = useAppwrite();
  const [signals, setSignals] = useState<Signal[]>([]);

  useEffect(() => {
    if (session) getSignals(session.jwt).then((d) => setSignals(d.signals)).catch(() => {});
  }, [session]);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Signals</h1>
      <div className="space-y-3">
        {signals.map((s) => (
          <div key={s.id} className="p-4 bg-gray-900 rounded-lg border border-gray-800">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded-full ${s.severity === "high" ? "bg-red-900 text-red-300" : "bg-yellow-900 text-yellow-300"}`}>
                {s.severity}
              </span>
              <span className="text-sm font-medium">{s.metric}</span>
              <span className="text-xs text-gray-500 ml-auto">{formatDate(s.detected_at)}</span>
            </div>
            <p className="text-sm text-gray-300">{s.description}</p>
          </div>
        ))}
        {!signals.length && <p className="text-gray-500 text-sm">No signals yet — monitoring is watching.</p>}
      </div>
    </div>
  );
}
