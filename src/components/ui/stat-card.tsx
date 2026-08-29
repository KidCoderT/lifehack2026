import type { LucideIcon } from "lucide-react";
import { Card } from "./card";

export function StatCard({
  label,
  value,
  caption,
  icon: Icon,
  className = "",
}: {
  label: string;
  value: string;
  caption?: string;
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <Card className={`flex flex-col gap-1 ${className}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{label}</p>
        <Icon className="size-5 text-primary" />
      </div>
      <p className="font-mono text-3xl font-bold">{value}</p>
      {caption && <p className="text-xs text-muted">{caption}</p>}
    </Card>
  );
}
