import type { ReactNode } from "react";
import { Sparkline } from "./charts/Sparkline";
import { statusForPercent, STATUS_COLOR, STATUS_METER_CLASS } from "./charts/thresholds";
import type { HistoryPoint } from "../stores/useSystemStore";
import "./ResourceCard.css";

interface ResourceCardProps {
  icon: ReactNode;
  title: string;
  value: number | null;
  unit?: string;
  subtitle?: string;
  detail?: string;
  history: HistoryPoint[];
  unavailableReason?: string;
}

export function ResourceCard({ icon, title, value, unit = "%", subtitle, detail, history, unavailableReason }: ResourceCardProps) {
  if (unavailableReason) {
    return (
      <div className="card card-pad resource-card">
        <div className="resource-card-header">
          <span className="resource-card-icon">{icon}</span>
          <span className="card-title">{title}</span>
        </div>
        <div className="resource-card-unavailable">{unavailableReason}</div>
      </div>
    );
  }

  const pct = value ?? 0;
  const status = statusForPercent(pct);

  const delta = history.length >= 2 ? history[history.length - 1].v - history[Math.max(0, history.length - 6)].v : 0;

  return (
    <div className="card card-pad resource-card">
      <div className="resource-card-header">
        <span className="resource-card-icon">{icon}</span>
        <span className="card-title">{title}</span>
      </div>
      <div className="resource-card-value" style={{ color: STATUS_COLOR[status] }}>
        {value === null ? "—" : Math.round(value)}
        <span className="resource-card-unit">{unit}</span>
      </div>
      <div className="meter-track" style={{ margin: "10px 0" }}>
        <div className={`meter-fill ${STATUS_METER_CLASS[status]}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      {subtitle && <div className="resource-card-subtitle">{subtitle}</div>}
      <div className="resource-card-footer">
        {detail && <span className="resource-card-detail">{detail}</span>}
        {history.length >= 2 && (
          <span className={`resource-card-delta ${delta >= 0 ? "delta-up" : "delta-down"}`}>
            {delta >= 0 ? "+" : ""}
            {delta.toFixed(1)} {unit} / min
          </span>
        )}
      </div>
      <div className="resource-card-chart">
        <Sparkline data={history} color={STATUS_COLOR[status]} width={236} height={44} unit={unit} />
      </div>
    </div>
  );
}
