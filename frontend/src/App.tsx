import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAppwrite } from "@/hooks/useAppwrite";
import AuthPage from "@/pages/AuthPage";
import DashboardPage from "@/pages/DashboardPage";
import InvestigationPage from "@/pages/InvestigationPage";
import QualityPage from "@/pages/QualityPage";
import SignalsPage from "@/pages/SignalsPage";
import SemanticPage from "@/pages/SemanticPage";
import { Sidebar } from "@/components/layout/Sidebar";

export default function App() {
  const { session, loading } = useAppwrite();

  if (loading) return <div className="flex h-screen items-center justify-center text-gray-400">Loading...</div>;
  if (!session) return <AuthPage />;

  return (
    <BrowserRouter>
      <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Navigate to="/investigate" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/investigate" element={<InvestigationPage />} />
              <Route path="/quality/:connectionId" element={<QualityPage />} />
              <Route path="/signals" element={<SignalsPage />} />
              <Route path="/semantic" element={<SemanticPage />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}
