"use client";

import { useMemo, useState } from "react";
import { formatMoney, formatPercent } from "@/lib/format";
import type { ScenarioComparisonRow, ScenarioType } from "@/lib/types";
import { controlClass } from "./FormControls";
import { WarningBadge } from "./WarningBadge";

type SortKey =
  | "name"
  | "country"
  | "sku"
  | "type"
  | "gpPercent"
  | "npPercent"
  | "totalRebate"
  | "warningLevel"
  | "status";

export function ScenarioComparisonTable({
  rows
}: {
  rows: ScenarioComparisonRow[];
}) {
  const [country, setCountry] = useState("ALL");
  const [channel, setChannel] = useState("ALL");
  const [sku, setSku] = useState("ALL");
  const [type, setType] = useState<ScenarioType | "ALL">("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const countries = unique(rows.map((row) => row.countryCode));
  const channels = unique(rows.map((row) => row.channel));
  const skus = unique(rows.map((row) => row.sku));

  const filteredRows = useMemo(() => {
    const filtered = rows.filter(
      (row) =>
        (country === "ALL" || row.countryCode === country) &&
        (channel === "ALL" || row.channel === channel) &&
        (sku === "ALL" || row.sku === sku) &&
        (type === "ALL" || row.type === type)
    );

    return [...filtered].sort((left, right) => {
      const modifier = sortDirection === "asc" ? 1 : -1;
      return compareValues(valueFor(left, sortKey), valueFor(right, sortKey)) * modifier;
    });
  }, [channel, country, rows, sku, sortDirection, sortKey, type]);

  function updateSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-2 border-b border-slate-200 pb-4">
        <h2 className="text-lg font-semibold text-slate-950">
          Scenario Comparison
        </h2>
        <p className="text-sm text-slate-500">
          Filter and sort saved normal and promotion scenarios across countries,
          channels, and SKUs.
        </p>
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <FilterSelect label="Country" value={country} onChange={setCountry}>
          <option value="ALL">All countries</option>
          {countries.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Channel" value={channel} onChange={setChannel}>
          <option value="ALL">All channels</option>
          {channels.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="SKU" value={sku} onChange={setSku}>
          <option value="ALL">All SKUs</option>
          {skus.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Scenario type"
          value={type}
          onChange={(value) => setType(value as ScenarioType | "ALL")}
        >
          <option value="ALL">All types</option>
          <option value="NORMAL">Normal</option>
          <option value="PROMOTION">Promotion</option>
        </FilterSelect>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1120px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs font-semibold text-slate-500">
            <tr>
              <SortHeader label="Scenario Name" sortKey="name" active={sortKey} direction={sortDirection} onClick={updateSort} />
              <SortHeader label="Country" sortKey="country" active={sortKey} direction={sortDirection} onClick={updateSort} />
              <SortHeader label="SKU" sortKey="sku" active={sortKey} direction={sortDirection} onClick={updateSort} />
              <th className="py-2 pr-4">Channel / KA</th>
              <SortHeader label="Type" sortKey="type" active={sortKey} direction={sortDirection} onClick={updateSort} />
              <th className="py-2 pr-4">Normal RRP</th>
              <th className="py-2 pr-4">Promo RRPP</th>
              <th className="py-2 pr-4">Rebate / Unit</th>
              <SortHeader label="Total Rebate" sortKey="totalRebate" active={sortKey} direction={sortDirection} onClick={updateSort} />
              <th className="py-2 pr-4">GP</th>
              <SortHeader label="GP%" sortKey="gpPercent" active={sortKey} direction={sortDirection} onClick={updateSort} />
              <th className="py-2 pr-4">NP</th>
              <SortHeader label="NP%" sortKey="npPercent" active={sortKey} direction={sortDirection} onClick={updateSort} />
              <SortHeader label="Warning" sortKey="warningLevel" active={sortKey} direction={sortDirection} onClick={updateSort} />
              <SortHeader label="Status" sortKey="status" active={sortKey} direction={sortDirection} onClick={updateSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.map((row) => (
              <tr key={row.id}>
                <td className="py-3 pr-4 font-medium text-slate-950">
                  {row.name}
                </td>
                <td className="py-3 pr-4 text-slate-600">{row.countryCode}</td>
                <td className="py-3 pr-4 text-slate-600">{row.sku}</td>
                <td className="py-3 pr-4 text-slate-600">
                  {row.channel} / {row.kaName}
                </td>
                <td className="py-3 pr-4 text-slate-600">{row.type}</td>
                <td className="py-3 pr-4 text-slate-600">
                  {moneyOrDash(row.normalRrp, row.currency)}
                </td>
                <td className="py-3 pr-4 text-slate-600">
                  {moneyOrDash(row.promoRrp, row.currency)}
                </td>
                <td className="py-3 pr-4 text-slate-600">
                  {moneyOrDash(row.rebatePerUnit, row.currency)}
                </td>
                <td className="py-3 pr-4 text-slate-600">
                  {moneyOrDash(row.totalRebate, row.currency)}
                </td>
                <td className="py-3 pr-4 text-slate-600">
                  {moneyOrDash(row.gp, row.currency)}
                </td>
                <td className="py-3 pr-4 text-slate-600">
                  {percentOrDash(row.gpPercent)}
                </td>
                <td className="py-3 pr-4 text-slate-600">
                  {moneyOrDash(row.np, row.currency)}
                </td>
                <td className="py-3 pr-4 text-slate-600">
                  {percentOrDash(row.npPercent)}
                </td>
                <td className="py-3 pr-4">
                  <WarningBadge level={row.warningLevel} />
                </td>
                <td className="py-3 pr-4 text-slate-600">{row.status}</td>
              </tr>
            ))}
            {filteredRows.length === 0 ? (
              <tr>
                <td className="py-6 text-slate-500" colSpan={15}>
                  No scenarios match the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <select
        className={controlClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

function SortHeader({
  label,
  sortKey,
  active,
  direction,
  onClick
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  direction: "asc" | "desc";
  onClick: (key: SortKey) => void;
}) {
  const indicator = active === sortKey ? (direction === "asc" ? "up" : "down") : "";

  return (
    <th className="py-2 pr-4">
      <button
        type="button"
        className="text-left text-xs font-semibold text-slate-600 hover:text-slate-950"
        onClick={() => onClick(sortKey)}
      >
        {label}
        {indicator ? <span className="ml-1 text-slate-400">{indicator}</span> : null}
      </button>
    </th>
  );
}

function unique(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function valueFor(row: ScenarioComparisonRow, key: SortKey) {
  if (key === "country") {
    return row.countryCode;
  }

  return row[key] ?? "";
}

function compareValues(left: string | number, right: string | number) {
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  return String(left).localeCompare(String(right));
}

function moneyOrDash(value: number | null, currency: string) {
  return value === null ? "-" : formatMoney(value, currency);
}

function percentOrDash(value: number | null) {
  return value === null ? "-" : formatPercent(value);
}
