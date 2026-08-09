"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PromotionTableRow } from "@/lib/calculatorRows";
import { formatEuropeanDate } from "@/lib/format";
import {
  buildPromotionMap,
  buildPromotionMapProductOptions,
  filterPromotionMapRowsByProduct,
  type PromotionMapBlock,
  type PromotionMapGroup,
  type PromotionMapMonth,
  type PromotionMapProductOption
} from "@/lib/promotionMap";
import { isOutsideDropdownTarget } from "./dropdownOutsideClick";

type MapMode = "filtered" | "all";

export function PromotionMapDialog({
  filteredRows,
  allRows,
  month,
  monthKey,
  onClose
}: {
  filteredRows: PromotionTableRow[];
  allRows: PromotionTableRow[];
  month: PromotionMapMonth;
  monthKey: string;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<MapMode>("filtered");
  const [productFilters, setProductFilters] = useState<string[]>([]);
  const [productFilterMenuOpen, setProductFilterMenuOpen] = useState(false);
  const [selectedBlockKey, setSelectedBlockKey] = useState<string | null>(null);
  const sourceRows = mode === "filtered" ? filteredRows : allRows;
  const productOptions = useMemo(
    () => buildPromotionMapProductOptions(sourceRows),
    [sourceRows]
  );
  const mapRows = useMemo(
    () => filterPromotionMapRowsByProduct(sourceRows, productFilters),
    [productFilters, sourceRows]
  );
  const map = useMemo(
    () => buildPromotionMap({ rows: mapRows, month }),
    [mapRows, month]
  );
  const selectedBlock = useMemo(() => {
    if (!selectedBlockKey) {
      return null;
    }

    for (const group of map.groups) {
      const block = group.blocks.find((candidate) => candidate.key === selectedBlockKey);
      if (block) {
        return { group, block };
      }
    }

    return null;
  }, [map.groups, selectedBlockKey]);

  useEffect(() => {
    const validProductValues = new Set(productOptions.map((option) => option.value));
    const nextProductFilters = productFilters.filter((value) =>
      validProductValues.has(value)
    );

    if (nextProductFilters.length !== productFilters.length) {
      setProductFilters(nextProductFilters);
    }
  }, [productFilters, productOptions]);

  return (
    <div
      aria-label="Promotion map"
      aria-modal="true"
      className="fixed inset-0 z-[300] bg-slate-950/40 p-3 sm:p-5"
      role="dialog"
    >
      <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              {monthKey} Promotion map
            </h2>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Review countries, channels, periods, products, and prices in one calendar view.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <ProductFilterDropdown
              isOpen={productFilterMenuOpen}
              onOpenChange={setProductFilterMenuOpen}
              onSelectionChange={(nextFilters) => {
                setProductFilters(nextFilters);
                setSelectedBlockKey(null);
              }}
              options={productOptions}
              selectedValues={productFilters}
              totalRows={sourceRows.length}
            />
            <div className="inline-flex rounded-md border border-slate-300 bg-slate-50 p-0.5 text-xs font-semibold">
              <button
                className={modeButtonClass(mode === "filtered")}
                type="button"
                onClick={() => {
                  setMode("filtered");
                  setProductFilters([]);
                  setProductFilterMenuOpen(false);
                  setSelectedBlockKey(null);
                }}
              >
                Filtered rows
              </button>
              <button
                className={modeButtonClass(mode === "all")}
                type="button"
                onClick={() => {
                  setMode("all");
                  setProductFilters([]);
                  setProductFilterMenuOpen(false);
                  setSelectedBlockKey(null);
                }}
              >
                All month rows
              </button>
            </div>
            <button
              className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              type="button"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] gap-3 overflow-hidden p-3">
          <div className="min-h-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            {sourceRows.length === 0 ? (
              <div className="grid h-full min-h-80 place-items-center px-4 text-center">
                <div>
                  <div className="text-sm font-semibold text-slate-950">
                    No promotion rows to map for this view.
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Switch to all month rows or add promotion rows first.
                  </div>
                </div>
              </div>
            ) : mapRows.length === 0 ? (
              <div className="grid h-full min-h-80 place-items-center px-4 text-center">
                <div>
                  <div className="text-sm font-semibold text-slate-950">
                    No rows match this product filter.
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Choose another product or switch back to all products.
                  </div>
                </div>
              </div>
            ) : map.groups.length === 0 ? (
              <div className="grid h-full min-h-80 place-items-center px-4 text-center">
                <div>
                  <div className="text-sm font-semibold text-slate-950">
                    No visible promo periods in {monthKey}.
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Check promo start and end dates for the selected rows.
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full overflow-auto">
                <div
                  className="sticky top-0 z-20 grid min-w-[900px] border-b border-slate-200 bg-white"
                  style={mapGridStyle(map.days.length)}
                >
                  <div className="sticky left-0 z-30 border-r border-slate-300 bg-white px-2.5 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Market / channel
                  </div>
                  {map.days.map((day, index) => (
                    <div
                      key={day.date}
                      title={day.label}
                      className={`border-r border-slate-200 px-0.5 py-2 text-center text-[9px] font-semibold text-slate-600 ${
                        index % 2 === 0 ? "bg-slate-50" : "bg-white"
                      }`}
                    >
                      {day.dayOfMonth}
                    </div>
                  ))}
                </div>
                <div className="min-w-[900px] bg-white">
                  {map.groups.map((group) => (
                    <PromotionMapGroupRow
                      key={group.key}
                      dayCount={map.days.length}
                      group={group}
                      selectedBlockKey={selectedBlockKey}
                      onSelectBlock={setSelectedBlockKey}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="max-h-52 overflow-auto rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-950">
                Block details
              </h3>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                {mapRows.length} rows
              </span>
            </div>
            {selectedBlock ? (
              <PromotionMapDetails group={selectedBlock.group} block={selectedBlock.block} />
            ) : (
              <div className="mt-4 rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs font-medium text-slate-500">
                Select a promo block to review product, price, margin, volume,
                NP, and NP%.
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}

function ProductFilterDropdown({
  isOpen,
  onOpenChange,
  onSelectionChange,
  options,
  selectedValues,
  totalRows
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSelectionChange: (selectedValues: string[]) => void;
  options: PromotionMapProductOption[];
  selectedValues: string[];
  totalRows: number;
}) {
  const selectedSet = new Set(selectedValues);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const selectedOptions = options.filter((option) => selectedSet.has(option.value));
  const label =
    selectedOptions.length === 0
      ? `All products (${totalRows})`
      : selectedOptions.length === 1
        ? selectedOptions[0]?.label ?? "1 selected"
        : `${selectedOptions.length} products selected`;

  const toggleValue = (value: string) => {
    if (selectedSet.has(value)) {
      onSelectionChange(selectedValues.filter((selectedValue) => selectedValue !== value));
      return;
    }

    onSelectionChange([...selectedValues, value]);
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (isOutsideDropdownTarget(dropdownRef.current, event.target)) {
        onOpenChange(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen, onOpenChange]);

  return (
    <div
      ref={dropdownRef}
      className="relative grid gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500"
    >
      Products
      <button
        aria-expanded={isOpen}
        className="flex h-8 min-w-72 max-w-[22rem] items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-2 text-left text-xs font-semibold normal-case tracking-normal text-slate-800 shadow-sm hover:bg-slate-50"
        type="button"
        onClick={() => onOpenChange(!isOpen)}
      >
        <span className="truncate">{label}</span>
        <span className="text-slate-400">v</span>
      </button>
      {isOpen ? (
        <div className="absolute right-0 top-full z-40 mt-1 w-[25rem] max-w-[calc(100vw-2rem)] rounded-lg border border-slate-200 bg-white p-2 text-xs font-semibold normal-case tracking-normal text-slate-800 shadow-xl">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-1 pb-2">
            <button
              className="flex items-center gap-2 rounded px-2 py-1 text-left hover:bg-slate-50"
              type="button"
              onClick={() => onSelectionChange([])}
            >
              <span
                aria-hidden
                className={`grid h-4 w-4 place-items-center rounded border text-[10px] ${
                  selectedValues.length === 0
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-300 bg-white text-transparent"
                }`}
              >
                ✓
              </span>
              All products
            </button>
            {selectedValues.length > 0 ? (
              <button
                className="rounded px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-500 hover:bg-slate-50"
                type="button"
                onClick={() => onSelectionChange([])}
              >
                Clear
              </button>
            ) : null}
          </div>
          <div className="mt-2 max-h-72 overflow-auto">
            {options.map((option) => (
              <button
                key={option.value}
                className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left hover:bg-slate-50"
                type="button"
                onClick={() => toggleValue(option.value)}
              >
                <span
                  aria-hidden
                  className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px] ${
                    selectedSet.has(option.value)
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-300 bg-white text-transparent"
                  }`}
                >
                  ✓
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-slate-900">{option.label}</span>
                  <span className="text-[11px] text-slate-500">
                    {option.count} promo rows
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PromotionMapGroupRow({
  group,
  dayCount,
  selectedBlockKey,
  onSelectBlock
}: {
  group: PromotionMapGroup;
  dayCount: number;
  selectedBlockKey: string | null;
  onSelectBlock: (key: string) => void;
}) {
  const height = Math.max(
    72,
    group.blocks.reduce(
      (sum) => sum + blockVisualHeight(),
      16
    )
  );
  let blockTop = 8;

  return (
    <div
      className="grid border-b border-slate-200 last:border-b-0"
      style={mapGridStyle(dayCount)}
    >
      <div
        className="sticky left-0 z-10 border-r border-slate-300 bg-white px-3 py-3"
        style={{ height }}
      >
        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
          {group.countryCode}
        </div>
        <div className="mt-1 text-sm font-semibold leading-tight text-slate-950">
          {group.channelName}
        </div>
        <div className="mt-2 text-[11px] font-medium text-slate-500">
          {group.blocks.reduce((sum, block) => sum + block.items.length, 0)} product rows
        </div>
      </div>
      <div
        className="relative col-span-full col-start-2 overflow-hidden bg-white"
        style={{ height }}
      >
        <div
          aria-hidden
          className="absolute inset-0 grid"
          style={{ gridTemplateColumns: `repeat(${dayCount}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: dayCount }, (_, index) => (
            <div
              key={index}
              className={`border-r border-slate-100 ${
                index % 2 === 0 ? "bg-slate-50/60" : "bg-white"
              }`}
            />
          ))}
        </div>
        {group.blocks.map((block) => {
          const top = blockTop;
          blockTop += blockVisualHeight();

          return (
            <PromotionMapBlockButton
              key={block.key}
              block={block}
              dayCount={dayCount}
              selected={block.key === selectedBlockKey}
              top={top}
              onSelect={() => onSelectBlock(block.key)}
            />
          );
        })}
      </div>
    </div>
  );
}

function PromotionMapBlockButton({
  block,
  dayCount,
  selected,
  top,
  onSelect
}: {
  block: PromotionMapBlock;
  dayCount: number;
  selected: boolean;
  top: number;
  onSelect: () => void;
}) {
  const hasMoreItems = block.items.length > 2;

  return (
    <button
      className={`absolute rounded-md border px-2 py-1 text-left shadow-sm transition hover:-translate-y-px hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-400 ${blockColorClass(
        block.colorIndex
      )} ${selected ? "ring-2 ring-slate-900" : ""}`}
      style={{
        left: `${(block.startDayIndex / dayCount) * 100}%`,
        top: `${top}px`,
        width: `calc(${(block.spanDays / dayCount) * 100}% - 4px)`,
        minWidth: "112px"
      }}
      type="button"
      onClick={onSelect}
      onMouseEnter={onSelect}
    >
      <div className="truncate text-[11px] font-bold text-slate-950">
        {block.items.length === 1
          ? block.items[0]?.productName
          : `${block.items.length} products`}
      </div>
      <div
        className={`mt-0.5 grid max-h-[3.45rem] gap-0.5 overflow-y-auto pr-1 text-[10px] font-semibold leading-tight text-slate-700 ${
          hasMoreItems ? "border-r border-slate-300/70" : ""
        }`}
      >
        {block.items.map((item) => (
          <div key={item.key} className="min-w-0">
            <div className="truncate">
              {item.productName}: {item.primaryPrice}
            </div>
            <div className="truncate text-[9px] font-medium text-slate-500">
              {item.model}
            </div>
          </div>
        ))}
      </div>
    </button>
  );
}

function PromotionMapDetails({
  group,
  block
}: {
  group: PromotionMapGroup;
  block: PromotionMapBlock;
}) {
  return (
    <div className="mt-3 grid gap-3">
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
          {group.countryCode} · {group.channelName}
        </div>
        <div className="mt-1 text-xs font-semibold text-slate-700">
          {formatEuropeanDate(block.startDate)} to {formatEuropeanDate(block.endDate)}
        </div>
      </div>
      <div className="grid gap-2 lg:grid-cols-2 2xl:grid-cols-3">
        {block.items.map((item) => (
          <div
            key={item.key}
            className="rounded-md border border-slate-200 bg-white px-3 py-2"
          >
            <div className="text-sm font-semibold leading-tight text-slate-950">
              {item.productName}
            </div>
            <div className="mt-0.5 text-[11px] font-semibold text-slate-500">
              {item.model} · FD {item.fdName}
            </div>
            {item.dealType !== "NORMAL" ? (
              <div className="mt-1 inline-flex rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                {item.dealTypeLabel}
                {item.fdMarginImpactLabel
                  ? ` · FD impact ${item.fdMarginImpactLabel}`
                  : ""}
              </div>
            ) : null}
            <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
              <DetailMetric label="RRPP" value={item.primaryPrice} />
              <DetailMetric label="RRPP EUR" value={item.secondaryPrice ?? item.primaryPrice} />
              <DetailMetric label="Margin" value={item.promoFrontMarginLabel} />
              <DetailMetric label="Volume" value={item.promoVolumeLabel} />
              <DetailMetric label="NP" value={item.npLabel} />
              <DetailMetric label="NP%" value={item.npPercentLabel} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-100 bg-slate-50 px-2 py-1">
      <div className="font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-0.5 font-semibold text-slate-800">{value}</div>
    </div>
  );
}

function modeButtonClass(active: boolean) {
  return `h-7 rounded px-2.5 ${
    active ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-white"
  }`;
}

function mapGridStyle(dayCount: number) {
  return {
    gridTemplateColumns: `168px repeat(${dayCount}, minmax(0, 1fr))`
  };
}

function blockVisualHeight() {
  return 82;
}

function blockColorClass(index: number) {
  const colors = [
    "border-emerald-200 bg-emerald-100/90",
    "border-sky-200 bg-sky-100/90",
    "border-amber-200 bg-amber-100/90",
    "border-violet-200 bg-violet-100/90",
    "border-rose-200 bg-rose-100/90",
    "border-teal-200 bg-teal-100/90"
  ];

  return colors[index % colors.length] ?? colors[0];
}
