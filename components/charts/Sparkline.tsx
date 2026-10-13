// Pure SVG, server-rendered: zero client JS for charts.
export function Sparkline({ values, width = 120, height = 32, className = "text-purple-500", label }: { values: number[]; width?: number; height?: number; className?: string; label: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const step = width / (values.length - 1);
  const y = (v: number) => height - 2 - ((v - min) / (max - min || 1)) * (height - 4);
  const d = values.map((v, i) => `${i ? "L" : "M"}${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join("");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={className} role="img" aria-label={label} preserveAspectRatio="none">
      <path d={`${d}L${width},${height}L0,${height}Z`} fill="currentColor" opacity="0.1" />
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
