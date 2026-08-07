"use client";

import { useMemo, useRef, useState } from "react";
import {
  achievementRate,
  buildBusinessPlanAchievement,
  sortBusinessPlanAchievementProducts,
  type BusinessPlanAchievementProductSort
} from "@/lib/businessPlanAchievement";
import type { BusinessPlanLine } from "@/lib/calculations/businessPlan";
import { formatEuropeanDateTime, formatMoney, formatPercent } from "@/lib/format";
import type { BusinessPlanActualEntryOption } from "@/lib/types";

type ActualImportResult = {
  status: "success" | "error";
  message: string;
  imported?: number;
  skipped?: number;
  errors?: Array<{ sheetName: string; rowNumber: number; message: string }>;
};

export function BusinessPlanAchievementPanel({
  aggregateProductsAcrossMarkets,
  actuals,
  canImport,
  lines,
  planScopeLabel,
  productFilter,
  selectedTimeLabel,
  selectedYear,
  timePeriod
}: {
  aggregateProductsAcrossMarkets: boolean;
  actuals: BusinessPlanActualEntryOption[];
  canImport: boolean;
  lines: BusinessPlanLine[];
  planScopeLabel: string;
  productFilter: string;
  selectedTimeLabel: string;
  selectedYear: number;
  timePeriod: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<ActualImportResult | null>(null);
  const [productSort, setProductSort] =
    useState<BusinessPlanAchievementProductSort>("TARGET_SI_DESC");
  const achievement = useMemo(
    () =>
      buildBusinessPlanAchievement({
        aggregateProductsAcrossMarkets,
        actuals,
        lines,
        period: timePeriod,
        productFilter
      }),
    [actuals, aggregateProductsAcrossMarkets, lines, productFilter, timePeriod]
  );
  const { summary } = achievement;
  const unitRate = achievementRate(summary.actualSiUnits, summary.targetSiUnits);
  const valueRate = achievementRate(
    summary.actualSiValueEur,
    summary.targetSiValueEur
  );
  const coverageLabel = formatCoverage(achievement.coverage);
  const sortedProducts = useMemo(
    () => sortBusinessPlanAchievementProducts(achievement.byProduct, productSort),
    [achievement.byProduct, productSort]
  );

  async function importActuals() {
    const file = fileInputRef.current?.files?.[0];
    if (!file || isImporting) {
      setResult({
        status: "error",
        message: "Choose a PO workbook first."
      });
      return;
    }

    setIsImporting(true);
    setResult(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        `/api/business-plan/actuals/import?year=${encodeURIComponent(String(selectedYear))}`,
        { method: "POST", body: formData }
      );
      const nextResult = (await response.json()) as ActualImportResult;
      setResult(nextResult);
      if (response.ok && nextResult.status === "success") {
        window.setTimeout(() => window.location.reload(), 500);
      }
    } catch {
      setResult({
        status: "error",
        message: "PO actual import failed. Please try again."
      });
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="grid gap-4 bg-slate-50/70 p-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">PO Achievement</h2>
            <p className="mt-1 text-sm text-slate-500">
              {planScopeLabel} · {selectedYear} · {selectedTimeLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsImportOpen((open) => !open)}
            disabled={!canImport}
            className="inline-flex min-h-10 items-center rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
          >
            Import PO actuals
          </button>
        </div>

        {isImportOpen ? (
          <div className="mt-4 grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
              <span>PO workbook</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
                className="block w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
              />
              {fileName ? (
                <span className="truncate text-xs font-medium text-slate-500">
                  {fileName}
                </span>
              ) : null}
            </label>
            <button
              type="button"
              onClick={importActuals}
              disabled={!canImport || isImporting}
              className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              {isImporting ? "Importing..." : "Upload PO workbook"}
            </button>
            {result ? (
              <div
                className={`lg:col-span-2 rounded-md px-3 py-2 text-sm ${
                  result.status === "success"
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-rose-50 text-rose-800"
                }`}
              >
                <div className="font-semibold">{result.message}</div>
                {result.skipped ? (
                  <div className="mt-1 text-xs">{result.skipped} row(s) skipped.</div>
                ) : null}
                {result.errors?.slice(0, 5).map((error) => (
                  <div
                    key={`${error.sheetName}-${error.rowNumber}-${error.message}`}
                    className="mt-1 text-xs"
                  >
                    {error.sheetName} row {error.rowNumber}: {error.message}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
          PO Date determines the month. Qty is Actual SI Units, Turnover (EUR) is Actual INIU SI Value, and PO SKU matches BP Model / SKU. Standard colour SKU aliases are normalized. PO KA is not used for achievement.
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <AchievementKpi
            label="BP SI Units"
            value={formatWhole(summary.targetSiUnits)}
            tone="slate"
          />
          <AchievementKpi
            label="PO SI Units"
            value={formatWhole(summary.actualSiUnits)}
            tone="cyan"
          />
          <AchievementKpi
            label="SI Achievement"
            value={formatAchievementRate(unitRate)}
            tone="emerald"
          />
          <AchievementKpi
            label="BP INIU SI Value"
            value={formatMoney(summary.targetSiValueEur, "EUR")}
            tone="slate"
          />
          <AchievementKpi
            label="PO INIU SI Value"
            value={formatMoney(summary.actualSiValueEur, "EUR")}
            tone="cyan"
          />
          <AchievementKpi
            label="Value Achievement"
            value={formatAchievementRate(valueRate)}
            tone="emerald"
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-sm text-slate-500">
          <span>Actual coverage: {coverageLabel || "No PO actuals imported."}</span>
          {achievement.latestImportedAt ? (
            <span>Latest import: {formatEuropeanDateTime(achievement.latestImportedAt)}</span>
          ) : null}
        </div>
      </section>

      <AchievementMonthTable
        annualSummary={achievement.annualSummary}
        rows={achievement.byMonth}
      />
      <AchievementProductTable
        aggregateProductsAcrossMarkets={aggregateProductsAcrossMarkets}
        rows={sortedProducts}
        sort={productSort}
        onSortChange={setProductSort}
      />
    </div>
  );
}

function AchievementKpi({
  label,
  tone,
  value
}: {
  label: string;
  tone: "cyan" | "emerald" | "slate";
  value: string;
}) {
  const toneClass =
    tone === "cyan"
      ? "border-cyan-100 bg-cyan-50"
      : tone === "emerald"
        ? "border-emerald-100 bg-emerald-50"
        : "border-slate-200 bg-slate-50";

  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 truncate text-xl font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function AchievementMonthTable({
  annualSummary,
  rows
}: {
  annualSummary: ReturnType<typeof buildBusinessPlanAchievement>["annualSummary"];
  rows: ReturnType<typeof buildBusinessPlanAchievement>["byMonth"];
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-base font-semibold text-slate-950">Monthly Achievement</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[920px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Month</th>
              <th className="px-3 py-2 text-right">BP SI</th>
              <th className="px-3 py-2 text-right">PO SI</th>
              <th className="px-3 py-2 text-right">SI Achievement</th>
              <th className="px-3 py-2 text-right">BP INIU SI Value</th>
              <th className="px-3 py-2 text-right">PO INIU SI Value</th>
              <th className="px-3 py-2 text-right">Value Achievement</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.month} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-950">{row.label}</td>
                <td className="px-3 py-2 text-right text-slate-700">{formatWhole(row.targetSiUnits)}</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-950">{formatWhole(row.actualSiUnits)}</td>
                <td className="px-3 py-2 text-right text-slate-700">{formatAchievementRate(achievementRate(row.actualSiUnits, row.targetSiUnits))}</td>
                <td className="px-3 py-2 text-right text-slate-700">{formatMoney(row.targetSiValueEur, "EUR")}</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-950">{formatMoney(row.actualSiValueEur, "EUR")}</td>
                <td className="px-3 py-2 text-right text-slate-700">{formatAchievementRate(achievementRate(row.actualSiValueEur, row.targetSiValueEur))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-200 bg-slate-50 text-sm">
            <tr>
              <td className="px-3 py-3 font-semibold text-slate-950">Annual total</td>
              <td className="px-3 py-3 text-right font-semibold text-slate-950">{formatWhole(annualSummary.targetSiUnits)}</td>
              <td className="px-3 py-3 text-right font-semibold text-slate-950">{formatWhole(annualSummary.actualSiUnits)}</td>
              <td className="px-3 py-3 text-right font-semibold text-slate-950">{formatAchievementRate(achievementRate(annualSummary.actualSiUnits, annualSummary.targetSiUnits))}</td>
              <td className="px-3 py-3 text-right font-semibold text-slate-950">{formatMoney(annualSummary.targetSiValueEur, "EUR")}</td>
              <td className="px-3 py-3 text-right font-semibold text-slate-950">{formatMoney(annualSummary.actualSiValueEur, "EUR")}</td>
              <td className="px-3 py-3 text-right font-semibold text-slate-950">{formatAchievementRate(achievementRate(annualSummary.actualSiValueEur, annualSummary.targetSiValueEur))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function AchievementProductTable({
  aggregateProductsAcrossMarkets,
  onSortChange,
  rows,
  sort
}: {
  aggregateProductsAcrossMarkets: boolean;
  rows: ReturnType<typeof buildBusinessPlanAchievement>["byProduct"];
  sort: BusinessPlanAchievementProductSort;
  onSortChange: (sort: BusinessPlanAchievementProductSort) => void;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <h3 className="text-base font-semibold text-slate-950">
          {aggregateProductsAcrossMarkets
            ? "Product Achievement · All markets"
            : "Product Achievement"}
        </h3>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <span className="text-xs font-medium text-slate-500">
            {aggregateProductsAcrossMarkets
              ? "Same Model / SKU is aggregated across markets, with standard colour aliases"
              : "Exact country and PO SKU to BP Model / SKU match, with standard colour aliases"}
          </span>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <span className="whitespace-nowrap">Sort products</span>
            <select
              value={sort}
              onChange={(event) =>
                onSortChange(event.target.value as BusinessPlanAchievementProductSort)
              }
              className="min-h-9 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-900 outline-none focus:border-slate-500"
            >
              <option value="TARGET_SI_DESC">BP SI: high to low</option>
              <option value="ACTUAL_SI_DESC">PO SI: high to low</option>
              <option value="SI_ACHIEVEMENT_DESC">SI Achievement: high to low</option>
              <option value="TARGET_VALUE_DESC">BP Value: high to low</option>
              <option value="VALUE_ACHIEVEMENT_DESC">Value Achievement: high to low</option>
            </select>
          </label>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {!aggregateProductsAcrossMarkets ? (
                <th className="px-3 py-2">Country</th>
              ) : null}
              <th className="px-3 py-2">Model / SKU</th>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2 text-right">BP SI</th>
              <th className="px-3 py-2 text-right">PO SI</th>
              <th className="px-3 py-2 text-right">SI Achievement</th>
              <th className="px-3 py-2 text-right">BP INIU SI Value</th>
              <th className="px-3 py-2 text-right">PO INIU SI Value</th>
              <th className="px-3 py-2 text-right">Value Achievement</th>
              <th className="px-3 py-2">BP Match</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={aggregateProductsAcrossMarkets ? 9 : 10}
                  className="px-3 py-6 text-center text-slate-500"
                >
                  No BP or PO actual data in this scope.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={`${row.countryCode}-${row.productModel}-${row.productName}`} className="hover:bg-slate-50">
                  {!aggregateProductsAcrossMarkets ? (
                    <td className="px-3 py-2 font-medium text-slate-950">{row.countryCode}</td>
                  ) : null}
                  <td className="px-3 py-2 font-medium text-slate-950">{row.productModel}</td>
                  <td className="px-3 py-2 text-slate-700">{row.productName}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{formatWhole(row.targetSiUnits)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-950">{formatWhole(row.actualSiUnits)}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{formatAchievementRate(achievementRate(row.actualSiUnits, row.targetSiUnits))}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{formatMoney(row.targetSiValueEur, "EUR")}</td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-950">{formatMoney(row.actualSiValueEur, "EUR")}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{formatAchievementRate(achievementRate(row.actualSiValueEur, row.targetSiValueEur))}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${row.hasBpProductMatch ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                      {row.hasBpProductMatch ? "Matched" : "No BP product match"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatWhole(value: number) {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value);
}

function formatAchievementRate(value: number | null) {
  return value === null ? "-" : formatPercent(value);
}

function formatCoverage(
  coverage: Array<{ countryCode: string; months: number[] }>
) {
  return coverage
    .map((scope) => {
      const labels = scope.months.map((month) => shortMonth(month));
      return `${scope.countryCode} ${labels.join(", ")}`;
    })
    .join(" · ");
}

function shortMonth(month: number) {
  return new Intl.DateTimeFormat("en-GB", { month: "short" }).format(
    new Date(Date.UTC(2026, month - 1, 1))
  );
}
