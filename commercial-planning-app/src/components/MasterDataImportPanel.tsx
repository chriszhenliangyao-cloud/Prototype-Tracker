"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ImportActionState,
  MasterDataPreviewState
} from "@/app/master-data/actions";

type MasterDataImportPanelProps = {
  title: string;
  description: string;
  columns: string[];
  aliases?: string[];
  example?: string[];
  fieldsLabel?: string;
  submitLabel?: string;
  action?: string;
  result?: ImportActionState | null;
};

const initialState: ImportActionState = {
  status: "idle",
  message: "",
  imported: 0,
  updated: 0,
  skipped: 0,
  summary: [],
  errors: [],
  duplicateKeys: []
};

export function MasterDataImportPanel({
  title,
  description,
  columns,
  aliases = [],
  example = [],
  fieldsLabel = "Business fields",
  submitLabel = "Upload .xlsx",
  action = "/master-data/import",
  result = null
}: MasterDataImportPanelProps) {
  const fileInputId = useId();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ImportActionState>(result ?? initialState);
  const [preview, setPreview] = useState<MasterDataPreviewState | null>(null);
  const [busy, setBusy] = useState<"preview" | "publish" | null>(null);
  const hasResult = state.status !== "idle";
  const visibleErrors = state.errors.slice(0, 4);
  const visibleDuplicateKeys = state.duplicateKeys.slice(0, 3);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void previewWorkbook();
      }}
      className="grid min-w-0 gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </div>

      <div className="grid gap-1">
        <p className="text-xs font-semibold uppercase text-slate-500">
          {fieldsLabel}
        </p>
        <div className="flex flex-wrap gap-1">
          {columns.map((column) => (
            <span
              key={column}
              className="max-w-full break-words rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700"
            >
              {column}
            </span>
          ))}
        </div>
      </div>

      {aliases.length > 0 ? (
        <div className="grid gap-1">
          <p className="text-xs font-semibold uppercase text-slate-500">
            Recognized aliases
          </p>
          <p className="text-xs leading-5 text-slate-500">
            {aliases.join(" / ")}
          </p>
        </div>
      ) : null}

      {example.length > 0 ? (
        <div className="grid gap-1">
          <p className="text-xs font-semibold uppercase text-slate-500">
            Example row
          </p>
          <div className="overflow-auto rounded-md border border-slate-200">
            <table className="min-w-full border-collapse text-xs">
              <tbody>
                <tr>
                  {example.map((value, index) => (
                    <td
                      key={`${value}-${index}`}
                      className="border-r border-slate-100 px-2 py-1.5 text-slate-700 last:border-r-0"
                    >
                      {value}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <label
        className="grid gap-1 text-sm font-medium text-slate-700"
        htmlFor={fileInputId}
      >
        <span>Excel file</span>
        <input
          id={fileInputId}
          ref={fileInputRef}
          className="block w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-slate-700"
          type="file"
          name="file"
          accept=".xlsx"
          required
          onChange={() => {
            setPreview(null);
            setState(initialState);
          }}
        />
      </label>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          type="submit"
          disabled={busy !== null}
        >
          {busy === "preview" ? "Validating..." : "Validate & preview impact"}
        </button>
        <button
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          type="button"
          disabled={busy !== null || preview?.status !== "valid"}
          onClick={() => void publishWorkbook()}
        >
          {busy === "publish" ? "Publishing..." : submitLabel}
        </button>
      </div>

      {preview ? <ImportPreview preview={preview} /> : null}

      {hasResult ? (
        <div
          aria-live="polite"
          role={state.status === "error" ? "alert" : "status"}
          className={
            state.status === "success"
              ? "grid gap-1 rounded-md bg-emerald-50 p-2 text-xs text-emerald-800"
              : "grid gap-1 rounded-md bg-rose-50 p-2 text-xs text-rose-800"
          }
        >
          <p className="font-semibold">{state.message}</p>
          <p>
            Imported {state.imported}, updated {state.updated}, skipped{" "}
            {state.skipped}.
          </p>

          {state.summary.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {state.summary.map((item) => (
                <span
                  key={item.label}
                  className="rounded-full bg-white/70 px-2 py-0.5 font-medium"
                >
                  {item.label}: {item.rows}
                </span>
              ))}
            </div>
          ) : null}

          {visibleErrors.map((error, index) => (
            <p key={`${error.rowNumber}-${error.field ?? "row"}-${index}`}>
              {error.sheet ? `${error.sheet} · ` : ""}
              {error.rowNumber > 0 ? `Row ${error.rowNumber}` : "Workbook"}:{" "}
              {error.field ? `${error.field} - ` : ""}
              {error.message}
            </p>
          ))}

          {state.errors.length > visibleErrors.length ? (
            <p>{state.errors.length - visibleErrors.length} more errors.</p>
          ) : null}

          {state.duplicateKeys.length > 0 ? (
            <p>
              Duplicate keys skipped: {visibleDuplicateKeys.join(", ")}
              {state.duplicateKeys.length > visibleDuplicateKeys.length
                ? `, +${
                    state.duplicateKeys.length - visibleDuplicateKeys.length
                  } more`
                : ""}
              .
            </p>
          ) : null}
        </div>
      ) : null}
    </form>
  );

  async function previewWorkbook() {
    const file = selectedFile();
    if (!file) {
      setState(errorState("Choose an .xlsx file first."));
      return;
    }

    setBusy("preview");
    setState(initialState);
    setPreview(null);
    try {
      const response = await uploadWorkbook("/api/master-data/import-preview", file);
      const payload = (await response.json()) as MasterDataPreviewState & { message?: string };
      if (!response.ok && payload.status !== "error") {
        throw new Error(payload.message || `Validation failed (HTTP ${response.status}).`);
      }
      setPreview(payload);
    } catch (error) {
      setState(errorState(error instanceof Error ? error.message : "Validation failed."));
    } finally {
      setBusy(null);
    }
  }

  async function publishWorkbook() {
    const file = selectedFile();
    if (!file || preview?.status !== "valid") return;

    setBusy("publish");
    setState(initialState);
    try {
      const response = await uploadWorkbook(action, file);
      const payload = (await response.json()) as ImportActionState;
      setState(payload);
      if (!response.ok || payload.status !== "success") return;

      notifyMasterDataPublished();
      setPreview(null);
      router.refresh();
    } catch (error) {
      setState(errorState(error instanceof Error ? error.message : "Import failed."));
    } finally {
      setBusy(null);
    }
  }

  function selectedFile() {
    return fileInputRef.current?.files?.[0] ?? null;
  }
}

function ImportPreview({ preview }: { preview: MasterDataPreviewState }) {
  const visibleErrors = preview.errors.slice(0, 5);
  if (preview.status === "error") {
    return (
      <div className="grid gap-1 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800" role="alert">
        <strong>{preview.message}</strong>
        {visibleErrors.map((error, index) => (
          <span key={`${error.sheet ?? "workbook"}-${error.rowNumber}-${index}`}>
            {error.sheet ? `${error.sheet} · ` : ""}
            {error.rowNumber > 0 ? `Row ${error.rowNumber}` : "Workbook"}
            {error.field ? ` · ${error.field}` : ""}: {error.message}
          </span>
        ))}
        {preview.duplicateKeys.length > 0 ? (
          <span>Duplicate keys: {preview.duplicateKeys.slice(0, 4).join(", ")}</span>
        ) : null}
      </div>
    );
  }

  const impact = preview.impact;
  return (
    <div className="grid gap-3 rounded-md border border-blue-200 bg-blue-50/60 p-3 text-xs text-slate-700" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="text-sm text-slate-950">Validation passed</strong>
        <span className="rounded-full bg-white px-2 py-1 font-semibold text-blue-700">
          {impact?.totalChanges ?? 0} changes detected
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {impact?.groups.map((group) => (
          <div key={group.key} className="min-w-0 rounded-md border border-slate-200 bg-white px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <strong className="truncate text-slate-900">{group.label}</strong>
              <span className="text-slate-500">{group.incoming} rows</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-slate-600">
              <span>New <b className="text-emerald-700">{group.added}</b></span>
              <span>Changed <b className="text-blue-700">{group.changed}</b></span>
              <span>Inactive <b className="text-amber-700">{group.inactivated}</b></span>
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-1 border-t border-blue-100 pt-2">
        <strong className="text-slate-900">Modules refreshed after publish</strong>
        <span>{impact?.affectedModules.join(" · ") || "No dependent module changes detected"}</span>
        <span className="text-slate-500">
          Current defaults and selectors update immediately. Existing plans, approvals and saved simulations retain their recorded snapshots; removed rows become inactive instead of being deleted.
        </span>
      </div>
    </div>
  );
}

async function uploadWorkbook(endpoint: string, file: File) {
  const formData = new FormData();
  formData.set("file", file);
  return fetch(endpoint, {
    method: "POST",
    body: formData,
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    cache: "no-store"
  });
}

function notifyMasterDataPublished() {
  const message = {
    type: "operations:master-data-updated",
    updatedAt: new Date().toISOString()
  };
  window.dispatchEvent(new CustomEvent(message.type, { detail: message }));
  if (window.parent !== window) {
    let targetOrigin = "*";
    try {
      targetOrigin = document.referrer ? new URL(document.referrer).origin : "*";
    } catch {
      targetOrigin = "*";
    }
    window.parent.postMessage(message, targetOrigin);
  }
}

function errorState(message: string): ImportActionState {
  return {
    ...initialState,
    status: "error",
    message,
    errors: [{ rowNumber: 0, message }]
  };
}
