import { NavLink } from "react-router-dom";
import { Activity, BarChart3, DatabaseZap, LayoutDashboard, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/investigate", label: "Investigate", icon: Search },
  { to: "/quality/demo", label: "Data Quality", icon: BarChart3 },
  { to: "/signals", label: "Signals", icon: Activity },
  { to: "/semantic", label: "Semantic Dictionary", icon: DatabaseZap },
];

export function Sidebar() {
  return (
    <aside className="w-64 h-full bg-gray-950 border-r border-gray-800 flex flex-col">
      <div className="px-4 py-6 flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.7)]" aria-hidden="true" />
        <span className="text-base font-mono tracking-tight text-gray-100 lowercase">viriya</span>
      </div>
      <nav className="flex flex-col gap-1 px-2">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              cn(
                "no-underline flex items-center gap-2 px-4 py-2 rounded-md transition-colors text-gray-400 hover:text-gray-100 hover:bg-gray-900",
                isActive && "bg-gray-900 text-sky-500"
              )
            }
          >
            <l.icon className="h-4 w-4" aria-hidden="true" />
            <span>{l.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
