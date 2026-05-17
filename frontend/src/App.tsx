import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAppwrite } from "@/hooks/useAppwrite";
import AuthPage from "@/pages/AuthPage";
import DashboardPage from "@/pages/DashboardPage";
import HomePage from "@/pages/HomePage";
import InvestigationPage from "@/pages/InvestigationPage";
import QualityPage from "@/pages/QualityPage";
import SignalsPage from "@/pages/SignalsPage";
import SemanticPage from "@/pages/SemanticPage";
import ConnectionsPage from "@/pages/ConnectionsPage";
import { Sidebar } from "@/components/layout/Sidebar";

function AppBackground() {
  return (
    <>
      {/* Dot grid */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.10) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      {/* Edge fade */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% 0%, transparent 40%, #030303 100%)",
        }}
      />
      {/* Sky-blue orb */}
      <div
        className="pointer-events-none fixed z-0"
        style={{
          top: "-15%",
          left: "35%",
          width: "700px",
          height: "700px",
          background:
            "radial-gradient(circle, rgba(14,165,233,0.07) 0%, rgba(99,102,241,0.03) 40%, transparent 65%)",
          borderRadius: "50%",
          filter: "blur(80px)",
        }}
      />
      {/* Violet orb */}
      <div
        className="pointer-events-none fixed z-0"
        style={{
          bottom: "5%",
          right: "-5%",
          width: "450px",
          height: "450px",
          background: "radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 65%)",
          borderRadius: "50%",
          filter: "blur(70px)",
        }}
      />
    </>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative flex h-screen overflow-hidden text-zinc-100"
      style={{ backgroundColor: "#030303" }}
    >
      <AppBackground />
      <Sidebar />
      <main className="relative z-10 flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAppwrite();
  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  return <AppShell>{children}</AppShell>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAppwrite();
  if (loading) return null;
  if (session) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  const { loading } = useAppwrite();

  if (loading) {
    return (
      <div
        className="flex h-screen items-center justify-center text-zinc-500"
        style={{ backgroundColor: "#030303" }}
      >
        Loading...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<PublicRoute><AuthPage /></PublicRoute>} />

        {/* Protected */}
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute><InvestigationPage /></ProtectedRoute>} />
        <Route path="/connections" element={<ProtectedRoute><ConnectionsPage /></ProtectedRoute>} />
        <Route path="/data-quality" element={<ProtectedRoute><QualityPage /></ProtectedRoute>} />
        <Route path="/data-quality/:connectionId" element={<ProtectedRoute><QualityPage /></ProtectedRoute>} />
        <Route path="/signals" element={<ProtectedRoute><SignalsPage /></ProtectedRoute>} />
        <Route path="/signals/:connectionId" element={<ProtectedRoute><SignalsPage /></ProtectedRoute>} />
        <Route path="/semantic" element={<ProtectedRoute><SemanticPage /></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
