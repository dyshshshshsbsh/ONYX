import type { PermissionSettings } from "@lacc/shared";
import { useSettingsStore } from "../stores/useSettingsStore";
import "./PermissionsPanel.css";

const GROUPS: Array<{ title: string; items: Array<{ key: keyof PermissionSettings; label: string }> }> = [
  {
    title: "File Access",
    items: [
      { key: "fileRead", label: "Read files" },
      { key: "fileCreate", label: "Create files" },
      { key: "fileModify", label: "Modify files" },
      { key: "fileDelete", label: "Delete files" },
    ],
  },
  {
    title: "Terminal",
    items: [
      { key: "terminalExecute", label: "Execute commands" },
      { key: "terminalAdmin", label: "Administrator privileges" },
    ],
  },
  {
    title: "Network",
    items: [{ key: "networkAccess", label: "Internet access" }],
  },
  {
    title: "System",
    items: [
      { key: "systemReadInfo", label: "Read system information" },
      { key: "systemModifySettings", label: "Modify system settings" },
    ],
  },
];

export function PermissionsPanel() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);

  if (!settings) return null;
  const permissions = settings.security.permissions;

  function toggle(key: keyof PermissionSettings) {
    update({ security: { ...settings!.security, permissions: { ...permissions, [key]: !permissions[key] } } });
  }

  return (
    <div className="permissions-panel">
      {GROUPS.map((group) => (
        <div key={group.title} className="permissions-group">
          <div className="permissions-group-title">{group.title}</div>
          {group.items.map((item) => {
            const isDangerous = item.key === "terminalAdmin" || item.key === "fileDelete" || item.key === "systemModifySettings";
            return (
              <label key={item.key} className="permission-row">
                <span style={{ color: isDangerous && permissions[item.key] ? "var(--warning-500)" : undefined }}>{item.label}</span>
                <span className="switch" data-on={permissions[item.key]} onClick={() => toggle(item.key)}>
                  <span className="switch-thumb" />
                </span>
              </label>
            );
          })}
        </div>
      ))}
    </div>
  );
}
