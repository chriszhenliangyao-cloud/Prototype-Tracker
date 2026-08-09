"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CalculatorFilters, NormalTableRow } from "@/lib/calculatorRows";
import {
  areCalculatorFiltersEqual,
  buildCalculatorFilterOptions,
  calculatorFilterValues,
  type CalculatorFilterField,
  normalizeCalculatorFilters,
  setCalculatorFilterValue
} from "@/lib/calculatorFilterOptions";
import { formatPercent } from "@/lib/format";
import { isOutsideDropdownTarget } from "./dropdownOutsideClick";

const triggerClass =
  "flex h-8 min-w-0 items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-800 outline-none transition hover:border-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-200";

export function WideTableFilters({
  rows,
  filters,
  onChange,
  synchronizeProductIdentity = false
}: {
  rows: NormalTableRow[];
  filters: CalculatorFilters;
  onChange: (
    filters: CalculatorFilters,
    changedField?: CalculatorFilterField
  ) => void;
  synchronizeProductIdentity?: boolean;
}) {
  const normalizedFilters = useMemo(
    () => normalizeCalculatorFilters(rows, filters),
    [rows, filters]
  );
  const filterOptions = useMemo(
    () => buildCalculatorFilterOptions(rows, normalizedFilters),
    [rows, normalizedFilters]
  );
  const kaBuyingMarginValue = calculatorFilterValues(
    normalizedFilters,
    "kaBuyingMargin"
  );
  const [openFilter, setOpenFilter] = useState<CalculatorFilterField | null>(
    null
  );
  const filterRootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!areCalculatorFiltersEqual(filters, normalizedFilters)) {
      onChange(normalizedFilters);
    }
  }, [filters, normalizedFilters, onChange]);

  useEffect(() => {
    if (!openFilter) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (isOutsideDropdownTarget(filterRootRef.current, event.target)) {
        setOpenFilter(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [openFilter]);

  function updateFilter(field: CalculatorFilterField, values: string[]) {
    const filtersForUpdate =
      synchronizeProductIdentity &&
      (field === "model" || field === "productName")
        ? clearPairedProductFilter(normalizedFilters, field)
        : normalizedFilters;
    onChange(
      setCalculatorFilterValue(rows, filtersForUpdate, field, values),
      field
    );
  }

  return (
    <section
      ref={filterRootRef}
      className="relative z-[90] grid gap-2 rounded-lg border border-slate-200 bg-slate-50/80 p-2.5 md:grid-cols-3 xl:grid-cols-7"
    >
      <FilterMultiSelect
        field="countryCode"
        label="Country"
        open={openFilter === "countryCode"}
        value={calculatorFilterValues(normalizedFilters, "countryCode")}
        options={filterOptions.countryCode}
        onOpenChange={(open) => setOpenFilter(open ? "countryCode" : null)}
        onChange={(countryCode) => updateFilter("countryCode", countryCode)}
      />
      <FilterMultiSelect
        field="channelName"
        label="Channel / Retailer"
        open={openFilter === "channelName"}
        value={calculatorFilterValues(normalizedFilters, "channelName")}
        options={filterOptions.channelName}
        onOpenChange={(open) => setOpenFilter(open ? "channelName" : null)}
        onChange={(channelName) => updateFilter("channelName", channelName)}
      />
      <FilterMultiSelect
        field="fdName"
        label="FD"
        open={openFilter === "fdName"}
        value={calculatorFilterValues(normalizedFilters, "fdName")}
        options={filterOptions.fdName}
        onOpenChange={(open) => setOpenFilter(open ? "fdName" : null)}
        onChange={(fdName) => updateFilter("fdName", fdName)}
      />
      <FilterMultiSelect
        field="model"
        label="Model"
        open={openFilter === "model"}
        value={calculatorFilterValues(normalizedFilters, "model")}
        options={filterOptions.model}
        onOpenChange={(open) => setOpenFilter(open ? "model" : null)}
        onChange={(model) => updateFilter("model", model)}
      />
      <FilterMultiSelect
        field="category"
        label="Category"
        open={openFilter === "category"}
        value={calculatorFilterValues(normalizedFilters, "category")}
        options={filterOptions.category}
        onOpenChange={(open) => setOpenFilter(open ? "category" : null)}
        onChange={(category) => updateFilter("category", category)}
      />
      <FilterMultiSelect
        field="productName"
        label="Product Name"
        open={openFilter === "productName"}
        value={calculatorFilterValues(normalizedFilters, "productName")}
        options={filterOptions.productName}
        onOpenChange={(open) => setOpenFilter(open ? "productName" : null)}
        onChange={(productName) => updateFilter("productName", productName)}
      />
      <FilterMultiSelect
        field="kaBuyingMargin"
        label="KA Margin"
        open={openFilter === "kaBuyingMargin"}
        value={kaBuyingMarginValue}
        options={filterOptions.kaBuyingMargin}
        formatOption={(option) => formatPercent(Number(option))}
        onOpenChange={(open) => setOpenFilter(open ? "kaBuyingMargin" : null)}
        onChange={(value) => updateFilter("kaBuyingMargin", value)}
      />
    </section>
  );
}

function clearPairedProductFilter(
  filters: CalculatorFilters,
  field: "model" | "productName"
): CalculatorFilters {
  const nextFilters = { ...filters };
  delete nextFilters[field === "model" ? "productName" : "model"];
  return nextFilters;
}

function FilterMultiSelect({
  field,
  label,
  open,
  value,
  options,
  formatOption,
  onOpenChange,
  onChange
}: {
  field: CalculatorFilterField;
  label: string;
  open: boolean;
  value: string[];
  options: string[];
  formatOption?: (option: string) => string;
  onOpenChange: (open: boolean) => void;
  onChange: (value: string[]) => void;
}) {
  const selected = value.filter((option) => options.includes(option));
  const summary = selectedSummary(selected, formatOption);

  function toggleOption(option: string) {
    onChange(
      selected.includes(option)
        ? selected.filter((selectedOption) => selectedOption !== option)
        : [...selected, option]
    );
  }

  return (
    <div className="relative z-[100] grid gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
      <span>{label}</span>
      <details className="group" open={open}>
        <summary
          aria-controls={`${field}-filter-options`}
          aria-expanded={open}
          className={`${triggerClass} list-none`}
          onClick={(event) => {
            event.preventDefault();
            onOpenChange(!open);
          }}
        >
          <span className="truncate normal-case tracking-normal">{summary}</span>
          <span className="text-[10px] text-slate-400" aria-hidden="true">
            v
          </span>
        </summary>
        <div
          className="absolute z-[120] mt-1 w-full min-w-56 rounded-md border border-slate-200 bg-white p-2 text-[11px] font-medium normal-case tracking-normal text-slate-800 shadow-lg"
          id={`${field}-filter-options`}
        >
          <div className="mb-1 flex items-center justify-between gap-2 border-b border-slate-100 pb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {selected.length === 0 ? "All" : `${selected.length} selected`}
            </span>
            {selected.length > 0 ? (
              <button
                className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-100"
                type="button"
                onClick={() => onChange([])}
              >
                Clear
              </button>
            ) : null}
          </div>
          <div className="grid max-h-56 gap-1 overflow-auto">
            <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 font-semibold hover:bg-slate-50">
              <input
                checked={selected.length === 0}
                className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900"
                type="checkbox"
                onChange={() => onChange([])}
              />
              <span>All</span>
            </label>
            {options.length === 0 ? (
              <span className="px-1 py-1 text-slate-400">No options</span>
            ) : (
              options.map((option) => (
                <label
                  key={option}
                  className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-slate-50"
                >
                  <input
                    checked={selected.includes(option)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900"
                    type="checkbox"
                    onChange={() => toggleOption(option)}
                  />
                  <span className="truncate">
                    {formatOption ? formatOption(option) : option}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      </details>
    </div>
  );
}

function selectedSummary(
  selected: string[],
  formatOption?: (option: string) => string
) {
  if (selected.length === 0) {
    return "All";
  }

  if (selected.length === 1) {
    return formatOption ? formatOption(selected[0]) : selected[0];
  }

  return `${selected.length} selected`;
}
