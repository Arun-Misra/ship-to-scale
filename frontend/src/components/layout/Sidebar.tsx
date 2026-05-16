import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const links = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/investigate", label: "Investigate" },
  { to: "/signals", label: "Signals" },
  { to: "/semantic", label: "Company Brain" },
];

export function Sidebar() {
  return (
    <aside className="w-52 bg-gray-900 border-r border-gray-800 flex flex-col py-6 px-3 shrink-0">
      <div className="mb-8 px-2">
        <span className="text-lg font-bold text-white">Niriya</span>
        <span className="block text-xs text-gray-500">The AI Data Team</span>
      </div>
      <nav className="space-y-1">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              cn("block px-3 py-2 rounded-lg text-sm transition-colors", isActive ? "bg-brand-500 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800")
            }
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
