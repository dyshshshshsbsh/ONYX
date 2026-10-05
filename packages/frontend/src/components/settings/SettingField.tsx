import type { ReactNode } from "react";
import "./SettingField.css";

export function SettingField({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return (
    <div className="setting-field">
      <div className="setting-field-text">
        <div className="setting-field-label">{label}</div>
        {description && <div className="setting-field-description">{description}</div>}
      </div>
      <div className="setting-field-control">{children}</div>
    </div>
  );
}

export function SettingSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="setting-section">
      <div className="setting-section-title">{title}</div>
      {children}
    </div>
  );
}
