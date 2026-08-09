import { Buffer } from "node:buffer";
import { deflateRawSync, inflateRawSync } from "node:zlib";

export type WorkbookSheet = {
  name: string;
  rows: Array<Array<WorkbookCell>>;
  autoFilter?: boolean;
  columnWidths?: number[];
  dataValidations?: WorkbookDataValidation[];
  hidden?: boolean;
  hiddenColumns?: number[];
  freezeTopRows?: number;
  tables?: WorkbookTable[];
  style?:
    | "businessPlan"
    | "bpMasterData"
    | "promotionPlan"
    | "valueChain"
    | "promotionPeriodRules"
    | "newLaunchedProducts"
    | "dateOptions";
};

export type WorkbookFormulaCell = {
  formula: string;
  value?: number | string | null;
  numberFormatCode?: string;
};

export type WorkbookDateCell = {
  date: string | Date | number | null | undefined;
  numberFormatCode?: string;
};

export type WorkbookNumberCell = {
  value: number | null | undefined;
  numberFormatCode?: string;
};

export type WorkbookDataValidation = {
  formula1: string;
  ranges: string[];
  type: "list";
  allowBlank?: boolean;
};

export type WorkbookTable = {
  columns: string[];
  name: string;
  ref: string;
  styleName?: string;
};

export type WorkbookDefinedName = {
  name: string;
  formula: string;
  hidden?: boolean;
};

export type XlsxWorkbookOptions = {
  definedNames?: WorkbookDefinedName[];
};

export type WorkbookCell =
  | number
  | string
  | null
  | undefined
  | WorkbookDateCell
  | WorkbookFormulaCell
  | WorkbookNumberCell;

type ZipPart = {
  path: string;
  contents: Buffer;
};

type PreparedZipPart = ZipPart & {
  compressedContents: Buffer;
  compressionMethod: 0 | 8;
};

type ZipDirectoryEntry = {
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
  name: string;
};

type XfDefinition = {
  numFmt?: number;
  font?: number;
  fill?: number;
  border?: number;
  alignment?: "header" | "text" | "number";
};

type DynamicCellStyle = {
  baseStyleId: number;
  numberFormatCode: string;
  numFmtId: number;
};

type StyleRegistry = {
  dynamicStyles: DynamicCellStyle[];
  styleIdFor: (baseStyleId: number, numberFormatCode: string | null) => number;
};

export function createXlsxWorkbook(
  sheets: WorkbookSheet[],
  options: XlsxWorkbookOptions = {}
) {
  if (sheets.length === 0) {
    throw new Error("Workbook needs at least one sheet.");
  }

  const styleRegistry = createStyleRegistry();
  const worksheetTableParts = buildWorksheetTableParts(sheets);
  const worksheetParts = sheets.map((sheet, index) => ({
    path: `xl/worksheets/sheet${index + 1}.xml`,
    contents: xmlBuffer(
      worksheetXml(sheet, styleRegistry, worksheetTableParts[index] ?? [])
    )
  }));
  const worksheetRelationshipParts = worksheetTableParts.flatMap(
    (tableParts, index) =>
      tableParts.length === 0
        ? []
        : [
            {
              path: `xl/worksheets/_rels/sheet${index + 1}.xml.rels`,
              contents: xmlBuffer(worksheetRelationshipsXml(tableParts))
            }
          ]
  );
  const tableParts = worksheetTableParts.flatMap((items) =>
    items.map((item) => ({
      path: `xl/tables/table${item.tableId}.xml`,
      contents: xmlBuffer(tableXml(item))
    }))
  );
  const parts: ZipPart[] = [
    {
      path: "[Content_Types].xml",
      contents: xmlBuffer(contentTypesXml(sheets.length, tableParts.length))
    },
    {
      path: "_rels/.rels",
      contents: xmlBuffer(rootRelationshipsXml())
    },
    {
      path: "xl/workbook.xml",
      contents: xmlBuffer(workbookXml(sheets, options.definedNames))
    },
    {
      path: "xl/_rels/workbook.xml.rels",
      contents: xmlBuffer(workbookRelationshipsXml(sheets.length))
    },
    {
      path: "xl/styles.xml",
      contents: xmlBuffer(stylesXml(styleRegistry.dynamicStyles))
    },
    ...worksheetParts,
    ...worksheetRelationshipParts,
    ...tableParts
  ];

  return writeZip(parts);
}

export function recompressXlsxWorkbook(input: Buffer | Uint8Array) {
  return writeZip(readZipParts(Buffer.from(input)), { compress: true });
}

type WorksheetTablePart = WorkbookTable & {
  relationshipId: string;
  tableId: number;
};

function buildWorksheetTableParts(sheets: WorkbookSheet[]): WorksheetTablePart[][] {
  let nextTableId = 1;

  return sheets.map((sheet) =>
    (sheet.tables ?? []).map((table, index) => ({
      ...table,
      relationshipId: `rId${index + 1}`,
      tableId: nextTableId++
    }))
  );
}

function createStyleRegistry(): StyleRegistry {
  const dynamicStyles: DynamicCellStyle[] = [];
  const numberFormatIds = new Map<string, number>();
  const styleIds = new Map<string, number>();
  const baseStyleCount = baseXfs().length;

  return {
    dynamicStyles,
    styleIdFor(baseStyleId, numberFormatCode) {
      if (!numberFormatCode) {
        return baseStyleId;
      }

      const normalizedFormatCode = numberFormatCode.trim();
      let numFmtId = numberFormatIds.get(normalizedFormatCode);
      if (!numFmtId) {
        numFmtId = 168 + numberFormatIds.size;
        numberFormatIds.set(normalizedFormatCode, numFmtId);
      }

      const normalizedBaseStyleId =
        baseStyleId >= 0 && baseStyleId < baseStyleCount ? baseStyleId : 0;
      const key = `${normalizedBaseStyleId}|${normalizedFormatCode}`;
      const existingStyleId = styleIds.get(key);
      if (existingStyleId !== undefined) {
        return existingStyleId;
      }

      const styleId = baseStyleCount + dynamicStyles.length;
      styleIds.set(key, styleId);
      dynamicStyles.push({
        baseStyleId: normalizedBaseStyleId,
        numberFormatCode: normalizedFormatCode,
        numFmtId
      });

      return styleId;
    }
  };
}

function contentTypesXml(sheetCount: number, tableCount = 0) {
  const sheets = Array.from({ length: sheetCount }, (_, index) => {
    const sheetNumber = index + 1;
    return `<Override PartName="/xl/worksheets/sheet${sheetNumber}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
  }).join("");
  const tables = Array.from({ length: tableCount }, (_, index) => {
    const tableNumber = index + 1;
    return `<Override PartName="/xl/tables/table${tableNumber}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheets}
  ${tables}
</Types>`;
}

function rootRelationshipsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function workbookXml(
  sheets: WorkbookSheet[],
  definedNames: WorkbookDefinedName[] = []
) {
  const definedNamesXml = workbookDefinedNamesXml(definedNames);

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${sheets
      .map(
        (sheet, index) =>
          `<sheet name="${escapeXmlAttribute(sheet.name)}" sheetId="${index + 1}"${
            sheet.hidden ? ' state="hidden"' : ""
          } r:id="rId${index + 1}"/>`
      )
      .join("")}
  </sheets>
  ${definedNamesXml}
  <calcPr calcId="191029" calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>
</workbook>`;
}

function workbookDefinedNamesXml(definedNames: WorkbookDefinedName[]) {
  const uniqueNames = new Map<string, WorkbookDefinedName>();

  for (const definedName of definedNames) {
    const name = definedName.name.trim();
    const formula = definedName.formula.trim();
    if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(name) || formula === "") {
      continue;
    }
    uniqueNames.set(name.toLowerCase(), { ...definedName, name, formula });
  }

  if (uniqueNames.size === 0) {
    return "";
  }

  return `<definedNames>${[...uniqueNames.values()]
    .map(
      (definedName) =>
        `<definedName name="${escapeXmlAttribute(definedName.name)}"${
          definedName.hidden ? ' hidden="1"' : ""
        }>${escapeXmlText(definedName.formula)}</definedName>`
    )
    .join("")}</definedNames>`;
}

function workbookRelationshipsXml(sheetCount: number) {
  const sheets = Array.from({ length: sheetCount }, (_, index) => {
    const sheetNumber = index + 1;
    return `<Relationship Id="rId${sheetNumber}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${sheetNumber}.xml"/>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheets}
  <Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function worksheetXml(
  sheet: WorkbookSheet,
  styleRegistry: StyleRegistry,
  tableParts: WorksheetTablePart[] = []
) {
  const rows = sheet.rows;
  const maxColumnCount = Math.max(1, ...rows.map((row) => row.length));
  const rowCount = Math.max(1, rows.length);
  const dimensionReference = `A1:${columnName(maxColumnCount - 1)}${rowCount}`;
  const columns = columnsXml(sheet.columnWidths, sheet.hiddenColumns);
  const body = rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cells = row
        .map((value, columnIndex) =>
          cellXml(
            value,
            rowNumber,
            columnIndex,
            styleIdForWorkbookCell({
              columnIndex,
              rowNumber,
              sheet,
              styleRegistry,
              value
            })
          )
        )
        .join("");
      return `<row r="${rowNumber}">${cells}</row>`;
    })
    .join("");
  const sheetViews = sheet.freezeTopRows
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${sheet.freezeTopRows}" topLeftCell="A${sheet.freezeTopRows + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : "";
  const autoFilter =
    sheet.autoFilter && rows.length > 0
      ? `<autoFilter ref="A1:${columnName(maxColumnCount - 1)}${rowCount}"/>`
      : "";
  const dataValidations = dataValidationsXml(sheet.dataValidations);
  const tablePartsXmlValue = tablePartsXml(tableParts);

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="${dimensionReference}"/>
  ${sheetViews}
  <sheetFormatPr defaultRowHeight="18"/>
  ${columns}
  <sheetData>${body}</sheetData>
  ${autoFilter}
  ${dataValidations}
  ${tablePartsXmlValue}
  <pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
</worksheet>`;
}

function worksheetRelationshipsXml(tableParts: WorksheetTablePart[]) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${tableParts
    .map(
      (table) =>
        `<Relationship Id="${table.relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table${table.tableId}.xml"/>`
    )
    .join("")}
</Relationships>`;
}

function tableXml(table: WorksheetTablePart) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="${
    table.tableId
  }" name="${escapeXmlAttribute(table.name)}" displayName="${escapeXmlAttribute(
    table.name
  )}" ref="${escapeXmlAttribute(table.ref)}" totalsRowShown="0">
  <autoFilter ref="${escapeXmlAttribute(table.ref)}"/>
  <tableColumns count="${table.columns.length}">
    ${table.columns
      .map(
        (column, index) =>
          `<tableColumn id="${index + 1}" name="${escapeXmlAttribute(column)}"/>`
      )
      .join("")}
  </tableColumns>
  <tableStyleInfo name="${escapeXmlAttribute(
    table.styleName ?? "TableStyleMedium2"
  )}" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/>
</table>`;
}

function tablePartsXml(tableParts: WorksheetTablePart[]) {
  if (tableParts.length === 0) {
    return "";
  }

  return `<tableParts count="${tableParts.length}">${tableParts
    .map((table) => `<tablePart r:id="${table.relationshipId}"/>`)
    .join("")}</tableParts>`;
}

function cellXml(
  value: WorkbookCell,
  rowNumber: number,
  columnIndex: number,
  styleId = 0
) {
  const reference = `${columnName(columnIndex)}${rowNumber}`;
  const styleAttribute = styleId > 0 ? ` s="${styleId}"` : "";
  if (value === null || value === undefined || value === "") {
    if (styleId > 0) {
      return `<c r="${reference}"${styleAttribute}/>`;
    }
    return "";
  }

  if (isFormulaCell(value)) {
    const cachedValue = value.value;
    const cachedXml =
      typeof cachedValue === "number" && Number.isFinite(cachedValue)
        ? `<v>${cachedValue}</v>`
        : typeof cachedValue === "string" && cachedValue.trim() !== ""
          ? `<v>${escapeXmlText(cachedValue)}</v>`
          : "";
    const resultType = typeof cachedValue === "string" ? ' t="str"' : "";
    return `<c r="${reference}"${styleAttribute}${resultType}><f>${escapeXmlText(
      value.formula
    )}</f>${cachedXml}</c>`;
  }

  if (isDateCell(value)) {
    const serialNumber = dateCellToExcelSerial(value.date);
    if (serialNumber === null) {
      if (styleId > 0) {
        return `<c r="${reference}"${styleAttribute}/>`;
      }
      return "";
    }
    return `<c r="${reference}"${styleAttribute}><v>${serialNumber}</v></c>`;
  }

  if (isNumberCell(value)) {
    const numberValue = value.value;
    if (typeof numberValue === "number" && Number.isFinite(numberValue)) {
      return `<c r="${reference}"${styleAttribute}><v>${numberValue}</v></c>`;
    }
    if (styleId > 0) {
      return `<c r="${reference}"${styleAttribute}/>`;
    }
    return "";
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${reference}"${styleAttribute}><v>${value}</v></c>`;
  }

  return `<c r="${reference}"${styleAttribute} t="inlineStr"><is><t>${escapeXmlText(
    String(value)
  )}</t></is></c>`;
}

function styleIdForWorkbookCell({
  columnIndex,
  rowNumber,
  sheet,
  styleRegistry,
  value
}: {
  columnIndex: number;
  rowNumber: number;
  sheet: WorkbookSheet;
  styleRegistry: StyleRegistry;
  value: WorkbookCell;
}) {
  const baseStyleId = styleIdForCell(sheet, rowNumber, columnIndex);
  const numberFormatCode = numberFormatCodeForCell(value);

  return styleRegistry.styleIdFor(baseStyleId, numberFormatCode);
}

function numberFormatCodeForCell(value: WorkbookCell) {
  if (
    typeof value === "object" &&
    value !== null &&
    "numberFormatCode" in value &&
    typeof value.numberFormatCode === "string" &&
    value.numberFormatCode.trim() !== ""
  ) {
    return value.numberFormatCode.trim();
  }

  return null;
}

function dataValidationsXml(dataValidations: WorkbookDataValidation[] | undefined) {
  const validations = (dataValidations ?? []).filter(
    (validation) => validation.ranges.length > 0 && validation.formula1.trim() !== ""
  );
  if (validations.length === 0) {
    return "";
  }

  return `<dataValidations count="${validations.length}">${validations
    .map(
      (validation) =>
        `<dataValidation type="${validation.type}" allowBlank="${
          validation.allowBlank === false ? 0 : 1
        }" showErrorMessage="1" sqref="${escapeXmlAttribute(
          validation.ranges.join(" ")
        )}"><formula1>${escapeXmlText(validation.formula1)}</formula1></dataValidation>`
    )
    .join("")}</dataValidations>`;
}

function columnsXml(
  columnWidths: number[] | undefined,
  hiddenColumns: number[] | undefined
) {
  const hiddenColumnIndexes = new Set(
    (hiddenColumns ?? []).filter(
      (index) => Number.isInteger(index) && index >= 0
    )
  );
  const maxHiddenColumn =
    hiddenColumnIndexes.size > 0 ? Math.max(...hiddenColumnIndexes) + 1 : 0;
  const columnCount = Math.max(columnWidths?.length ?? 0, maxHiddenColumn);
  if (columnCount === 0) {
    return "";
  }

  return `<cols>${Array.from({ length: columnCount }, (_, index) => {
      const width = columnWidths?.[index] ?? 12;
      const columnNumber = index + 1;
      const hiddenAttribute = hiddenColumnIndexes.has(index) ? ' hidden="1"' : "";
      return `<col min="${columnNumber}" max="${columnNumber}" width="${width}" customWidth="1"${hiddenAttribute}/>`;
    })
    .join("")}</cols>`;
}

function styleIdForCell(
  sheet: WorkbookSheet,
  rowNumber: number,
  columnIndex: number
) {
  if (sheet.style === "promotionPeriodRules") {
    if (rowNumber === 1) {
      return columnIndex >= 3 ? 3 : 1;
    }
    if (columnIndex === 3 || columnIndex === 4) {
      return 17;
    }
    return rowNumber % 2 === 0 ? 6 : 7;
  }

  if (sheet.style === "newLaunchedProducts") {
    if (rowNumber === 1) {
      return columnIndex >= 4 ? 3 : 1;
    }
    if (columnIndex === 4) {
      return 17;
    }
    return rowNumber % 2 === 0 ? 6 : 7;
  }

  if (sheet.style === "valueChain") {
    return valueChainStyleId(rowNumber, columnIndex);
  }

  if (sheet.style === "businessPlan") {
    return businessPlanStyleId(rowNumber, columnIndex);
  }

  if (sheet.style === "bpMasterData") {
    return bpMasterDataStyleId(rowNumber, columnIndex);
  }

  if (sheet.style !== "promotionPlan") {
    return 0;
  }

  if (rowNumber === 1) {
    if (columnIndex <= 7) {
      return 1;
    }
    if (columnIndex <= 17) {
      return 2;
    }
    if (columnIndex <= 23) {
      return 3;
    }
    if (columnIndex <= 30) {
      return 4;
    }
    return 5;
  }

  const even = rowNumber % 2 === 0;
  if (columnIndex === 22 || columnIndex === 23) {
    return 17;
  }
  if (columnIndex === 20) {
    return 13;
  }
  if (columnIndex === 21) {
    return 14;
  }
  if (columnIndex === 18 || columnIndex === 19) {
    return 12;
  }
  if (columnIndex === 30) {
    return 16;
  }
  if (columnIndex >= 24 && columnIndex <= 29) {
    return 15;
  }
  if (columnIndex >= 11 && columnIndex <= 15) {
    return even ? 10 : 11;
  }
  if (
    columnIndex === 8 ||
    columnIndex === 9 ||
    columnIndex === 10 ||
    columnIndex === 16 ||
    columnIndex === 17
  ) {
    return even ? 8 : 9;
  }
  return even ? 6 : 7;
}

function valueChainStyleId(rowNumber: number, columnIndex: number) {
  if (rowNumber === 1) {
    if (columnIndex <= 7) {
      return 1;
    }
    if (columnIndex <= 20) {
      return 2;
    }
    if (columnIndex <= 30) {
      return 3;
    }
    return 4;
  }

  const even = rowNumber % 2 === 0;
  if (columnIndex <= 7) {
    return even ? 6 : 7;
  }
  if (columnIndex >= 8 && columnIndex <= 20) {
    return isValueChainPercentColumn(columnIndex) ? 20 : 19;
  }
  if (columnIndex >= 21 && columnIndex <= 30) {
    return isValueChainPercentColumn(columnIndex) ? 13 : 12;
  }
  return isValueChainPercentColumn(columnIndex) ? 16 : 15;
}

function isValueChainPercentColumn(columnIndex: number) {
  return [10, 12, 14, 20, 23, 25, 30, 31, 33].includes(columnIndex);
}

function businessPlanStyleId(rowNumber: number, columnIndex: number) {
  if (rowNumber === 1) {
    if (columnIndex <= 10) {
      return 1;
    }
    if (columnIndex <= 23) {
      return 2;
    }
    if (isBusinessPlanEditableColumn(columnIndex)) {
      return 4;
    }
    if (columnIndex === 34) {
      return 5;
    }
    return 3;
  }

  const even = rowNumber % 2 === 0;
  if (isBusinessPlanEditableColumn(columnIndex)) {
    if (columnIndex === 24) {
      return 16;
    }
    if (columnIndex === 25) {
      return 15;
    }
    return 21;
  }
  if (isBusinessPlanPercentColumn(columnIndex)) {
    return even ? 10 : 11;
  }
  if (isBusinessPlanIntegerColumn(columnIndex)) {
    return 14;
  }
  if (isBusinessPlanNumberColumn(columnIndex)) {
    return even ? 8 : 9;
  }
  return even ? 6 : 7;
}

function bpMasterDataStyleId(rowNumber: number, columnIndex: number) {
  if (rowNumber === 1) {
    if (columnIndex >= 5 && columnIndex <= 8) {
      return 22;
    }
    if (columnIndex >= 9 && columnIndex <= 12) {
      return 23;
    }
    if (columnIndex >= 13 && columnIndex <= 16) {
      return 24;
    }
    if (columnIndex >= 17 && columnIndex <= 20) {
      return 25;
    }

    return 1;
  }

  const even = rowNumber % 2 === 0;
  if (columnIndex >= 5 && columnIndex <= 8) {
    return 26;
  }
  if (columnIndex >= 9 && columnIndex <= 12) {
    return 27;
  }
  if (columnIndex >= 13 && columnIndex <= 16) {
    return 28;
  }
  if (columnIndex >= 17 && columnIndex <= 20) {
    return 29;
  }
  if (columnIndex === 27) {
    return even ? 10 : 11;
  }
  if (
    columnIndex === 25 ||
    columnIndex === 26 ||
    columnIndex === 28 ||
    columnIndex === 29 ||
    columnIndex === 32
  ) {
    return even ? 8 : 9;
  }

  return even ? 6 : 7;
}

function isBusinessPlanEditableColumn(columnIndex: number) {
  return [24, 25, 27, 28].includes(columnIndex);
}

function isBusinessPlanPercentColumn(columnIndex: number) {
  return [13, 14, 15, 16, 17, 24].includes(columnIndex);
}

function isBusinessPlanIntegerColumn(columnIndex: number) {
  return [27, 28].includes(columnIndex);
}

function isBusinessPlanNumberColumn(columnIndex: number) {
  return (
    (columnIndex >= 11 && columnIndex <= 12) ||
    (columnIndex >= 18 && columnIndex <= 23) ||
    (columnIndex >= 25 && columnIndex <= 33)
  );
}

function baseXfs(): XfDefinition[] {
  return [
    {},
    { font: 1, fill: 2, border: 1, alignment: "header" },
    { font: 2, fill: 3, border: 1, alignment: "header" },
    { font: 2, fill: 4, border: 1, alignment: "header" },
    { font: 2, fill: 5, border: 1, alignment: "header" },
    { font: 2, fill: 6, border: 1, alignment: "header" },
    { border: 1, alignment: "text" },
    { fill: 8, border: 1, alignment: "text" },
    { numFmt: 164, border: 1, alignment: "number" },
    { numFmt: 164, fill: 8, border: 1, alignment: "number" },
    { numFmt: 165, border: 1, alignment: "number" },
    { numFmt: 165, fill: 8, border: 1, alignment: "number" },
    { numFmt: 164, fill: 9, border: 1, alignment: "number" },
    { numFmt: 165, fill: 9, border: 1, alignment: "number" },
    { numFmt: 166, fill: 9, border: 1, alignment: "number" },
    { numFmt: 164, fill: 10, border: 1, alignment: "number" },
    { numFmt: 165, fill: 10, border: 1, alignment: "number" },
    { numFmt: 167, fill: 9, border: 1, alignment: "number" },
    { fill: 3, border: 1, alignment: "text" },
    { numFmt: 164, fill: 3, border: 1, alignment: "number" },
    { numFmt: 165, fill: 3, border: 1, alignment: "number" },
    { numFmt: 166, fill: 10, border: 1, alignment: "number" },
    { font: 1, fill: 15, border: 1, alignment: "header" },
    { font: 1, fill: 16, border: 1, alignment: "header" },
    { font: 1, fill: 17, border: 1, alignment: "header" },
    { font: 1, fill: 18, border: 1, alignment: "header" },
    { numFmt: 165, fill: 11, border: 1, alignment: "number" },
    { numFmt: 165, fill: 12, border: 1, alignment: "number" },
    { numFmt: 165, fill: 13, border: 1, alignment: "number" },
    { numFmt: 165, fill: 14, border: 1, alignment: "number" }
  ];
}

function stylesXml(dynamicStyles: DynamicCellStyle[] = []) {
  const baseDefinitions = baseXfs();
  const dynamicNumberFormats = uniqueDynamicNumberFormats(dynamicStyles);
  const xfs = [
    ...baseDefinitions.map((definition) => xf(definition)),
    ...dynamicStyles.map((style) => {
      const baseDefinition = baseDefinitions[style.baseStyleId] ?? {};
      return xf({ ...baseDefinition, numFmt: style.numFmtId });
    })
  ];
  const numberFormats = [
    { numFmtId: 164, formatCode: "#,##0.00" },
    { numFmtId: 165, formatCode: "0.00%" },
    { numFmtId: 166, formatCode: "#,##0" },
    { numFmtId: 167, formatCode: "dd/mm/yyyy" },
    ...dynamicNumberFormats
  ];

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="${numberFormats.length}">
    ${numberFormats
      .map(
        (format) =>
          `<numFmt numFmtId="${format.numFmtId}" formatCode="${escapeXmlAttribute(
            format.formatCode
          )}"/>`
      )
      .join("")}
  </numFmts>
  <fonts count="3">
    <font><sz val="10"/><color rgb="FF0F172A"/><name val="Aptos"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font>
    <font><b/><sz val="10"/><color rgb="FF0F172A"/><name val="Aptos"/></font>
  </fonts>
  <fills count="19">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1E293B"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDBEAFE"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDCFCE7"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFFBEB"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF0FDF4"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFEDD5"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE0F2FE"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDCFCE7"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF3E8FF"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF9A3412"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF075985"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF166534"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF6D28D9"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFCBD5E1"/></left><right style="thin"><color rgb="FFCBD5E1"/></right><top style="thin"><color rgb="FFCBD5E1"/></top><bottom style="thin"><color rgb="FFCBD5E1"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  <dxfs count="0"/>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`;
}

function uniqueDynamicNumberFormats(dynamicStyles: DynamicCellStyle[]) {
  const formatsById = new Map<number, { numFmtId: number; formatCode: string }>();

  for (const style of dynamicStyles) {
    formatsById.set(style.numFmtId, {
      numFmtId: style.numFmtId,
      formatCode: style.numberFormatCode
    });
  }

  return [...formatsById.values()].sort((a, b) => a.numFmtId - b.numFmtId);
}

function xf({
  numFmt = 0,
  font = 0,
  fill = 0,
  border = 0,
  alignment
}: XfDefinition) {
  const attributes = [
    `numFmtId="${numFmt}"`,
    `fontId="${font}"`,
    `fillId="${fill}"`,
    `borderId="${border}"`,
    'xfId="0"',
    numFmt > 0 ? 'applyNumberFormat="1"' : "",
    font > 0 ? 'applyFont="1"' : "",
    fill > 0 ? 'applyFill="1"' : "",
    border > 0 ? 'applyBorder="1"' : "",
    alignment ? 'applyAlignment="1"' : ""
  ]
    .filter(Boolean)
    .join(" ");

  if (!alignment) {
    return `<xf ${attributes}/>`;
  }

  if (alignment === "header") {
    return `<xf ${attributes}><alignment horizontal="center" vertical="center" wrapText="1"/></xf>`;
  }

  if (alignment === "number") {
    return `<xf ${attributes}><alignment horizontal="right" vertical="center"/></xf>`;
  }

  return `<xf ${attributes}><alignment horizontal="left" vertical="center"/></xf>`;
}

function isFormulaCell(value: WorkbookCell): value is WorkbookFormulaCell {
  return (
    typeof value === "object" &&
    value !== null &&
    "formula" in value &&
    typeof value.formula === "string"
  );
}

function isDateCell(value: WorkbookCell): value is WorkbookDateCell {
  return (
    typeof value === "object" &&
    value !== null &&
    "date" in value &&
    !("formula" in value)
  );
}

function isNumberCell(value: WorkbookCell): value is WorkbookNumberCell {
  return (
    typeof value === "object" &&
    value !== null &&
    "value" in value &&
    !("formula" in value) &&
    !("date" in value)
  );
}

function dateCellToExcelSerial(value: WorkbookDateCell["date"]) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const date =
    value instanceof Date
      ? value
      : /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? new Date(`${value}T00:00:00.000Z`)
        : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return Math.round(date.getTime() / 86400000 + 25569);
}

function columnName(index: number) {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function writeZip(
  parts: ZipPart[],
  { compress = false }: { compress?: boolean } = {}
) {
  const localFileParts: Buffer[] = [];
  const centralDirectoryParts: Buffer[] = [];
  let offset = 0;

  for (const part of parts.map((zipPart) => prepareZipPart(zipPart, compress))) {
    const name = Buffer.from(part.path, "utf8");
    const crc = crc32(part.contents);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(part.compressionMethod, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(part.compressedContents.length, 18);
    localHeader.writeUInt32LE(part.contents.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localFileParts.push(localHeader, name, part.compressedContents);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(part.compressionMethod, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(part.compressedContents.length, 20);
    centralHeader.writeUInt32LE(part.contents.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralDirectoryParts.push(centralHeader, name);
    offset += localHeader.length + name.length + part.compressedContents.length;
  }

  const localFiles = Buffer.concat(localFileParts);
  const centralDirectory = Buffer.concat(centralDirectoryParts);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(parts.length, 8);
  endRecord.writeUInt16LE(parts.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(localFiles.length, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([localFiles, centralDirectory, endRecord]);
}

function prepareZipPart(part: ZipPart, compress: boolean): PreparedZipPart {
  if (!compress) {
    return {
      ...part,
      compressedContents: part.contents,
      compressionMethod: 0
    };
  }

  const compressedContents = deflateRawSync(part.contents, { level: 9 });
  if (compressedContents.length >= part.contents.length) {
    return {
      ...part,
      compressedContents: part.contents,
      compressionMethod: 0
    };
  }

  return {
    ...part,
    compressedContents,
    compressionMethod: 8
  };
}

function readZipParts(buffer: Buffer): ZipPart[] {
  const endOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16);
  const parts: ZipPart[] = [];
  let offset = centralDirectoryOffset;

  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("Invalid XLSX central directory");
    }

    const entry = readCentralDirectoryEntry(buffer, offset);
    parts.push({
      path: entry.name,
      contents: readLocalZipEntry(buffer, entry)
    });

    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return parts;
}

function readCentralDirectoryEntry(
  buffer: Buffer,
  offset: number
): ZipDirectoryEntry {
  const nameLength = buffer.readUInt16LE(offset + 28);
  const nameStart = offset + 46;

  return {
    compressionMethod: buffer.readUInt16LE(offset + 10),
    compressedSize: buffer.readUInt32LE(offset + 20),
    localHeaderOffset: buffer.readUInt32LE(offset + 42),
    name: buffer.toString("utf8", nameStart, nameStart + nameLength)
  };
}

function readLocalZipEntry(buffer: Buffer, entry: ZipDirectoryEntry) {
  const localOffset = entry.localHeaderOffset;
  if (buffer.readUInt32LE(localOffset) !== 0x04034b50) {
    throw new Error("Invalid XLSX local file header");
  }

  const nameLength = buffer.readUInt16LE(localOffset + 26);
  const extraLength = buffer.readUInt16LE(localOffset + 28);
  const dataStart = localOffset + 30 + nameLength + extraLength;
  const compressedData = buffer.subarray(
    dataStart,
    dataStart + entry.compressedSize
  );

  if (entry.compressionMethod === 0) {
    return Buffer.from(compressedData);
  }
  if (entry.compressionMethod === 8) {
    return inflateRawSync(compressedData);
  }

  throw new Error(`Unsupported XLSX compression method: ${entry.compressionMethod}`);
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const minimumOffset = Math.max(0, buffer.length - 22 - 0xffff);
  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }

  throw new Error("Invalid XLSX file");
}

const CRC_TABLE = new Uint32Array(256).map((_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function xmlBuffer(xml: string) {
  return Buffer.from(xml, "utf8");
}

function escapeXmlText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeXmlAttribute(value: string) {
  return escapeXmlText(value).replace(/"/g, "&quot;");
}
