/** Compact SVG arc: the facility health score as a gauge, status-colored. */
export default function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, score)) / 100) * c;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" aria-label={`Health score ${score}`}>
      <circle cx="36" cy="36" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="5" />
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${c - filled}`}
        transform="rotate(-90 36 36)"
        style={{ transition: "stroke-dasharray 400ms ease" }}
      />
      <text x="36" y="41" textAnchor="middle" fill={color} fontSize="20" fontWeight="600" fontFamily="var(--font-plex-mono), monospace">
        {score}
      </text>
    </svg>
  );
}
