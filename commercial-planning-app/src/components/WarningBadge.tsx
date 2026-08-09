import type { WarningLevel } from "@/lib/calculations/valueChain";

const styles: Record<WarningLevel, string> = {
  GOOD: "border-emerald-200 bg-emerald-50 text-emerald-700",
  WARNING: "border-amber-200 bg-amber-50 text-amber-700",
  CRITICAL: "border-rose-200 bg-rose-50 text-rose-700"
};

export function WarningBadge({ level }: { level: WarningLevel }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${styles[level]}`}
    >
      {level}
    </span>
  );
}
