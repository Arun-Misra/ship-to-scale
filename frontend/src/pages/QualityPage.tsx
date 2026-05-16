/**
 * P5 — Data quality scan results page.
 * Read-only: shows problems, no fix buttons, no auto-apply.
 * Owner: FE
 */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAppwrite } from "@/hooks/useAppwrite";
import { getQualityReport } from "@/api/client";
import type { QualityReport } from "@/types";
import { QualityReportView } from "@/components/quality/QualityReport";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

export default function QualityPage() {
  const { connectionId } = useParams<{ connectionId: string }>();
  const { session } = useAppwrite();
  const [report, setReport] = useState<QualityReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session && connectionId) {
      getQualityReport(session.jwt, connectionId)
        .then(setReport)
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [session, connectionId]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Data Quality Report</h1>
      <p className="text-sm text-gray-400 mb-6">
        We see these problems. We never touch your data — you decide what to do with them.
      </p>
      {report ? <QualityReportView report={report} /> : <p className="text-gray-500">No report available.</p>}
    </div>
  );
}
