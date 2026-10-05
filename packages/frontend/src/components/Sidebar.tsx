import { NavLink } from "react-router-dom";
import { LayoutDashboard, MessageSquare, Bot, Boxes, Wrench, Cpu, ScrollText, Settings, ChevronsLeft } from "lucide-react";
import { Logo } from "./Logo";
import { useUiStore } from "../stores/useUiStore";
import "./Sidebar.css";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/chat", label: "Chat", icon: MessageSquare },
  { to: "/agent", label: "Agent", icon: Bot },
  { to: "/models", label: "Models", icon: Boxes },
  { to: "/tools", label: "Tools", icon: Wrench },
  { to: "/system", label: "System", icon: Cpu },
  { to: "/logs", label: "Logs", icon: ScrollText },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const mobileOpen = useUiStore((s) => s.mobileSidebarOpen);
  const setMobileSidebarOpen = useUiStore((s) => s.setMobileSidebarOpen);

  return (
    <>
      {mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileSidebarOpen(false)} />}
      <aside className="sidebar" data-collapsed={collapsed} data-mobile-open={mobileOpen}>
        <div className="sidebar-brand">
          <Logo showWordmark={!collapsed} />
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) => `sidebar-item${isActive ? " active" : ""}`}
              title={collapsed ? label : undefined}
              onClick={() => setMobileSidebarOpen(false)}
            >
              <Icon size={17} strokeWidth={1.8} />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>
        <button className="sidebar-collapse-btn" onClick={toggleSidebar} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          <ChevronsLeft size={15} style={{ transform: collapsed ? "rotate(180deg)" : "none", transition: "transform 180ms" }} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </aside>
    </>
  );
}
