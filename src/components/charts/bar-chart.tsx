/**
 * Bars vs an optional dashed baseline. No chart lib, and deliberately **not** an SVG.
 *
 * It used to be one: viewBox "0 0 168 105" stretched by w-full to ~316px on a phone,
 * i.e. everything inside scaled 1.88x. `fontSize={8}` then painted at ~15px against a
 * type scale whose micro-label is 11.5px, which is what made the chart look enormous on
 * mobile — and the factor changed with the container, so no fixed fontSize could be
 * right. Laying it out in CSS means the bars flex and the text is just text at its real
 * size, whatever the screen. Values and baseline share one linear scale from 0.
 *
 * Colour carries meaning: a day at or under baseline is primary, a day over it is
 * plot-hot — the same amber that marks an over-baseline plot in the garden.
 */
export function BarChart({
  values,
  labels = [],
  subLabels = [],
  baseline,
}: {
  values: number[];
  labels?: string[];
  /** Optional second caption row under each bar — the dashboard puts that day's points here. */
  subLabels?: string[];
  baseline?: number;
}) {
  const max = Math.max(...values, baseline ?? 0, 1) * 1.1;
  const pct = (v: number) => `${(v / max) * 100}%`;

  return (
    <div className="w-full">
      <div className="relative h-28">
        {baseline !== undefined && (
          <div
            aria-hidden
            className="absolute inset-x-0 border-t border-dashed border-bark"
            style={{ bottom: pct(baseline) }}
          />
        )}
        <div className="flex h-full items-end gap-1.5">
          {values.map((v, i) => (
            <div key={i} className="flex h-full flex-1 flex-col justify-end">
              <div
                className={`w-full rounded-t-[3px] ${
                  baseline !== undefined && v > baseline ? "bg-plot-hot" : "bg-primary"
                }`}
                style={{ height: pct(v) }}
              />
            </div>
          ))}
        </div>
      </div>

      {labels.length > 0 && (
        <div className="mt-2 flex gap-1.5">
          {labels.map((l, i) => (
            <span key={i} className="flex-1 text-center text-[11px] text-muted">
              {l}
            </span>
          ))}
        </div>
      )}
      {subLabels.length > 0 && (
        <div className="mt-1 flex gap-1.5">
          {subLabels.map((l, i) => (
            <span key={i} className="flex-1 text-center text-[11px] font-bold text-primary">
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
