import { NavLink } from "react-router-dom";
import { Activity, BarChart3, Database, DatabaseZap, LayoutDashboard, LogOut, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppwrite } from "@/hooks/useAppwrite";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/investigate", label: "Investigate", icon: Search },
  { to: "/connections", label: "Connections", icon: Database },
  { to: "/quality/demo", label: "Data Quality", icon: BarChart3 },
  { to: "/signals", label: "Signals", icon: Activity },
  { to: "/semantic", label: "Semantic Dictionary", icon: DatabaseZap },
];

export function Sidebar() {
  const { logout } = useAppwrite();

  return (
    <aside className="flex h-full w-64 flex-col border-r border-gray-800 bg-gray-950/95 backdrop-blur">
      <div className="flex items-center gap-2.5 p-5">
        <div className="flex items-center gap-2.5">
          <img src="/viriya-logo.png" alt="viriya" className="h-8 w-auto max-w-full object-contain select-none" />
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.6)]" aria-hidden="true" />
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-2">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              cn(
                "group no-underline flex items-center gap-3 rounded-md px-4 py-2.5 text-sm text-gray-400 transition-all duration-200 hover:bg-gray-900/80 hover:text-gray-100 hover:translate-x-0.5",
                isActive && "bg-gray-900 text-sky-400 shadow-[inset_0_0_0_1px_rgba(14,165,233,0.14)]"
              )
            }
          >
            <l.icon className="h-4 w-4 shrink-0 text-gray-500 transition-colors group-hover:text-sky-400" aria-hidden="true" />
            <span className="flex-1">{l.label}</span>
            <span className="h-1.5 w-1.5 rounded-full bg-transparent transition-colors group-hover:bg-sky-500/70" aria-hidden="true" />
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-gray-800 px-4 py-4 space-y-2">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-md px-4 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-900 hover:text-gray-300"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
        <div className="rounded-md border border-gray-800 bg-gray-900/70 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.28em] text-gray-500">
          live mesh connected
        </div>
      </div>
    </aside>
  );
}
