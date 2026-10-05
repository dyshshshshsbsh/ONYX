import { useId, useMemo, useState } from "react";
import type { HistoryPoint } from "../../stores/useSystemStore";
import { formatTime } from "../../utils/format";

interface SparklineProps {
  data: HistoryPoint[];
  width?: number;
  height?: number;
  color?: string;
  unit?: string;
  max?: number;
}

export function Sparkline({ data, width = 220, height = 48, color = "var(--accent-500)", unit = "%", max = 100 }: SparklineProps) {
  const gradientId = useId();
  const [hover, setHover] = useState<{ x: number; point: HistoryPoint } | null>(null);

  const path = useMemo(() => {
    if (data.length < 2) return { line: "", area: "" };
    const xStep = width / (data.length - 1);
    const points = data.map((p, i) => [i * xStep, height - (Math.min(p.v, max) / max) * height]);
    const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const area = `${line} L${points[points.length - 1][0].toFixed(1)},${height} L0,${height} Z`;
    return { line, area };
  }, [data, width, height, max]);

  if (data.length < 2) {
    return (
      <div style={{ width, height, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="skeleton" style={{ width: "100%", height: height * 0.5 }} />
      </div>
    );
  }

  function onMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const idx = Math.round((relX / width) * (data.length - 1));
    const clamped = Math.max(0, Math.min(data.length - 1, idx));
    const xStep = width / (data.length - 1);
    setHover({ x: clamped * xStep, point: data[clamped] });
  }

  return (
    <div style={{ position: "relative", width, height }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label={`Trend chart, current value ${Math.round(data[data.length - 1].v)}${unit}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={path.area} fill={`url(#${gradientId})`} stroke="none" />
        <path d={path.line} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        {hover && (
          <line x1={hover.x} y1={0} x2={hover.x} y2={height} stroke="var(--border-strong)" strokeWidth="1" strokeDasharray="2 2" />
        )}
        {hover && (
          <circle cx={hover.x} cy={height - (Math.min(hover.point.v, max) / max) * height} r="2.5" fill={color} />
        )}
      </svg>
      {hover && (
        <div
          className="tooltip"
          style={{ left: Math.min(Math.max(hover.x, 30), width - 30), top: -8, transform: "translate(-50%, -100%)" }}
        >
          {hover.point.v.toFixed(1)}
          {unit} · {formatTime(hover.point.t)}
        </div>
      )}
    </div>
  );
}
