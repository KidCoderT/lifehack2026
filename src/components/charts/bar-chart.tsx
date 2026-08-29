/**
 * Server-rendered SVG bar chart — no chart lib. Bars vs an optional dashed
 * baseline. Values and baseline share one linear scale from 0.
 *
 * Colour carries meaning: a day at or under baseline is primary, a day over it
 * is plot-hot — the same amber that marks a leaking plot in the garden.
 */
export function BarChart({
  values,
  labels = [],
  baseline,
}: {
  values: number[];
  labels?: string[];
  baseline?: number;
}) {
  const n = Math.max(values.length, 1);
  const BAR = 16;
  const GAP = 8;
  const H = 80;
  const width = n * (BAR + GAP);
  const max = Math.max(...values, baseline ?? 0, 1) * 1.1;
  const y = (v: number) => H - (v / max) * H;

  return (
    <svg viewBox={`0 0 ${width} ${H + 14}`} className="w-full" role="img">
      {values.map((v, i) => (
        <rect
          key={i}
          x={i * (BAR + GAP) + GAP / 2}
          y={y(v)}
          width={BAR}
          height={H - y(v)}
          rx={3}
          className={`${baseline !== undefined && v > baseline ? "fill-plot-hot" : "fill-primary"} ${
            i === values.length - 1 ? "" : "opacity-75"
          }`}
        />
      ))}
      {baseline !== undefined && (
        <line
          x1={0}
          x2={width}
          y1={y(baseline)}
          y2={y(baseline)}
          strokeDasharray="4 4"
          className="stroke-bark"
          strokeWidth={1.5}
        />
      )}
      {labels.map((l, i) => (
        <text
          key={i}
          x={i * (BAR + GAP) + GAP / 2 + BAR / 2}
          y={H + 11}
          textAnchor="middle"
          className="fill-muted"
          fontSize={8}
        >
          {l}
        </text>
      ))}
    </svg>
  );
}
