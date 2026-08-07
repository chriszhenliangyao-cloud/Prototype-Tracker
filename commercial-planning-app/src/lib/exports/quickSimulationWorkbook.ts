import type { RrppSimulationTableRow } from "../calculatorRows";
import { buildValueChainWorkbookBuffer } from "./valueChainWorkbook";

export function buildQuickSimulationWorkbookBuffer(
  rows: RrppSimulationTableRow[]
) {
  return buildValueChainWorkbookBuffer(rows, {
    sheetName: "Quick Simulation"
  });
}
