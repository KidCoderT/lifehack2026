export function ProgressBar({
  value,
  max,
  className = "",
}: {
  value: number;
  max: number;
  className?: string;
}) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  return (
    <div className={`h-3 overflow-hidden rounded-full bg-surface-muted ${className}`}>
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-700"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
