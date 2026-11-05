interface Props {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
}

export default function Sparkline({ values, width = 72, height = 20, stroke = "var(--ink-3)" }: Props) {
  if (values.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (width - 4) + 2;
    const y = height - 3 - ((v - min) / span) * (height - 6);
    return [x, y] as const;
  });
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} aria-hidden>
      <polyline points={pts.map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke={stroke} strokeWidth="1.2" />
      <circle cx={last[0]} cy={last[1]} r="1.8" fill="var(--ink-1)" />
    </svg>
  );
}
