import { useEffect } from "react";
import { FileText, FolderOpen, Search, FilePlus, FileEdit, FilePen, FileInput, TerminalSquare, Cpu, Activity, type LucideIcon } from "lucide-react";
import { useToolsStore } from "../../stores/useToolsStore";
import { PermissionsPanel } from "../PermissionsPanel";
import "./ToolCatalogTab.css";

const TOOL_ICONS: Record<string, LucideIcon> = {
  list_directory: FolderOpen,
  read_file: FileText,
  search_files: Search,
  create_file: FilePlus,
  write_file: FileEdit,
  edit_file: FilePen,
  move_file: FileInput,
  run_command: TerminalSquare,
  get_system_information: Cpu,
  get_process_information: Activity,
};

const VERDICT_STYLE: Record<string, string> = {
  allow: "badge-success",
  confirm: "badge-warning",
  deny: "badge-danger",
};

export function ToolCatalogTab() {
  const { tools, loading, refresh } = useToolsStore();

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="tool-catalog">
      <div className="tool-catalog-list scroll-area">
        {loading && tools.length === 0
          ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 70, margin: "0 0 8px" }} />)
          : tools.map((tool) => {
              const Icon = TOOL_ICONS[tool.id] ?? FileText;
              return (
                <div key={tool.id} className="card tool-catalog-item">
                  <div className="tool-catalog-icon">
                    <Icon size={16} />
                  </div>
                  <div className="tool-catalog-main">
                    <div className="tool-catalog-title-row">
                      <span className="card-title">{tool.name}</span>
                      <span className={`risk-tag risk-${tool.riskLevel}`}>{tool.riskLevel}</span>
                    </div>
                    <div className="card-subtitle" style={{ marginTop: 2 }}>
                      {tool.description}
                    </div>
                  </div>
                  <span className={`badge ${VERDICT_STYLE[tool.verdict] ?? ""}`}>
                    {tool.verdict}
                    {tool.sessionGranted && " · session"}
                  </span>
                </div>
              );
            })}
      </div>
      <div className="tool-catalog-sidebar">
        <div className="card-title" style={{ marginBottom: 14 }}>
          Permissions
        </div>
        <PermissionsPanel />
      </div>
    </div>
  );
}
