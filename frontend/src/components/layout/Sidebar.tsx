import { useEffect, useState } from "react";
import { NavLink, useNavigate, useSearchParams } from "react-router-dom";
import {
  Activity,
  BarChart3,
  Database,
  DatabaseZap,
  LayoutDashboard,
  LogOut,
  MessageSquarePlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppwrite } from "@/hooks/useAppwrite";
import { listChats } from "@/api/client";

interface ConvItem {
  id: string;
  title: string;
  message_count: number;
}

const navLinks = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/connections", label: "Connections", icon: Database },
  { to: "/data-quality", label: "Data Quality", icon: BarChart3 },
  { to: "/signals", label: "Signals", icon: Activity },
  { to: "/semantic", label: "Semantic Dictionary", icon: DatabaseZap },
];

export function Sidebar() {
  const { logout, session } = useAppwrite();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeConvId = searchParams.get("c");

  const [conversations, setConversations] = useState<ConvItem[]>([]);

  useEffect(() => {
    if (!session) return;
    const load = () =>
      listChats(session.jwt)
        .then((r) => setConversations(r.conversations))
        .catch(() => {});
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [session]);

  const handleNewChat = () => {
    navigate("/chat");
  };

  return (
    <aside
      className="relative z-20 flex h-full w-64 flex-col border-r border-white/[0.06] select-none"
      style={{ backdropFilter: "blur(20px)", backgroundColor: "rgba(3,3,3,0.85)" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 pt-5 pb-3">
        <img
          src="/viriya-logo.png"
          alt="viriya"
          className="h-7 w-auto object-contain"
        />
        <span
          className="inline-block h-1.5 w-1.5 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.6)]"
          aria-hidden="true"
        />
      </div>

      {/* New Chat button */}
      <div className="px-3 pb-2">
        <button
          onClick={handleNewChat}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-100"
        >
          <MessageSquarePlus className="h-4 w-4 shrink-0 text-zinc-500" />
          New chat
        </button>
      </div>

      {/* Chat history */}
      <div className="flex-1 overflow-y-auto px-3 pb-2">
        {conversations.length > 0 && (
          <>
            <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-zinc-700">
              Recents
            </div>
            <div className="space-y-0.5">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => navigate(`/chat?c=${conv.id}`)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    activeConvId === conv.id
                      ? "bg-white/[0.06] text-zinc-100"
                      : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200"
                  )}
                >
                  <span className="flex-1 truncate">{conv.title}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Nav links */}
      <div className="border-t border-white/[0.05] px-3 pt-2 pb-1">
        <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-zinc-700">
          Tools
        </div>
        <nav className="space-y-0.5">
          {navLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-white/[0.06] text-sky-400"
                    : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200"
                )
              }
            >
              <l.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{l.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Sign out */}
      <div className="border-t border-white/[0.05] px-3 py-3">
        <button
          onClick={logout}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-white/[0.03] hover:text-zinc-400"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
