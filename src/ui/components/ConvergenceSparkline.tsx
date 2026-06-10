/** Convergence sparkline — mtow per solver iterate, instrument teal. */

interface SparklineProps {
  trace: number[];
  width?: number;
  height?: number;
}

export function ConvergenceSparkline({ trace, width = 220, height = 48 }: SparklineProps) {
  if (trace.length < 2) return null;
  const min = Math.min(...trace);
  const max = Math.max(...trace);
  const span = max - min || 1;
  const pad = 3;
  const points = trace
    .map((v, i) => {
      const x = pad + (i / (trace.length - 1)) * (width - 2 * pad);
      const y = height - pad - ((v - min) / span) * (height - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label="Convergence history"
      className="block"
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--trace)"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}
