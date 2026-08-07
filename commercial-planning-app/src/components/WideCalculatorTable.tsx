import { useState, type HTMLAttributes, type ReactNode } from "react";
import { EuropeanDateInput } from "./EuropeanDateInput";
import { formatMoney, formatPercent } from "@/lib/format";
import {
  marginRatioToPercentInput,
  percentInputToMarginRatio
} from "@/lib/marginInput";
import type {
  NormalTableRow,
  PromotionTableRow,
  RrppSimulationTableRow
} from "@/lib/calculatorRows";
import type { WarningLevel } from "@/lib/calculations/valueChain";

const headerClass =
  "border border-slate-300 bg-[#d9ebc9] px-1.5 py-1.5 text-center text-[10px] font-bold leading-tight text-slate-900";
const subHeaderClass =
  "border border-slate-300 bg-[#edf6e6] px-1.5 py-1 text-center text-[9px] font-bold uppercase tracking-wide text-slate-600";
const cellClass =
  "border border-slate-300 bg-white px-1.5 py-1 text-center text-[11px] leading-tight text-slate-900";
const leftCellClass = `${cellClass} text-left`;
const splitCellClass = `${cellClass} border-l-2 border-l-indigo-200`;
const settlementCellClass = `${cellClass} bg-emerald-50/80`;
const compactScopeHeaderClass =
  "border border-slate-300 bg-[#d9ebc9] px-1 py-1 text-center text-[9px] font-bold leading-tight text-slate-900";
const compactScopeCellClass =
  "border border-slate-300 bg-white px-1 py-1 text-center align-middle text-[10px] leading-tight text-slate-900 whitespace-normal break-words";
const compactScopeLeftCellClass = `${compactScopeCellClass} text-left`;
const inputClass =
  "h-7 w-20 rounded border border-slate-300 bg-white px-1.5 text-right text-[11px] text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200";
const compactInputClass =
  "h-6 w-full min-w-0 rounded border border-slate-300 bg-white px-1 text-right text-[10px] text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200";
const compactTextInputClass =
  "h-6 w-full min-w-0 rounded border border-slate-300 bg-white px-1 text-left text-[10px] text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200";
const simulationCellClass =
  "border border-slate-300 bg-white px-1 py-1 text-center text-[10px] leading-tight text-slate-900";
const simulationLeftCellClass = `${simulationCellClass} text-left`;
const simulationSplitCellClass = `${simulationCellClass} border-l-2 border-l-indigo-200`;
const promotionCellClass =
  "overflow-hidden border border-slate-300 bg-white px-1 py-1 text-center align-middle text-[10px] leading-tight text-slate-900";
const promotionLeftCellClass = `${promotionCellClass} text-left`;
const promotionSplitCellClass = `${promotionCellClass} border-l-2 border-l-indigo-200`;
type PromotionInputField =
  | "promoRrpLocal"
  | "promoVolume"
  | "promoFrontMargin"
  | "dealType"
  | "promoFdMargin"
  | "promotionName"
  | "dealNote"
  | "promoStartDate"
  | "promoEndDate";
type RrppInputField =
  | "rrppLocal"
  | "kaBuyingMargin"
  | "actualFrontMargin"
  | "promoFrontMargin"
  | "dealType"
  | "promoFdMargin";
type NormalWideTableMode = "full" | "simulation";

export function NormalWideTable({
  rows,
  onRrppInputChange,
  mode = "full",
  freezeScopeColumns = false,
  renderSimulationOrderControls,
  getSimulationRowAttributes
}: {
  rows: RrppSimulationTableRow[];
  onRrppInputChange: (
    key: string,
    field: RrppInputField,
    value: string
  ) => void;
  mode?: NormalWideTableMode;
  freezeScopeColumns?: boolean;
  renderSimulationOrderControls?: (
    row: RrppSimulationTableRow,
    rowIndex: number,
    rowCount: number
  ) => ReactNode;
  getSimulationRowAttributes?: (
    row: RrppSimulationTableRow,
    rowIndex: number,
    rowCount: number
  ) => HTMLAttributes<HTMLTableRowElement>;
}) {
  const isSimulation = mode === "simulation";
  const showSimulationOrderColumn =
    isSimulation && Boolean(renderSimulationOrderControls);
  const tableLayoutClass = freezeScopeColumns
    ? "border-separate border-spacing-0"
    : "border-collapse";
  const tableWidthClass = isSimulation
    ? `w-full ${showSimulationOrderColumn ? "min-w-[1420px]" : "min-w-[1370px]"} table-fixed`
    : "min-w-[2660px]";

  return (
    <WideTableFrame>
      <table className={`${tableWidthClass} ${tableLayoutClass}`}>
        {isSimulation ? (
          <SimulationColGroup showOrderColumn={showSimulationOrderColumn} />
        ) : null}
        {!isSimulation ? <NormalColGroup /> : null}
        <thead>
          {isSimulation ? (
            <SimulationHeader showOrderColumn={showSimulationOrderColumn} />
          ) : (
            <NormalHeader freezeScopeColumns={freezeScopeColumns} />
          )}
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow
              colSpan={
                isSimulation ? 14 + (showSimulationOrderColumn ? 1 : 0) : 33
              }
              message="No rows match the current filters."
            />
          ) : (
            rows.map((row, index) => (
              isSimulation ? (
                <SimulationWideTableRow
                  key={row.key}
                  row={row}
                  rowIndex={index}
                  rowCount={rows.length}
                  onRrppInputChange={onRrppInputChange}
                  renderOrderControls={renderSimulationOrderControls}
                  rowAttributes={getSimulationRowAttributes?.(
                    row,
                    index,
                    rows.length
                  )}
                />
              ) : (
                <NormalWideTableRow
                  key={row.key}
                  row={row}
                  onRrppInputChange={onRrppInputChange}
                  mode={mode}
                  freezeScopeColumns={freezeScopeColumns}
                />
              )
            ))
          )}
        </tbody>
      </table>
    </WideTableFrame>
  );
}

function SimulationWideTableRow({
  row,
  rowIndex,
  rowCount,
  onRrppInputChange,
  renderOrderControls,
  rowAttributes
}: {
  row: RrppSimulationTableRow;
  rowIndex: number;
  rowCount: number;
  onRrppInputChange: (
    key: string,
    field: RrppInputField,
    value: string
  ) => void;
  renderOrderControls?: (
    row: RrppSimulationTableRow,
    rowIndex: number,
    rowCount: number
  ) => ReactNode;
  rowAttributes?: HTMLAttributes<HTMLTableRowElement>;
}) {
  const result = row.calculation;
  const rrppSimulation = row.rrppSimulationCalculation;
  const simulationNpClass = rrppSimulation
    ? simulationWarningCellClass(rrppSimulation.warningLevel)
    : simulationCellClass;
  const gpClass = result
    ? simulationWarningCellClass(result.warningLevel)
    : simulationCellClass;

  return (
    <tr {...rowAttributes}>
      {renderOrderControls ? (
        <td className={simulationCellClass}>
          {renderOrderControls(row, rowIndex, rowCount)}
        </td>
      ) : null}
      <td className={simulationCellClass}>{row.countryCode}</td>
      <td className={simulationLeftCellClass}>
        <div className="font-semibold text-slate-950">{row.channelName}</div>
        <div className="mt-0.5 text-[9px] font-medium text-slate-500">
          {row.fdName} · {row.incoterms}
        </div>
      </td>
      <td className={simulationLeftCellClass}>
        <div className="font-semibold text-slate-950">{row.productName}</div>
        <div className="mt-0.5 text-[9px] font-medium text-slate-500">
          {row.model} · {row.category}
        </div>
      </td>
      <td className={simulationCellClass}>{lifecycleBadge(row)}</td>
      <td className={simulationSplitCellClass}>
        <LocalWithEur
          local={row.rrpLocal}
          eur={row.rrpEur}
          currency={row.currency}
        />
      </td>
      <td className={simulationCellClass}>
        {result ? formatMoney(result.fdBuyingPrice, "EUR") : missing(row)}
      </td>
      <td className={gpClass}>
        <div>{result ? formatMoney(result.gp, "EUR") : missing(row)}</div>
        <div className="mt-0.5 text-[9px] font-bold">
          {result ? formatPercent(result.gpPercent) : "-"}
        </div>
      </td>
      <td className={simulationCellClass}>
        <div className="grid gap-0.5 text-center">
          <span className="font-semibold text-slate-950">
            {formatPercent(row.kaFrontMargin)}
          </span>
          <span className="text-[9px] font-medium text-slate-400">
            standard KA
          </span>
        </div>
      </td>
      <td className={`${simulationCellClass} border-l-2 border-l-indigo-200 bg-amber-50/80`}>
        <NumberInput
          className={compactInputClass}
          label={`${row.model} ${row.channelName} simulation RRPP local`}
          value={row.simulationRrppLocal}
          step="0.01"
          onChange={(value) =>
            onRrppInputChange(row.key, "rrppLocal", value)
          }
        />
      </td>
      <td className={`${simulationCellClass} bg-amber-50`}>
        <NumberInput
          className={compactInputClass}
          label={`${row.model} ${row.channelName} derived simulation RRPP EUR`}
          readOnly
          value={row.simulationRrppEur}
          step="0.01"
        />
      </td>
      <td className={`${simulationCellClass} bg-amber-50`}>
        <div className="grid gap-0.5">
          <PercentInput
            className={compactInputClass}
            label={`${row.model} ${row.channelName} simulation promo front margin`}
            value={row.simulationPromoFrontMargin}
            onChange={(value) =>
              onRrppInputChange(row.key, "promoFrontMargin", value)
            }
          />
          <span className="text-[9px] font-medium text-slate-400">
            base {formatPercent(row.kaFrontMargin)}
          </span>
        </div>
      </td>
      <td className={`${simulationCellClass} bg-amber-50`}>
        <SimulationDealFdInput
          row={row}
          calculation={rrppSimulation}
          onRrppInputChange={onRrppInputChange}
        />
      </td>
      <td className={simulationCellClass}>
        {rrppSimulation ? (
          <div className="grid gap-0.5">
            <div className="font-bold text-slate-950">
              {formatMoney(rrppSimulation.rebatePerUnit, "EUR")}
            </div>
            <div className="text-[9px] font-semibold text-slate-500">
              Promo Rebate {formatMoney(rrppSimulation.promoRebatePerUnit, "EUR")}
            </div>
            <div className="text-[9px] font-semibold text-slate-500">
              Margin Rebate {formatMoney(rrppSimulation.marginRebatePerUnit, "EUR")}
            </div>
          </div>
        ) : (
          missing(row)
        )}
      </td>
      <td className={simulationNpClass}>
        <div>{rrppSimulation ? formatMoney(rrppSimulation.np, "EUR") : missing(row)}</div>
        <div className="mt-0.5 text-[9px] font-bold">
          {rrppSimulation ? formatPercent(rrppSimulation.npPercent) : "-"}
        </div>
      </td>
    </tr>
  );
}

export function NormalWideTableRow({
  row,
  onRrppInputChange,
  mode = "full",
  freezeScopeColumns = false
}: {
  row: RrppSimulationTableRow;
  onRrppInputChange: (
    key: string,
    field: RrppInputField,
    value: string
  ) => void;
  mode?: NormalWideTableMode;
  freezeScopeColumns?: boolean;
}) {
  const result = row.calculation;
  const rrppSimulation = row.rrppSimulationCalculation;
  const isSimulation = mode === "simulation";
  const scopeCellClass = freezeScopeColumns ? compactScopeCellClass : cellClass;
  const scopeLeftCellClass = freezeScopeColumns
    ? compactScopeLeftCellClass
    : leftCellClass;

  return (
    <tr>
      <td
        className={scopeFreezeClass(scopeCellClass, 0, freezeScopeColumns, "body")}
        style={scopeFreezeStyle(0, freezeScopeColumns)}
      >
        {row.countryCode}
      </td>
      <td
        className={scopeFreezeClass(scopeLeftCellClass, 1, freezeScopeColumns, "body")}
        style={scopeFreezeStyle(1, freezeScopeColumns)}
      >
        {row.channelName}
      </td>
      <td
        className={scopeFreezeClass(scopeLeftCellClass, 2, freezeScopeColumns, "body")}
        style={scopeFreezeStyle(2, freezeScopeColumns)}
      >
        {row.fdName}
      </td>
      <td
        className={scopeFreezeClass(scopeCellClass, 3, freezeScopeColumns, "body")}
        style={scopeFreezeStyle(3, freezeScopeColumns)}
      >
        {row.incoterms}
      </td>
      <td
        className={scopeFreezeClass(scopeCellClass, 4, freezeScopeColumns, "body")}
        style={scopeFreezeStyle(4, freezeScopeColumns)}
      >
        {row.model}
      </td>
      <td
        className={scopeFreezeClass(scopeCellClass, 5, freezeScopeColumns, "body")}
        style={scopeFreezeStyle(5, freezeScopeColumns)}
      >
        {row.category}
      </td>
      <td
        className={scopeFreezeClass(scopeLeftCellClass, 6, freezeScopeColumns, "body")}
        style={scopeFreezeStyle(6, freezeScopeColumns)}
      >
        {row.productName}
      </td>
      <td
        className={scopeFreezeClass(scopeCellClass, 7, freezeScopeColumns, "body")}
        style={scopeFreezeStyle(7, freezeScopeColumns)}
      >
        {lifecycleBadge(row)}
      </td>
      {isSimulation ? (
        <>
          <td className={splitCellClass}>{moneyOrMissing(row.rrpEur, "EUR")}</td>
          <td className={cellClass}>
            {result ? formatMoney(result.fdBuyingPrice, "EUR") : missing(row)}
          </td>
          <td className={cellClass}>
            {result ? formatMoney(result.gp, "EUR") : missing(row)}
          </td>
          <td className={result ? warningCellClass(result.warningLevel) : cellClass}>
            {result ? formatPercent(result.gpPercent) : missing(row)}
          </td>
          <td className={cellClass}>
            <div className="grid justify-items-center gap-0.5">
              <span className="font-semibold text-slate-950">
                {formatPercent(row.kaFrontMargin)}
              </span>
              <span className="text-[9px] font-medium text-slate-400">
                standard KA
              </span>
            </div>
          </td>
        </>
      ) : (
        <>
          <td className={splitCellClass}>{moneyOrMissing(row.rrpLocal, row.currency)}</td>
          <td className={cellClass}>{moneyOrMissing(row.rrpEur, "EUR")}</td>
          <td className={cellClass}>{formatPercent(row.vatRate)}</td>
          <td className={cellClass}>
            {result ? formatMoney(result.rrpExVat, "EUR") : missing(row)}
          </td>
          <td className={cellClass}>{formatPercent(row.kaBuyingMargin)}</td>
          <td className={cellClass}>
            {result ? formatMoney(result.landingPrice, "EUR") : missing(row)}
          </td>
          <td className={cellClass}>{formatPercent(row.fdMargin)}</td>
          <td className={cellClass}>
            {result ? formatMoney(result.fdBuyingPrice, "EUR") : missing(row)}
          </td>
          <td className={cellClass}>{moneyOrMissing(row.logisticsCost, "EUR")}</td>
          <td className={cellClass}>
            {result ? formatMoney(result.shippingPrice, "EUR") : missing(row)}
          </td>
          <td className={cellClass}>{moneyOrMissing(row.bomCost, "EUR")}</td>
          <td className={cellClass}>
            {result ? formatMoney(result.gp, "EUR") : missing(row)}
          </td>
          <td className={result ? warningCellClass(result.warningLevel) : cellClass}>
            {result ? formatPercent(result.gpPercent) : missing(row)}
          </td>
        </>
      )}
      <td className={`${cellClass} border-l-2 border-l-indigo-200 bg-amber-50/80`}>
        <NumberInput
          label={`${row.model} ${row.channelName} simulation RRPP local`}
          value={row.simulationRrppLocal}
          step="0.01"
          onChange={(value) =>
            onRrppInputChange(row.key, "rrppLocal", value)
          }
        />
      </td>
      <td className={`${cellClass} bg-amber-50`}>
        <NumberInput
          label={`${row.model} ${row.channelName} derived simulation RRPP EUR`}
          readOnly
          value={row.simulationRrppEur}
          step="0.01"
        />
      </td>
      <td className={`${cellClass} bg-amber-50`}>
        <div className="grid justify-items-end gap-0.5">
          <PercentInput
            label={`${row.model} ${row.channelName} simulation promo front margin`}
            value={row.simulationPromoFrontMargin}
            onChange={(value) =>
              onRrppInputChange(row.key, "promoFrontMargin", value)
            }
          />
          <span className="text-[9px] font-medium text-slate-400">
            base {formatPercent(row.kaFrontMargin)}
          </span>
        </div>
      </td>
      <td className={`${cellClass} bg-amber-50`}>
        <SimulationDealFdInput
          row={row}
          calculation={rrppSimulation}
          onRrppInputChange={onRrppInputChange}
        />
      </td>
      <td className={cellClass}>
        {rrppSimulation
          ? formatMoney(rrppSimulation.promoRebatePerUnit, "EUR")
          : missing(row)}
      </td>
      <td className={cellClass}>
        {rrppSimulation ? formatMoney(rrppSimulation.np, "EUR") : missing(row)}
      </td>
      <td
        className={
          rrppSimulation
            ? warningCellClass(rrppSimulation.warningLevel)
            : cellClass
        }
      >
        {rrppSimulation ? formatPercent(rrppSimulation.npPercent) : missing(row)}
      </td>
      {isSimulation ? null : (
        <>
          <td className={`${settlementCellClass} border-l-2 border-l-indigo-200`}>
            {formatPercent(row.kaFrontMargin)}
          </td>
          <td className={settlementCellClass}>
            {result ? formatMoney(result.actualAfterFrontMargin, "EUR") : missing(row)}
          </td>
          <td className={settlementCellClass}>
            {formatPercent(row.kaBackMargin)}
          </td>
          <td className={settlementCellClass}>
            {result ? formatMoney(result.actualNetLandingPrice, "EUR") : missing(row)}
          </td>
          <td className={settlementCellClass}>
            {result ? formatMoney(result.marginRebate, "EUR") : missing(row)}
          </td>
        </>
      )}
    </tr>
  );
}

function SimulationDealFdInput({
  row,
  calculation,
  onRrppInputChange
}: {
  row: RrppSimulationTableRow;
  calculation: RrppSimulationTableRow["rrppSimulationCalculation"];
  onRrppInputChange: (
    key: string,
    field: RrppInputField,
    value: string
  ) => void;
}) {
  const isSpecialDeal = row.dealType !== "NORMAL";
  const promoFdMarginNumber = toFiniteNumber(row.promoFdMargin);
  const hasFdMarginCut =
    isSpecialDeal &&
    promoFdMarginNumber !== null &&
    promoFdMarginNumber < row.fdMargin;

  return (
    <div className="grid min-w-[112px] gap-1 text-left">
      <select
        aria-label={`${row.model} ${row.channelName} simulation deal type`}
        className="h-7 w-full min-w-0 rounded border border-slate-300 bg-white px-2 pr-6 text-[10px] font-semibold text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
        value={row.dealType}
        onChange={(event) =>
          onRrppInputChange(row.key, "dealType", event.target.value)
        }
      >
        <option value="NORMAL">Normal</option>
        <option value="B2B_DEAL">B2B</option>
        <option value="EOL_DEAL">EOL</option>
      </select>
      {isSpecialDeal ? (
        <>
          <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
            Promo FD
          </span>
          <PercentInput
            className={compactInputClass}
            label={`${row.model} ${row.channelName} simulation FD margin`}
            value={row.promoFdMargin}
            onChange={(value) =>
              onRrppInputChange(row.key, "promoFdMargin", value)
            }
          />
          <span className="text-[9px] font-medium text-slate-400">
            base FD {formatPercent(row.fdMargin)}
          </span>
          {hasFdMarginCut ? (
            <span className="rounded bg-amber-100 px-1 py-0.5 text-[9px] font-semibold text-amber-800">
              FD margin cut applied
            </span>
          ) : null}
          {calculation && Math.abs(calculation.fdMarginImpact) > 0.000001 ? (
            <span className="text-[9px] font-semibold text-slate-600">
              Impact {formatMoney(calculation.fdMarginImpact, "EUR")}
            </span>
          ) : null}
        </>
      ) : (
        <span className="rounded bg-slate-50 px-1.5 py-0.5 text-center text-[9px] font-semibold text-slate-500 ring-1 ring-slate-200">
          standard FD {formatPercent(row.fdMargin)}
        </span>
      )}
    </div>
  );
}

export function PromotionWideTable({
  rows,
  onPromoInputChange,
  onAddPromotionPeriod,
  onRemovePromotionRow,
  emptyMessage = "No promotion rows match the current filters.",
  isRowReadOnly = () => false,
  toolbarActions
}: {
  rows: PromotionTableRow[];
  onPromoInputChange: (
    key: string,
    field: PromotionInputField,
    value: string
  ) => void;
  onAddPromotionPeriod?: (row: PromotionTableRow) => void;
  onRemovePromotionRow?: (row: PromotionTableRow) => void;
  emptyMessage?: string;
  isRowReadOnly?: (row: PromotionTableRow) => boolean;
  toolbarActions?: ReactNode;
}) {
  const [showBaselineDetails, setShowBaselineDetails] = useState(false);
  const [showScopeDetails, setShowScopeDetails] = useState(false);
  const baselineColumnCount = showBaselineDetails ? 10 : 1;
  const scopeColumnCount = showScopeDetails
    ? promotionDetailScopeHeadings.length
    : promotionCompactScopeHeadings.length;
  const columnCount =
    scopeColumnCount + baselineColumnCount + promotionPlanHeadings.length;
  const columnWidths = promotionColumnWidths(
    showScopeDetails,
    showBaselineDetails
  );
  const tableMinWidth = columnWidths.reduce((sum, width) => sum + width, 0);

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
        {toolbarActions ? (
          <div className="flex flex-wrap items-center gap-2">{toolbarActions}</div>
        ) : (
          <span>
            Monthly promotion plan rows show RRPP, promo front margin, promo
            rebate, margin rebate, NP, and NP%.
          </span>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="rounded border border-slate-300 px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50"
            type="button"
            onClick={() => setShowScopeDetails((current) => !current)}
          >
            {showScopeDetails ? "Hide scope details" : "Show scope details"}
          </button>
          <button
            className="rounded border border-slate-300 px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50"
            type="button"
            onClick={() => setShowBaselineDetails((current) => !current)}
          >
            {showBaselineDetails ? "Hide baseline details" : "Show baseline details"}
          </button>
        </div>
      </div>
      <WideTableFrame>
        <table
          className="w-full table-fixed border-collapse"
          style={{ minWidth: `${tableMinWidth}px` }}
        >
          <PromotionColGroup widths={columnWidths} />
          <thead>
            <PromotionHeader
              showBaselineDetails={showBaselineDetails}
              showScopeDetails={showScopeDetails}
            />
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyRow
                colSpan={columnCount}
                message={emptyMessage}
              />
            ) : (
              rows.map((row) => (
                <PromotionWideTableRow
                  key={row.key}
                  row={row}
                  showBaselineDetails={showBaselineDetails}
                  showScopeDetails={showScopeDetails}
                  onPromoInputChange={onPromoInputChange}
                  onAddPromotionPeriod={onAddPromotionPeriod}
                  onRemovePromotionRow={onRemovePromotionRow}
                  readOnly={isRowReadOnly(row)}
                />
              ))
            )}
          </tbody>
        </table>
      </WideTableFrame>
    </div>
  );
}

function PromotionWideTableRow({
  row,
  showBaselineDetails,
  showScopeDetails,
  onPromoInputChange,
  onAddPromotionPeriod,
  onRemovePromotionRow,
  readOnly
}: {
  row: PromotionTableRow;
  showBaselineDetails: boolean;
  showScopeDetails: boolean;
  onPromoInputChange: (
    key: string,
    field: PromotionInputField,
    value: string
  ) => void;
  onAddPromotionPeriod?: (row: PromotionTableRow) => void;
  onRemovePromotionRow?: (row: PromotionTableRow) => void;
  readOnly: boolean;
}) {
  const result = row.calculation;
  const promotion = row.promotionCalculation;
  const isSpecialDeal = row.dealType !== "NORMAL";
  const promoFdMarginNumber = toFiniteNumber(row.promoFdMargin);
  const hasFdMarginCut =
    isSpecialDeal &&
    promoFdMarginNumber !== null &&
    promoFdMarginNumber < row.fdMargin;

  return (
    <tr>
      {showScopeDetails ? (
        <>
          <td className={promotionCellClass}>{row.countryCode}</td>
          <td className={promotionLeftCellClass}>
            <div className="min-w-0 break-words">{row.channelName}</div>
          </td>
          <td className={promotionLeftCellClass}>
            <TextInput
              className={compactTextInputClass}
              label={`${row.model} ${row.channelName} promotion name`}
              placeholder="Promotion name"
              readOnly={readOnly}
              value={row.promotionName}
              onChange={(value) =>
                onPromoInputChange(row.key, "promotionName", value)
              }
            />
          </td>
          <td className={promotionLeftCellClass}>
            <div className="min-w-0 break-words">{row.fdName}</div>
          </td>
          <td className={promotionCellClass}>{row.incoterms}</td>
          <td className={promotionCellClass}>
            <div className="min-w-0 break-words">{row.model}</div>
          </td>
          <td className={promotionCellClass}>
            <div className="min-w-0 break-words">{row.category}</div>
          </td>
          <td className={promotionLeftCellClass}>
            <div className="min-w-0 break-words font-semibold text-slate-950">
              {row.productName}
            </div>
            <PromotionPeriodActions
              row={row}
              readOnly={readOnly}
              onAddPromotionPeriod={onAddPromotionPeriod}
              onRemovePromotionRow={onRemovePromotionRow}
            />
          </td>
          <td className={promotionCellClass}>{promotionLifecycleBadge(row)}</td>
        </>
      ) : (
        <>
          <td className={promotionCellClass}>{row.countryCode}</td>
          <td className={promotionLeftCellClass}>
            <div className="min-w-0 break-words">{row.channelName}</div>
          </td>
          <td className={promotionLeftCellClass}>
            <TextInput
              className={compactTextInputClass}
              label={`${row.model} ${row.channelName} promotion name`}
              placeholder="Promotion name"
              readOnly={readOnly}
              value={row.promotionName}
              onChange={(value) =>
                onPromoInputChange(row.key, "promotionName", value)
              }
            />
          </td>
          <td className={promotionLeftCellClass}>
            <div className="min-w-0 break-words font-semibold text-slate-950">
              {row.productName}
            </div>
            <div className="mt-0.5 truncate text-[9px] font-medium text-slate-500">
              {row.model} · {row.category}
            </div>
            <PromotionPeriodActions
              row={row}
              readOnly={readOnly}
              onAddPromotionPeriod={onAddPromotionPeriod}
              onRemovePromotionRow={onRemovePromotionRow}
            />
          </td>
          <td className={promotionCellClass}>{promotionLifecycleBadge(row)}</td>
        </>
      )}
      <td className={promotionSplitCellClass}>
        {moneyOrMissing(row.rrpLocal, row.currency)}
      </td>
      {showBaselineDetails ? (
        <>
          <td className={promotionCellClass}>{moneyOrMissing(row.rrpEur, "EUR")}</td>
          <td className={promotionCellClass}>{formatPercent(row.vatRate)}</td>
          <td className={promotionCellClass}>
            {promotion
              ? formatMoney(promotion.normalRrpExVat, "EUR")
              : result
                ? formatMoney(result.rrpExVat, "EUR")
                : missing(row)}
          </td>
          <td className={promotionCellClass}>{formatPercent(row.kaFrontMargin)}</td>
          <td className={promotionCellClass}>
            {promotion
              ? formatMoney(promotion.normalPriceAfterFrontMargin, "EUR")
              : missing(row)}
          </td>
          <td className={promotionCellClass}>{formatPercent(row.fdMargin)}</td>
          <td className={promotionCellClass}>
            {promotion
              ? formatMoney(promotion.normalFdBuyingPrice, "EUR")
              : missing(row)}
          </td>
          <td className={promotionCellClass}>
            {moneyOrMissing(row.logisticsCost, "EUR")}
          </td>
          <td className={promotionCellClass}>
            {moneyOrMissing(row.bomCost, "EUR")}
          </td>
        </>
      ) : null}
      <td className={`${promotionCellClass} border-l-2 border-l-indigo-200 bg-amber-50`}>
        <NumberInput
          className={compactInputClass}
          label={`${row.model} ${row.channelName} promo RRPP local`}
          readOnly={readOnly}
          value={row.promoRrpLocal}
          step="0.01"
          onChange={(value) =>
            onPromoInputChange(row.key, "promoRrpLocal", value)
          }
        />
      </td>
      <td className={`${promotionCellClass} bg-amber-50`}>
        <NumberInput
          className={compactInputClass}
          label={`${row.model} ${row.channelName} derived promo RRPP EUR`}
          readOnly
          value={row.promoRrpEur}
          step="0.01"
        />
      </td>
      <td className={`${promotionCellClass} bg-amber-50`}>
        <div className="grid gap-0.5">
          <PercentInput
            className={compactInputClass}
            label={`${row.model} ${row.channelName} promo front margin`}
            readOnly={readOnly}
            value={row.promoFrontMargin}
            onChange={(value) =>
              onPromoInputChange(row.key, "promoFrontMargin", value)
            }
          />
          <span className="text-[9px] font-medium text-slate-400">
            base {formatPercent(row.kaFrontMargin)}
          </span>
        </div>
      </td>
      <td className={`${promotionCellClass} bg-amber-50`}>
        <div className="grid gap-1 text-left">
          <select
            aria-label={`${row.model} ${row.channelName} deal type`}
            className="h-6 w-full min-w-0 rounded border border-slate-300 bg-white px-1 text-[9px] font-semibold text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
            disabled={readOnly}
            value={row.dealType}
            onChange={(event) =>
              onPromoInputChange(row.key, "dealType", event.target.value)
            }
          >
            <option value="NORMAL">Normal</option>
            <option value="B2B_DEAL">B2B</option>
            <option value="EOL_DEAL">EOL</option>
          </select>
          {isSpecialDeal ? (
            <>
              <PercentInput
                className={compactInputClass}
                label={`${row.model} ${row.channelName} promo FD margin`}
                readOnly={readOnly}
                value={row.promoFdMargin}
                onChange={(value) =>
                  onPromoInputChange(row.key, "promoFdMargin", value)
                }
              />
              <input
                aria-label={`${row.model} ${row.channelName} deal note`}
                className="h-6 w-full min-w-0 rounded border border-slate-300 bg-white px-1 text-[9px] text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                readOnly={readOnly}
                value={row.dealNote}
                placeholder="Deal note"
                onChange={(event) =>
                  onPromoInputChange(row.key, "dealNote", event.target.value)
                }
              />
              <span className="text-[9px] font-medium text-slate-400">
                base {formatPercent(row.fdMargin)}
              </span>
              {hasFdMarginCut ? (
                <span className="rounded bg-amber-100 px-1 py-0.5 text-[9px] font-semibold text-amber-800">
                  FD margin cut applied
                </span>
              ) : null}
              {promotion && Math.abs(promotion.fdMarginImpact) > 0.000001 ? (
                <span className="text-[9px] font-semibold text-slate-600">
                  Impact {formatMoney(promotion.fdMarginImpact, "EUR")}
                </span>
              ) : null}
            </>
          ) : null}
        </div>
      </td>
      <td className={`${promotionCellClass} bg-amber-50`}>
        <NumberInput
          className={compactInputClass}
          label={`${row.model} ${row.channelName} promo volume`}
          readOnly={readOnly}
          value={row.promoVolume}
          step="1"
          onChange={(value) =>
            onPromoInputChange(row.key, "promoVolume", value)
          }
        />
      </td>
      <td className={`${promotionCellClass} bg-amber-50`}>
        <div className="grid gap-1">
          <DateInput
            label={`${row.model} ${row.channelName} promo start date`}
            readOnly={readOnly}
            value={row.promoStartDate}
            onChange={(value) =>
              onPromoInputChange(row.key, "promoStartDate", value)
            }
          />
          <DateInput
            label={`${row.model} ${row.channelName} promo end date`}
            readOnly={readOnly}
            value={row.promoEndDate}
            onChange={(value) =>
              onPromoInputChange(row.key, "promoEndDate", value)
            }
          />
        </div>
      </td>
      <td className={promotionCellClass}>
        {promotion ? formatMoney(promotion.promoRebatePerUnit, "EUR") : missing(row)}
      </td>
      <td className={promotionCellClass}>
        {promotion ? formatMoney(promotion.marginRebatePerUnit, "EUR") : missing(row)}
      </td>
      <td className={promotionCellClass}>
        {promotion ? formatMoney(promotion.np, "EUR") : missing(row)}
      </td>
      <td
        className={
          promotion
            ? promotionWarningCellClass(promotion.warningLevel)
            : promotionCellClass
        }
      >
        {promotion ? formatPercent(promotion.npPercent) : missing(row)}
      </td>
    </tr>
  );
}

function PromotionPeriodActions({
  row,
  readOnly,
  onAddPromotionPeriod,
  onRemovePromotionRow
}: {
  row: PromotionTableRow;
  readOnly: boolean;
  onAddPromotionPeriod?: (row: PromotionTableRow) => void;
  onRemovePromotionRow?: (row: PromotionTableRow) => void;
}) {
  if (!onAddPromotionPeriod && !onRemovePromotionRow) {
    return null;
  }

  return (
    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] font-semibold">
      {onAddPromotionPeriod ? (
        <button
          className="text-sky-700 hover:underline disabled:cursor-not-allowed disabled:text-slate-400"
          type="button"
          disabled={readOnly}
          onClick={() => onAddPromotionPeriod(row)}
        >
          Add period
        </button>
      ) : null}
      {onRemovePromotionRow ? (
        <button
          className="text-rose-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400"
          type="button"
          disabled={readOnly}
          onClick={() => onRemovePromotionRow(row)}
        >
          Remove
        </button>
      ) : null}
    </div>
  );
}

function NormalHeader({
  freezeScopeColumns
}: {
  freezeScopeColumns: boolean;
}) {
  return (
    <>
      <tr>
        <GroupHeader
          colSpan={8}
          sticky={freezeScopeColumns}
          style={scopeGroupFreezeStyle(freezeScopeColumns)}
        >
          Scope
        </GroupHeader>
        <GroupHeader colSpan={13} split>
          Unified preset KA buying margin flow
        </GroupHeader>
        <GroupHeader colSpan={7} tone="promo" split>
          RRPP floor simulation
        </GroupHeader>
        <GroupHeader colSpan={5} split tone="settlement">
          Actual channel front/back margin settlement
        </GroupHeader>
      </tr>
      <tr>
        {normalHeadings.map((heading, index) => (
          <th
            key={heading}
            scope="col"
            className={normalHeaderClass(index, freezeScopeColumns)}
            style={scopeHeaderStyle(index, freezeScopeColumns)}
          >
            {heading}
          </th>
        ))}
      </tr>
    </>
  );
}

function SimulationHeader({
  showOrderColumn
}: {
  showOrderColumn: boolean;
}) {
  return (
    <>
      <tr>
        {showOrderColumn ? <GroupHeader colSpan={1}>Order</GroupHeader> : null}
        <GroupHeader colSpan={4}>Scope</GroupHeader>
        <GroupHeader colSpan={4} split>
          Unified preset KA buying margin flow
        </GroupHeader>
        <GroupHeader colSpan={6} tone="promo" split>
          RRPP floor simulation
        </GroupHeader>
      </tr>
      <tr>
        {showOrderColumn ? (
          <th scope="col" className={simulationHeaderClass(0, true)}>
            Order
          </th>
        ) : null}
        {compactSimulationHeadings.map((heading, index) => (
          <th
            key={heading}
            scope="col"
            className={simulationHeaderClass(
              index + (showOrderColumn ? 1 : 0),
              showOrderColumn
            )}
          >
            {heading}
          </th>
        ))}
      </tr>
    </>
  );
}

function PromotionHeader({
  showBaselineDetails,
  showScopeDetails
}: {
  showBaselineDetails: boolean;
  showScopeDetails: boolean;
}) {
  const promotionScopeHeadings = showScopeDetails
    ? promotionDetailScopeHeadings
    : promotionCompactScopeHeadings;
  const baselineHeadings = showBaselineDetails
    ? [...promotionBaselineCoreHeadings, ...promotionBaselineDetailHeadings]
    : promotionBaselineCoreHeadings;
  const headings = [
    ...promotionScopeHeadings,
    ...baselineHeadings,
    ...promotionPlanHeadings
  ];
  const monthlyStartIndex = promotionScopeHeadings.length + baselineHeadings.length;

  return (
    <>
      <tr>
        <GroupHeader colSpan={promotionScopeHeadings.length}>Scope</GroupHeader>
        <GroupHeader colSpan={baselineHeadings.length} split>
          Normal baseline
        </GroupHeader>
        <GroupHeader colSpan={promotionPlanHeadings.length} tone="promo" split>
          Monthly promotion inputs
        </GroupHeader>
      </tr>
      <tr>
        {headings.map((heading, index) => (
          <th
            key={heading}
            scope="col"
            className={
              index === promotionScopeHeadings.length || index === monthlyStartIndex
                ? `${headerClass} border-l-2 border-l-indigo-200`
                : headerClass
            }
          >
            {heading}
          </th>
        ))}
      </tr>
    </>
  );
}

function PromotionColGroup({ widths }: { widths: number[] }) {
  return (
    <colgroup>
      {widths.map((width, index) => (
        <col key={`${index}-${width}`} style={{ width: `${width}px` }} />
      ))}
    </colgroup>
  );
}

function ScopeColGroup() {
  return (
    <colgroup>
      {scopeColumnWidths.map((width, index) => (
        <col
          key={`${scopeHeadings[index]}-${width}`}
          style={{ width: `${width}px`, minWidth: `${width}px` }}
        />
      ))}
    </colgroup>
  );
}

function NormalColGroup() {
  return (
    <colgroup>
      {normalColumnWidths.map((width, index) => (
        <col
          key={`${normalHeadings[index]}-${width}`}
          style={{ width: `${width}px`, minWidth: `${width}px` }}
        />
      ))}
    </colgroup>
  );
}

function SimulationColGroup({
  showOrderColumn
}: {
  showOrderColumn: boolean;
}) {
  const widths = showOrderColumn
    ? [50, ...simulationColumnWidths]
    : simulationColumnWidths;
  const headings = showOrderColumn
    ? ["Order", ...compactSimulationHeadings]
    : compactSimulationHeadings;

  return (
    <colgroup>
      {widths.map((width, index) => (
        <col
          key={`${headings[index]}-${width}`}
          style={{ width: `${width}px` }}
        />
      ))}
    </colgroup>
  );
}

function normalHeaderClass(index: number, freezeScopeColumns: boolean) {
  const headerBaseClass =
    freezeScopeColumns && index < scopeColumnWidths.length
      ? compactScopeHeaderClass
      : headerClass;
  const baseClass =
    index === 8 || index === 21 || index === 28
      ? `${headerBaseClass} border-l-2 border-l-indigo-200`
      : headerBaseClass;
  return scopeFreezeClass(baseClass, index, freezeScopeColumns, "header");
}

function simulationHeaderClass(index: number, showOrderColumn = false) {
  const normalFlowStart = showOrderColumn ? 5 : 4;
  const simulationStart = showOrderColumn ? 9 : 8;
  const baseClass =
    index === normalFlowStart || index === simulationStart
      ? `${headerClass} border-l-2 border-l-indigo-200`
      : headerClass;
  return baseClass;
}

function scopeFreezeClass(
  baseClass: string,
  columnIndex: number,
  freezeScopeColumns: boolean,
  layer: "body" | "header"
) {
  if (!freezeScopeColumns || columnIndex >= scopeColumnWidths.length) {
    return baseClass;
  }

  return `${baseClass} sticky ${
    layer === "header" ? "z-30" : "z-20"
  } ${columnIndex === scopeColumnWidths.length - 1 ? frozenScopeEdgeClass : ""}`;
}

function scopeHeaderStyle(index: number, freezeScopeColumns: boolean) {
  return index < scopeColumnWidths.length
    ? scopeFreezeStyle(index, freezeScopeColumns)
    : undefined;
}

function scopeFreezeStyle(index: number, freezeScopeColumns: boolean) {
  if (!freezeScopeColumns || index >= scopeColumnWidths.length) {
    return undefined;
  }

  const width = scopeColumnWidths[index];
  return {
    left: `${scopeColumnOffsets[index]}px`,
    width: `${width}px`,
    minWidth: `${width}px`,
    maxWidth: `${width}px`
  };
}

function scopeGroupFreezeStyle(freezeScopeColumns: boolean) {
  if (!freezeScopeColumns) {
    return undefined;
  }

  return {
    left: "0px",
    width: `${scopeColumnTotalWidth}px`,
    minWidth: `${scopeColumnTotalWidth}px`,
    maxWidth: `${scopeColumnTotalWidth}px`
  };
}

function GroupHeader({
  children,
  colSpan,
  split = false,
  tone = "base",
  sticky = false,
  style
}: {
  children: React.ReactNode;
  colSpan: number;
  split?: boolean;
  tone?: "base" | "promo" | "settlement";
  sticky?: boolean;
  style?: React.CSSProperties;
}) {
  const toneClass =
    tone === "promo"
      ? "bg-amber-100 text-amber-900"
      : tone === "settlement"
        ? "bg-emerald-100 text-emerald-900"
        : subHeaderClass;

  return (
    <th
      className={`${subHeaderClass} ${toneClass} ${
        split ? "border-l-2 border-l-indigo-200" : ""
      } ${sticky ? `sticky z-40 ${frozenScopeEdgeClass}` : ""}`}
      colSpan={colSpan}
      scope="colgroup"
      style={style}
    >
      {children}
    </th>
  );
}

function WideTableFrame({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative overflow-auto rounded-md border border-slate-300 bg-white shadow-sm">
      {children}
    </div>
  );
}

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td
        className="border border-slate-300 bg-white px-3 py-5 text-center text-xs text-slate-500"
        colSpan={colSpan}
      >
        {message}
      </td>
    </tr>
  );
}

function NumberInput({
  label,
  value,
  step,
  readOnly = false,
  className = inputClass,
  onChange = () => undefined
}: {
  label: string;
  value: number | string;
  step: string;
  readOnly?: boolean;
  className?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <input
      aria-label={label}
      className={`${className} ${
        readOnly ? "cursor-not-allowed bg-slate-100 text-slate-500" : ""
      }`}
      min="0"
      readOnly={readOnly}
      step={step}
      type="number"
      value={typeof value === "number" ? String(value) : value}
      onChange={(event) => {
        if (!readOnly) {
          onChange(event.target.value);
        }
      }}
    />
  );
}

function PercentInput({
  label,
  value,
  readOnly = false,
  className = inputClass,
  onChange = () => undefined
}: {
  label: string;
  value: number | string;
  readOnly?: boolean;
  className?: string;
  onChange?: (value: string) => void;
}) {
  const wrapperClass =
    className === inputClass
      ? "relative ml-auto w-20"
      : "relative w-full min-w-0";

  return (
    <div className={wrapperClass} data-margin-input="percent">
      <input
        aria-label={`${label} percent`}
        className={`${className} pr-4 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
          readOnly ? "cursor-not-allowed bg-slate-100 text-slate-500" : ""
        }`}
        inputMode="decimal"
        max="100"
        min="0"
        readOnly={readOnly}
        step="0.1"
        type="number"
        value={marginRatioToPercentInput(value)}
        onChange={(event) => {
          if (!readOnly) {
            onChange(percentInputToMarginRatio(event.target.value));
          }
        }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-1 flex items-center text-[9px] font-semibold text-slate-400"
      >
        %
      </span>
    </div>
  );
}

function DateInput({
  label,
  value,
  readOnly = false,
  onChange = () => undefined
}: {
  label: string;
  value: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <EuropeanDateInput
      label={label}
      className={`h-6 w-full min-w-0 rounded border border-slate-300 bg-white px-0.5 text-center text-[9px] text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200 ${
        readOnly ? "cursor-not-allowed bg-slate-100 text-slate-500" : ""
      }`}
      readOnly={readOnly}
      value={value}
      onChange={onChange}
    />
  );
}

function TextInput({
  label,
  value,
  placeholder = "",
  readOnly = false,
  className = compactTextInputClass,
  onChange = () => undefined
}: {
  label: string;
  value: string;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <input
      aria-label={label}
      className={`${className} ${
        readOnly ? "cursor-not-allowed bg-slate-100 text-slate-500" : ""
      }`}
      placeholder={placeholder}
      readOnly={readOnly}
      type="text"
      value={value}
      onChange={(event) => {
        if (!readOnly) {
          onChange(event.target.value);
        }
      }}
    />
  );
}

function LocalWithEur({
  local,
  eur,
  currency
}: {
  local: number | null;
  eur: number | null;
  currency: string;
}) {
  if (local === null && eur === null) {
    return <span>-</span>;
  }

  return (
    <div className="grid gap-0.5">
      <span>{local === null ? "-" : formatMoney(local, currency)}</span>
      {currency !== "EUR" && eur !== null ? (
        <span className="text-[9px] font-semibold text-slate-500">
          {formatMoney(eur, "EUR")}
        </span>
      ) : null}
    </div>
  );
}

function moneyOrMissing(value: number | null, currency: string) {
  return value === null ? "-" : formatMoney(value, currency);
}

function toFiniteNumber(value: number | string) {
  const parsedValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function missing(row: NormalTableRow) {
  return row.missingFields.length > 0 ? row.missingFields.join(", ") : "-";
}

function lifecycleBadge(row: NormalTableRow) {
  const label =
    row.productLifecycleStatus === "UNLAUNCHED"
      ? "Unlaunched"
      : row.productLifecycleStatus === "EOL"
        ? "EOL"
        : "Launched";
  const tone =
    row.productLifecycleStatus === "UNLAUNCHED"
      ? "bg-sky-50 text-sky-800 ring-sky-100"
      : row.productLifecycleStatus === "EOL"
        ? "bg-rose-50 text-rose-800 ring-rose-100"
        : "bg-emerald-50 text-emerald-800 ring-emerald-100";

  return (
    <span
      className={`inline-flex w-full max-w-full justify-center truncate rounded px-1 py-0.5 text-[9px] font-semibold ring-1 ${tone}`}
    >
      {label}
    </span>
  );
}

function promotionLifecycleBadge(row: NormalTableRow) {
  if (
    row.productLifecycleStatus === "UNLAUNCHED" &&
    Boolean(row.plannedLaunchAt)
  ) {
    return (
      <span className="inline-flex w-full max-w-full justify-center truncate rounded bg-violet-50 px-1 py-0.5 text-[9px] font-semibold text-violet-800 ring-1 ring-violet-100">
        Pre-launch
      </span>
    );
  }

  return lifecycleBadge(row);
}

function warningCellClass(level: WarningLevel) {
  if (level === "GOOD") {
    return `${cellClass} bg-emerald-50 font-semibold text-emerald-800`;
  }

  if (level === "WARNING") {
    return `${cellClass} bg-amber-50 font-semibold text-amber-800`;
  }

  return `${cellClass} bg-rose-50 font-semibold text-rose-800`;
}

function promotionWarningCellClass(level: WarningLevel) {
  if (level === "GOOD") {
    return `${promotionCellClass} bg-emerald-50 font-semibold text-emerald-800`;
  }

  if (level === "WARNING") {
    return `${promotionCellClass} bg-amber-50 font-semibold text-amber-800`;
  }

  return `${promotionCellClass} bg-rose-50 font-semibold text-rose-800`;
}

function simulationWarningCellClass(level: WarningLevel) {
  if (level === "GOOD") {
    return `${simulationCellClass} bg-emerald-50 font-semibold text-emerald-800`;
  }

  if (level === "WARNING") {
    return `${simulationCellClass} bg-amber-50 font-semibold text-amber-800`;
  }

  return `${simulationCellClass} bg-rose-50 font-semibold text-rose-800`;
}

const normalHeadings = [
  "Country",
  "Channel / Retailer",
  "FD",
  "Incoterms",
  "Model",
  "Category",
  "Product",
  "Lifecycle",
  "RRP Local",
  "RRP EUR",
  "VAT",
  "After VAT",
  "KA Buying Margin",
  "Landing Price",
  "FD Margin",
  "Net Price",
  "Transport",
  "Shipping Price",
  "BOM",
  "GP",
  "GP%",
  "Sim RRPP Local",
  "Sim RRPP EUR",
  "Promo Front Margin",
  "Deal / FD",
  "Promo Rebate",
  "Sim NP",
  "Sim NP%",
  "KA Front Margin",
  "After Front Margin",
  "KA Back Margin",
  "Actual Net Landing",
  "Margin Rebate"
];

const compactSimulationHeadings = [
  "Market",
  "Channel / FD",
  "Product",
  "Status",
  "RRP",
  "Net",
  "GP / GP%",
  "KA Front Margin",
  "Sim RRPP Local",
  "Sim RRPP EUR",
  "Front Margin",
  "Deal / FD",
  "Total Rebate",
  "Sim NP / NP%"
];

const simulationColumnWidths = [
  50,
  128,
  194,
  84,
  66,
  76,
  86,
  112,
  86,
  86,
  102,
  90,
  118,
  88
];

const scopeHeadings = [
  "Country",
  "Channel / Retailer",
  "FD",
  "Incoterms",
  "Model",
  "Category",
  "Product",
  "Lifecycle"
];

const scopeColumnWidths = [44, 88, 76, 58, 80, 78, 160, 78];
const normalColumnWidths = [
  ...scopeColumnWidths,
  82,
  70,
  56,
  70,
  82,
  76,
  70,
  70,
  64,
  72,
  64,
  70,
  64,
  96,
  96,
  118,
  126,
  80,
  72,
  76,
  84,
  82,
  78,
  96,
  84
];
const scopeColumnOffsets = scopeColumnWidths.map((_, index) =>
  scopeColumnWidths.slice(0, index).reduce((sum, width) => sum + width, 0)
);
const scopeColumnTotalWidth = scopeColumnWidths.reduce(
  (sum, width) => sum + width,
  0
);
const frozenScopeEdgeClass =
  "border-r-2 border-r-indigo-200 shadow-[6px_0_8px_-6px_rgba(15,23,42,0.35)]";

const promotionCompactScopeHeadings = [
  "Country",
  "Channel / Retailer",
  "Promotion Name",
  "Product",
  "Lifecycle"
];

const promotionDetailScopeHeadings = [
  "Country",
  "Channel / Retailer",
  "Promotion Name",
  "FD",
  "Incoterms",
  "Model",
  "Category",
  "Product",
  "Lifecycle"
];

const promotionCompactScopeWidths = [34, 84, 150, 170, 56];
const promotionDetailScopeWidths = [38, 88, 150, 62, 54, 58, 62, 154, 56];
const promotionBaselineCoreWidths = [62];
const promotionBaselineDetailWidths = [62, 44, 58, 68, 70, 54, 58, 50, 52];
const promotionPlanWidths = [62, 62, 76, 72, 48, 104, 58, 58, 48, 44];

function promotionColumnWidths(
  showScopeDetails: boolean,
  showBaselineDetails: boolean
) {
  return [
    ...(showScopeDetails
      ? promotionDetailScopeWidths
      : promotionCompactScopeWidths),
    ...promotionBaselineCoreWidths,
    ...(showBaselineDetails ? promotionBaselineDetailWidths : []),
    ...promotionPlanWidths
  ];
}

const promotionBaselineCoreHeadings = ["RRP Local"];

const promotionBaselineDetailHeadings = [
  "RRP EUR",
  "VAT",
  "After VAT",
  "Base Front Margin",
  "Landing Price",
  "FD Margin",
  "Net Price",
  "Transport",
  "BOM"
];

const promotionPlanHeadings = [
  "RRPP Local",
  "RRPP EUR",
  "Promo Front Margin",
  "Deal / FD",
  "SO FCST",
  "Promo Period",
  "Promo Rebate",
  "Margin Rebate",
  "NP",
  "NP%"
];
