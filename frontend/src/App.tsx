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

// Redirects unauthenticated users to /login
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAppwrite();
  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  return <AppShell>{children}</AppShell>;
}

// Redirects authenticated users away from public pages (login)
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
      <div className="flex h-screen items-center justify-center bg-gray-950 text-gray-400">
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
