import { Outlet } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import { TopBar } from "../components/TopBar";
import { StatusBar } from "../components/StatusBar";
import { ToastContainer } from "../components/ToastContainer";
import { ConfirmationDialog } from "../components/ConfirmationDialog";
import { CommandPalette } from "../components/CommandPalette";
import "./AppShell.css";

export function AppShell() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell-main">
        <TopBar />
        <div className="app-shell-content scroll-area">
          <Outlet />
        </div>
        <StatusBar />
      </div>
      <ToastContainer />
      <ConfirmationDialog />
      <CommandPalette />
    </div>
  );
}
