import { useState } from "react";
import { ToolCatalogTab } from "../components/tools/ToolCatalogTab";
import { FileExplorerTab } from "../components/tools/FileExplorerTab";
import { TerminalTab } from "../components/tools/TerminalTab";

const TABS = [
  { id: "catalog", label: "Catalog & Permissions" },
  { id: "files", label: "File Explorer" },
  { id: "terminal", label: "Terminal" },
] as const;

export function ToolsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("catalog");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="tabs">
        {TABS.map((t) => (
          <div key={t.id} className="tab" data-active={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {tab === "catalog" && <ToolCatalogTab />}
        {tab === "files" && <FileExplorerTab />}
        {tab === "terminal" && <TerminalTab />}
      </div>
    </div>
  );
}
