"use client";

import type { AutosaveStatus as AutosaveState } from "./useAutosaveDraft";

type Props = {
  status: AutosaveState;
  lastSavedAt: string | null;
  hasConflict: boolean;
  onLoadNewest: () => void;
  onKeepMyChanges: () => void;
};

function savedAtLabel(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return ` ${new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date)}`;
}

export function AutosaveStatus({
  status,
  lastSavedAt,
  hasConflict,
  onLoadNewest,
  onKeepMyChanges
}: Props) {
  const label =
    status === "saving"
      ? "Saving"
      : status === "saved"
        ? `Saved${savedAtLabel(lastSavedAt)}`
        : status === "local"
          ? "Saved locally - waiting to sync"
          : status === "conflict"
            ? "Conflict needs review"
            : "Autosave ready";
  const tone =
    status === "conflict"
      ? "border-amber-300 bg-amber-50 text-amber-900"
      : status === "local"
        ? "border-sky-200 bg-sky-50 text-sky-900"
        : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium ${tone}`}>
      <span>{label}</span>
      {status === "conflict" && hasConflict ? (
        <>
          <button type="button" className="rounded border border-current px-2 py-0.5" onClick={onLoadNewest}>
            Load latest saved draft
          </button>
          <button type="button" className="rounded border border-current px-2 py-0.5" onClick={onKeepMyChanges}>
            Keep my changes
          </button>
        </>
      ) : null}
      {status === "conflict" && !hasConflict ? (
        <button type="button" className="rounded border border-current px-2 py-0.5" onClick={onKeepMyChanges}>
          Keep my changes
        </button>
      ) : null}
    </div>
  );
}
