"use client";

import { useMemo, useState } from "react";
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
import { QuickNewProductSimulation } from "./QuickNewProductSimulation";
import { AutosaveStatus } from "./AutosaveStatus";
import { useAutosaveDraft } from "./useAutosaveDraft";

export function SimulationCalculator({
  data,
  canAddQuickSimulationToFormalList,
  userEmail
}: {
  data: ReferenceData;
  canAddQuickSimulationToFormalList: boolean;
  userEmail: string | null;
}) {
  const allRows = useMemo(
    () => buildNormalRows(data, {}, { lifecycle: "UNLAUNCHED" }),
    [data]
  );
  const [filters, setFilters] = usePersistentState<CalculatorFilters>(
    "new-product-simulation-filters-v1",
    {}
  );
  const [rrppInputsByRow, setRrppInputsByRow] =
    usePersistentState<RrppSimulationInputsByRow>(
      "new-product-simulation-rrpp-inputs-v1",
      {}
    );
  const autosave = useAutosaveDraft({
    workspace: "NEW_PRODUCT_FORMAL",
    scope: "unlaunched-list",
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
        lifecycle: "UNLAUNCHED"
      }),
    [data, filters, rrppInputsByRow]
  );
  const simulatedRows = rows.filter((row) => row.rrppSimulationCalculation);
  const averageNpPercent =
    simulatedRows.length === 0
      ? 0
      : simulatedRows.reduce(
          (sum, row) => sum + (row.rrppSimulationCalculation?.npPercent ?? 0),
          0
        ) / simulatedRows.length;
  const [showUnlaunchedList, setShowUnlaunchedList] = useState(false);

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

  return (
    <div className="grid gap-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-950">
              New Product Simulation
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Products marked Unlaunched in Master Data. Enter RRPP to simulate
              promotion floor NP before launch.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <Metric label="Rows" value={String(rows.length)} />
            <Metric label="Simulated" value={String(simulatedRows.length)} />
            <Metric
              label="Avg NP%"
              value={
                simulatedRows.length === 0
                  ? "-"
                  : formatPercent(averageNpPercent)
              }
            />
          </div>
        </div>
        <div className="mt-3">
          <AutosaveStatus
            status={autosave.status}
            lastSavedAt={autosave.lastSavedAt}
            hasConflict={Boolean(autosave.conflictDraft)}
            onLoadNewest={autosave.loadNewestSavedDraft}
            onKeepMyChanges={autosave.keepMyChanges}
          />
        </div>
        {allRows.length === 0 ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            <span>
              No unlaunched product-country rows. Products with active country
              lifecycle Launched or EOL stay in On-sale Product Simulation.
            </span>
            <a
              href="/"
              className="rounded-md bg-emerald-900 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Open On-sale Product Simulation
            </a>
          </div>
        ) : null}
      </section>

      <QuickNewProductSimulation
        data={data}
        canAddToFormalList={canAddQuickSimulationToFormalList}
        userEmail={userEmail}
      />

      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">
              Unreleased product list
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Formal list for products already prepared in master data.
            </p>
          </div>
          <button
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            type="button"
            onClick={() => setShowUnlaunchedList((current) => !current)}
          >
            {showUnlaunchedList
              ? "Hide unreleased product list"
              : "Show unreleased product list"}
          </button>
        </div>
      </section>

      {showUnlaunchedList ? (
        <>
          <WideTableFilters
            rows={allRows}
            filters={filters}
            onChange={setFilters}
          />
          <NormalWideTable
            mode="simulation"
            rows={rows}
            onRrppInputChange={updateRrppInput}
          />
        </>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-24 rounded-md border border-slate-200 bg-white px-3 py-2">
      <div className="text-xs font-semibold uppercase text-slate-500">
        {label}
      </div>
      <div className="text-base font-semibold text-slate-950">{value}</div>
    </div>
  );
}
