interface LogoProps {
  size?: number;
  showWordmark?: boolean;
}

export function Logo({ size = 22, showWordmark = true }: LogoProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
        <circle cx="16" cy="16" r="13.5" stroke="var(--accent-500)" strokeWidth="2.4" strokeDasharray="60 24.8" strokeLinecap="round" />
        <circle cx="16" cy="16" r="5.5" fill="var(--accent-400)" opacity="0.9" />
        <circle cx="16" cy="16" r="2" fill="var(--bg-base)" />
      </svg>
      {showWordmark && (
        <span
          style={{
            fontSize: 14.5,
            fontWeight: 700,
            letterSpacing: "0.12em",
            color: "var(--text-primary)",
          }}
        >
          ONYX
        </span>
      )}
    </div>
  );
}
