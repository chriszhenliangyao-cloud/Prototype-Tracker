import type { ReactNode } from "react";

export function MetricCard({
  label,
  value,
  detail,
  tone = "neutral"
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: "neutral" | "good" | "warning" | "critical";
}) {
  const toneClass = {
    neutral: "border-slate-200 bg-white",
    good: "border-emerald-200 bg-emerald-50",
    warning: "border-amber-200 bg-amber-50",
    critical: "border-rose-200 bg-rose-50"
  }[tone];

  return (
    <div className={`rounded-lg border p-4 shadow-sm ${toneClass}`}>
      <div className="text-xs font-semibold text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
      {detail ? <div className="mt-1 text-xs text-slate-500">{detail}</div> : null}
    </div>
  );
}
