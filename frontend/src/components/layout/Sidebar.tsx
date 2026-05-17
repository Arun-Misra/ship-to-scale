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

  // Poll chat list so history stays in sync as new conversations are created
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
    <aside className="flex h-full w-64 flex-col bg-gray-950 border-r border-gray-800 select-none">
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
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-gray-300 transition-colors hover:bg-gray-800/80 hover:text-white"
        >
          <MessageSquarePlus className="h-4 w-4 shrink-0 text-gray-400" />
          New chat
        </button>
      </div>

      {/* Chat history */}
      <div className="flex-1 overflow-y-auto px-3 pb-2">
        {conversations.length > 0 && (
          <>
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
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
                      ? "bg-gray-800 text-gray-100"
                      : "text-gray-400 hover:bg-gray-800/60 hover:text-gray-200"
                  )}
                >
                  <span className="flex-1 truncate">{conv.title}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Other pages */}
      <div className="border-t border-gray-800/70 px-3 pt-2 pb-1">
        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
          Tools
        </div>
        <nav className="space-y-0.5">
          {navLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-gray-800/60 hover:text-gray-200",
                  isActive
                    ? "bg-gray-800 text-sky-400"
                    : "text-gray-400"
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
      <div className="border-t border-gray-800/70 px-3 py-3">
        <button
          onClick={logout}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-800/60 hover:text-gray-300"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
