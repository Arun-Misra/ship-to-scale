import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAppwrite } from "@/hooks/useAppwrite";
import AuthPage from "@/pages/AuthPage";
import DashboardPage from "@/pages/DashboardPage";
import HomePage from "@/pages/HomePage";
import InvestigationPage from "@/pages/InvestigationPage";
import QualityPage from "@/pages/QualityPage";
import SignalsPage from "@/pages/SignalsPage";
import SemanticPage from "@/pages/SemanticPage";
import { Sidebar } from "@/components/layout/Sidebar";

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-950 text-gray-100">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}

export default function App() {
  const { session, loading } = useAppwrite();

  if (loading) return <div className="flex h-screen items-center justify-center text-gray-400">Loading...</div>;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        {session ? (
          <>
            <Route path="/dashboard" element={<AppShell><DashboardPage /></AppShell>} />
            <Route path="/investigate" element={<AppShell><InvestigationPage /></AppShell>} />
            <Route path="/quality/:connectionId" element={<AppShell><QualityPage /></AppShell>} />
            <Route path="/signals" element={<AppShell><SignalsPage /></AppShell>} />
            <Route path="/semantic" element={<AppShell><SemanticPage /></AppShell>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        ) : (
          <Route path="*" element={<AuthPage />} />
        )}
      </Routes>
    </BrowserRouter>
  );
}
