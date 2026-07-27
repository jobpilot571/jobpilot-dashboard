import { cn } from "@/lib/utils";

export function SimpleBarList({
  items,
  valueSuffix = "",
}: {
  items: { name: string; count: number }[];
  valueSuffix?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No data in this range.</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.name} className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm">
          <div className="min-w-0">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate font-medium text-foreground">{item.name}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.round((item.count / max) * 100)}%` }}
              />
            </div>
          </div>
          <span className="tabular-nums text-muted-foreground">
            {item.count}
            {valueSuffix}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function TrendBars({ points }: { points: { date: string; count: number }[] }) {
  const max = Math.max(1, ...points.map((p) => p.count));
  const sample =
    points.length > 45
      ? points.filter((_, i) => i % Math.ceil(points.length / 45) === 0 || i === points.length - 1)
      : points;

  return (
    <div className="space-y-3">
      <div className="flex h-40 items-end gap-1 overflow-x-auto pb-1">
        {sample.map((p) => (
          <div key={p.date} className="flex min-w-[10px] flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[9px] tabular-nums text-muted-foreground">{p.count || ""}</span>
            <div
              className={cn("w-full rounded-t bg-primary/80", p.count === 0 && "bg-muted")}
              style={{ height: `${Math.max(p.count === 0 ? 2 : 6, Math.round((p.count / max) * 120))}px` }}
              title={`${p.date}: ${p.count}`}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{points[0]?.date}</span>
        <span>{points[points.length - 1]?.date}</span>
      </div>
    </div>
  );
}
