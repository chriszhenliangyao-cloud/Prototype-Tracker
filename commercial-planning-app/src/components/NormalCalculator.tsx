"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  buildNormalRows,
  buildRrppSimulationRows,
  type CalculatorFilters,
  type RrppSimulationInputsByRow
} from "@/lib/calculatorRows";
import { formatPercent } from "@/lib/format";
import type { ReferenceData } from "@/lib/types";
import { usePersistentState } from "./usePersistentState";
import { NormalWideTable } from "./WideCalculatorTable";
import { WideTableFilters } from "./WideTableFilters";
import { AutosaveStatus } from "./AutosaveStatus";
import { useAutosaveDraft } from "./useAutosaveDraft";

const rowsPerPage = 30;

export function NormalCalculator({
  data,
  userEmail
}: {
  data: ReferenceData;
  userEmail: string | null;
}) {
  const pathname = usePathname() || "";
  const masterDataHref = pathname.startsWith("/platform/")
    ? "/platform/system/master-data"
    : "/master-data";
  const [exportStatus, setExportStatus] = useState<"idle" | "loading" | "error">(
    "idle"
  );
  const [exportError, setExportError] = useState("");
  const allRows = useMemo(
    () => buildNormalRows(data, {}, { lifecycle: "VALUE_CHAIN" }),
    [data]
  );
  const [filters, setFilters] = usePersistentState<CalculatorFilters>(
    "value-chain-workbook-filters-v1",
    {}
  );
  const [rrppInputsByRow, setRrppInputsByRow] =
    usePersistentState<RrppSimulationInputsByRow>(
      "value-chain-rrpp-simulation-inputs-v1",
      {}
    );
  const autosave = useAutosaveDraft({
    workspace: "VALUE_CHAIN",
    scope: "workbook",
    userEmail,
    value: { filters, rrppInputsByRow },
    onRestore: (snapshot) => {
      if (snapshot.filters && typeof snapshot.filters === "object") {
        setFilters(snapshot.filters as CalculatorFilters);
      }
      if (snapshot.rrppInputsByRow && typeof snapshot.rrppInputsByRow === "object") {
        setRrppInputsByRow(snapshot.rrppInputsByRow as RrppSimulationInputsByRow);
      }
    }
  });
  const rows = useMemo(
    () =>
      buildRrppSimulationRows(data, rrppInputsByRow, filters, {
        lifecycle: "VALUE_CHAIN"
      }),
    [data, filters, rrppInputsByRow]
  );
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  const visibleRows = rows.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  );

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);
  const completeRows = rows.filter((row) => row.calculation);
  const simulatedRows = rows.filter((row) => row.rrppSimulationCalculation);
  const missingRows = rows.length - completeRows.length;
  const averageGpPercent =
    completeRows.length === 0
      ? 0
      : completeRows.reduce(
          (sum, row) => sum + (row.calculation?.gpPercent ?? 0),
          0
        ) / completeRows.length;
  const averageNpPercent =
    simulatedRows.length === 0
      ? 0
      : simulatedRows.reduce(
          (sum, row) => sum + (row.rrppSimulationCalculation?.npPercent ?? 0),
          0
        ) / simulatedRows.length;

  function updateRrppInput(
    key: string,
    field:
      | "rrppLocal"
      | "kaBuyingMargin"
      | "actualFrontMargin"
      | "promoFrontMargin"
      | "dealType"
      | "promoFdMargin",
    value: string
  ) {
    setRrppInputsByRow((current) => {
      const nextInput = {
        ...current[key],
        [field]: value
      };

      if (field === "rrppLocal") {
        delete nextInput.rrppEur;
      }

      return {
        ...current,
        [key]: nextInput
      };
    });
  }

  async function exportWorkbook() {
    setExportStatus("loading");
    setExportError("");

    try {
      const response = await fetch("/api/value-chain/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          filters,
          rrppInputsByRow
        })
      });

      if (!response.ok) {
        const message = await readExportError(response);
        throw new Error(message);
      }

      const blob = await response.blob();
      const href = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download =
        fileNameFromDisposition(response.headers.get("Content-Disposition")) ??
        `On-sale Product Simulation ${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(href);
      setExportStatus("idle");
    } catch (error) {
      setExportStatus("error");
      setExportError(
        error instanceof Error ? error.message : "Unable to export workbook."
      );
    }
  }

  return (
    <div className="grid gap-4">
      <section className="on-sale-overview rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="on-sale-overview-head grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-950">
              On-sale Product Simulation
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              RRP ex VAT &rarr; KA landing &rarr; FD buying &rarr; transport /
              BOM &rarr; GP%. EOL products remain here with an EOL tag.
            </p>
          </div>
          <div className="on-sale-overview-actions flex flex-wrap items-center justify-start gap-2 lg:justify-end">
            <AutosaveStatus
              status={autosave.status}
              lastSavedAt={autosave.lastSavedAt}
              hasConflict={Boolean(autosave.conflictDraft)}
              onLoadNewest={autosave.loadNewestSavedDraft}
              onKeepMyChanges={autosave.keepMyChanges}
            />
            <button
              type="button"
              onClick={exportWorkbook}
              disabled={exportStatus === "loading" || rows.length === 0}
              className="min-h-10 rounded-md border border-slate-300 bg-slate-950 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            >
              {exportStatus === "loading" ? "Preparing Excel..." : "Export Excel"}
            </button>
          </div>
        </div>
        <div className="on-sale-overview-metrics mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Metric label="Rows" value={String(rows.length)} />
          <Metric label="Complete" value={String(completeRows.length)} />
          <Metric
            label="Avg GP%"
            value={
              completeRows.length === 0 ? "-" : formatPercent(averageGpPercent)
            }
          />
          <Metric
            label="Sim NP%"
            value={
              simulatedRows.length === 0
                ? "-"
                : formatPercent(averageNpPercent)
            }
          />
        </div>
        <p className="on-sale-overview-helper mt-2 text-xs font-medium text-slate-500">
          Download the current rows with Excel formulas for offline scenario work.
        </p>
        {exportStatus === "error" ? (
          <p className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {exportError}
          </p>
        ) : null}
        {missingRows > 0 ? (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
            {missingRows} rows are missing RRP, BOM, or logistics data.
          </p>
        ) : null}
        {allRows.length === 0 ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <span>
              No active operating rows. Add Product, Country RRP, BOM,
              Logistics, Operational Margin data, and at least one launched or
              EOL product first.
            </span>
            <a
              href={masterDataHref}
              className="rounded-md bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Open Master Data
            </a>
          </div>
        ) : null}
      </section>

      <WideTableFilters
        rows={allRows}
        filters={filters}
        onChange={(nextFilters) => {
          setFilters(nextFilters);
          setPage(1);
        }}
      />
      {rows.length > rowsPerPage ? (
        <div className="flex min-h-10 flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">
          <span>
            Showing {(page - 1) * rowsPerPage + 1}-
            {Math.min(page * rowsPerPage, rows.length)} of {rows.length} rows
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300"
              disabled={page === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>
            <span className="min-w-16 text-center">
              {page} / {pageCount}
            </span>
            <button
              type="button"
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300"
              disabled={page === pageCount}
              onClick={() =>
                setPage((current) => Math.min(pageCount, current + 1))
              }
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
      <NormalWideTable
        freezeScopeColumns
        rows={visibleRows}
        onRrppInputChange={updateRrppInput}
      />
    </div>
  );
}

async function readExportError(response: Response) {
  try {
    const payload = (await response.json()) as { message?: string };
    return payload.message ?? "Unable to export workbook.";
  } catch {
    return "Unable to export workbook.";
  }
}

function fileNameFromDisposition(value: string | null) {
  if (!value) {
    return null;
  }

  const match = /filename="([^"]+)"/.exec(value);
  return match?.[1] ?? null;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="on-sale-metric min-w-0 rounded-md border border-slate-200 bg-white px-3 py-2">
      <div className="text-xs font-semibold uppercase text-slate-500">
        {label}
      </div>
      <div className="text-base font-semibold text-slate-950">{value}</div>
    </div>
  );
}
