import { describe, expect, it } from "vitest";
import { parseBusinessPlanActualWorkbook } from "./businessPlanActuals";

describe("business plan PO actual import", () => {
  it("uses PO Date for the achievement month when reading an Excel 2003 XML export", () => {
    const result = parseBusinessPlanActualWorkbook(Buffer.from(workbookXml()));

    expect(result.errors).toEqual([]);
    expect(result.countryCodes).toEqual(["ES", "PL"]);
    expect(result.rows).toEqual([
      expect.objectContaining({
        planYear: 2026,
        planMonth: 2,
        countryCode: "ES",
        customerName: "Esprinet",
        poNumber: "PO-100",
        productModel: "CHG-65W-EU",
        siUnits: 120,
        siValueEur: 3598.8
      }),
      expect.objectContaining({
        planYear: 2026,
        planMonth: 3,
        countryCode: "PL",
        customerName: "Komsa",
        poNumber: "PO-101",
        productModel: "P75-P1",
        siUnits: 30,
        siValueEur: 900
      })
    ]);
  });

  it("reports a missing required PO SKU column instead of importing shifted data", () => {
    const result = parseBusinessPlanActualWorkbook(
      Buffer.from(workbookXml().replace("<Cell><Data ss:Type=\"String\">SKU</Data></Cell>", ""))
    );

    expect(result.rows).toEqual([]);
    expect(result.errors[0]?.message).toContain("SKU");
  });
});

function workbookXml() {
  return `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="By PO">
    <Table>
      <Row>
        <Cell><Data ss:Type="String">Month</Data></Cell>
        <Cell><Data ss:Type="String">PO #</Data></Cell>
        <Cell><Data ss:Type="String">PO Date</Data></Cell>
        <Cell><Data ss:Type="String">Country</Data></Cell>
        <Cell><Data ss:Type="String">KA</Data></Cell>
        <Cell><Data ss:Type="String">SKU</Data></Cell>
        <Cell><Data ss:Type="String">Qty</Data></Cell>
        <Cell><Data ss:Type="String">Turnover (EUR)</Data></Cell>
      </Row>
      <Row>
        <Cell><Data ss:Type="String">January</Data></Cell>
        <Cell><Data ss:Type="String">PO-100</Data></Cell>
        <Cell><Data ss:Type="String">2026-02-11</Data></Cell>
        <Cell><Data ss:Type="String">ES</Data></Cell>
        <Cell><Data ss:Type="String">Esprinet</Data></Cell>
        <Cell><Data ss:Type="String">CHG-65W-EU</Data></Cell>
        <Cell><Data ss:Type="Number">120</Data></Cell>
        <Cell><Data ss:Type="Number">3598.8</Data></Cell>
      </Row>
      <Row>
        <Cell><Data ss:Type="String">March</Data></Cell>
        <Cell><Data ss:Type="String">PO-101</Data></Cell>
        <Cell><Data ss:Type="String">15/03/2026</Data></Cell>
        <Cell><Data ss:Type="String">PL</Data></Cell>
        <Cell><Data ss:Type="String">Komsa</Data></Cell>
        <Cell><Data ss:Type="String">P75-P1</Data></Cell>
        <Cell><Data ss:Type="Number">30</Data></Cell>
        <Cell><Data ss:Type="Number">900</Data></Cell>
      </Row>
      <Row>
        <Cell><Data ss:Type="String">PO-101 total · 1 SKU</Data></Cell>
        <Cell><Data ss:Type="Number">30</Data></Cell>
      </Row>
      <Row>
        <Cell><Data ss:Type="String">2026-03 subtotal · 1 PO</Data></Cell>
        <Cell><Data ss:Type="Number">30</Data></Cell>
      </Row>
    </Table>
  </Worksheet>
</Workbook>`;
}
