export function statusForPercent(percent: number): "accent" | "warning" | "danger" {
  if (percent >= 90) return "danger";
  if (percent >= 70) return "warning";
  return "accent";
}

export const STATUS_COLOR: Record<ReturnType<typeof statusForPercent>, string> = {
  accent: "var(--accent-500)",
  warning: "var(--warning-500)",
  danger: "var(--danger-500)",
};

export const STATUS_METER_CLASS: Record<ReturnType<typeof statusForPercent>, string> = {
  accent: "",
  warning: "meter-warning",
  danger: "meter-danger",
};
