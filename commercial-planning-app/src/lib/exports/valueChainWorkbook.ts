import type { RrppSimulationTableRow } from "../calculatorRows";
import { createXlsxWorkbook, type WorkbookCell } from "./xlsxWorkbook";

const HEADERS = [
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
  "Deal Type",
  "Promo FD Margin",
  "Promo Rebate",
  "Margin Rebate",
  "Total Rebate",
  "Sim NP",
  "Sim NP%",
  "KA Front Margin",
  "After Front Margin",
  "KA Back Margin",
  "Actual Net Landing"
];

type ValueChainWorkbookOptions = {
  sheetName?: string;
};

export function buildValueChainWorkbookBuffer(
  rows: RrppSimulationTableRow[],
  options: ValueChainWorkbookOptions = {}
) {
  return createXlsxWorkbook([
    {
      name: options.sheetName ?? "Value Chain",
      style: "valueChain",
      rows: [
        HEADERS,
        ...rows.map((row, index) => valueChainWorkbookRow(row, index + 2))
      ],
      autoFilter: true,
      freezeTopRows: 1,
      columnWidths: [
        10,
        18,
        18,
        12,
        14,
        16,
        28,
        12,
        12,
        12,
        10,
        12,
        16,
        14,
        12,
        12,
        12,
        14,
        12,
        12,
        10,
        16,
        16,
        18,
        12,
        14,
        14,
        14,
        14,
        12,
        10,
        16,
        16,
        14,
        18
      ]
    }
  ]);
}

function valueChainWorkbookRow(
  row: RrppSimulationTableRow,
  rowNumber: number
): WorkbookCell[] {
  const normal = row.calculation;
  const simulation = row.rrppSimulationCalculation;

  return [
    row.countryCode,
    row.channelName,
    row.fdName,
    row.incoterms,
    row.model,
    row.category,
    row.productName,
    lifecycleLabel(row.productLifecycleStatus),
    row.rrpLocal,
    row.rrpEur,
    row.vatRate,
    formula("IFERROR(J2/(1+K2),\"\")", normal?.rrpExVat),
    row.kaBuyingMargin,
    formula("IFERROR(L2*(1-M2),\"\")", normal?.landingPrice),
    row.fdMargin,
    formula("IFERROR(N2*(1-O2),\"\")", normal?.fdBuyingPrice),
    row.logisticsCost,
    formula("IFERROR(P2-Q2,\"\")", normal?.shippingPrice),
    row.bomCost,
    formula("IFERROR(R2-S2,\"\")", normal?.gp),
    formula("IFERROR(T2/R2,\"\")", normal?.gpPercent),
    nullableInput(row.simulationRrppLocal),
    formula(
      "IFERROR(IF(OR(V2=\"\",I2=\"\",J2=\"\"),\"\",V2*(J2/I2)),\"\")",
      numberOrNull(row.simulationRrppEur)
    ),
    nullableInput(row.simulationPromoFrontMargin),
    simulationDealTypeLabel(row.dealType),
    nullableInput(row.promoFdMargin),
    formula(
      "IFERROR(MAX(0,L2*(1-AF2)-W2/(1+K2)*(1-X2)),\"\")",
      simulation?.promoRebatePerUnit
    ),
    formula("IFERROR(N2-AI2,\"\")", simulation?.marginRebatePerUnit),
    formula("IFERROR(AA2+AB2,\"\")", simulation?.rebatePerUnit),
    formula(
      "IFERROR((N2*(1-IF(OR(Y2=\"\",Y2=\"Normal\"),O2,Z2))-Q2)-AC2-S2,\"\")",
      simulation?.np
    ),
    formula(
      "IFERROR(AD2/((N2*(1-IF(OR(Y2=\"\",Y2=\"Normal\"),O2,Z2))-Q2)-AC2),\"\")",
      simulation?.npPercent
    ),
    row.kaFrontMargin,
    formula("IFERROR(L2*(1-AF2),\"\")", normal?.actualAfterFrontMargin),
    row.kaBackMargin,
    formula("IFERROR(AG2*(1-AH2),\"\")", normal?.actualNetLandingPrice)
  ].map((cell) => (isFormulaCell(cell) ? adjustFormulaForRow(cell, rowNumber) : cell));
}

function formula(formula: string, value?: number | string | null): WorkbookCell {
  return { formula, value: value ?? null };
}

function adjustFormulaForRow(cell: WorkbookCell, rowNumber: number): WorkbookCell {
  if (!isFormulaCell(cell)) {
    return cell;
  }

  return {
    ...cell,
    formula: cell.formula.replace(/\b([A-Z]+)2\b/g, (_match, column: string) =>
      `${column}${rowNumber}`
    )
  };
}

function nullableInput(value: number | string): number | string | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  return value.trim() === "" ? null : value;
}

function numberOrNull(value: number | string): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function lifecycleLabel(value: RrppSimulationTableRow["productLifecycleStatus"]) {
  if (value === "UNLAUNCHED") {
    return "Unlaunched";
  }

  if (value === "EOL") {
    return "EOL";
  }

  return "Launched";
}

function simulationDealTypeLabel(value: RrppSimulationTableRow["dealType"]) {
  if (value === "B2B_DEAL") {
    return "B2B";
  }

  if (value === "EOL_DEAL") {
    return "EOL";
  }

  return "Normal";
}

function isFormulaCell(
  value: WorkbookCell
): value is { formula: string; value?: number | string | null } {
  return (
    typeof value === "object" &&
    value !== null &&
    "formula" in value &&
    typeof value.formula === "string"
  );
}
