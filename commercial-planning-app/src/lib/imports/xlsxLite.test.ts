import { describe, expect, test } from "vitest";
import {
  createXlsxWorkbook,
  recompressXlsxWorkbook
} from "./../exports/xlsxWorkbook";
import { readWorkbookSheetNames, readWorksheetRows } from "./xlsxLite";

describe("xlsxLite", () => {
  test("reads workbook sheets when xml tags use namespace prefixes", () => {
    const workbook = createNamespacedWorkbook([
      {
        name: "Import Notes",
        rows: [["Historical Promotion Plan Import - PL 2026"]]
      },
      {
        name: "2026-01",
        rows: [
          [
            "Country",
            "Channel / Retailer",
            "FD",
            "Incoterms",
            "Model",
            "Category",
            "Product",
            "RRPP Local",
            "Promo Volume",
            "Promo Start Date",
            "Promo End Date",
            "Deal Note"
          ],
          [
            "PL",
            "iDream",
            "Komsa",
            "DDP",
            "P75-P1",
            "Power bank",
            "MagPro Slim 5K",
            149.99,
            50,
            46027,
            46054,
            "Start with Power"
          ]
        ]
      }
    ]);

    expect(readWorkbookSheetNames(workbook)).toEqual(["Import Notes", "2026-01"]);
    expect(readWorksheetRows(workbook, "2026-01")).toEqual([
      {
        rowNumber: 1,
        cells: [
          "Country",
          "Channel / Retailer",
          "FD",
          "Incoterms",
          "Model",
          "Category",
          "Product",
          "RRPP Local",
          "Promo Volume",
          "Promo Start Date",
          "Promo End Date",
          "Deal Note"
        ]
      },
      {
        rowNumber: 2,
        cells: [
          "PL",
          "iDream",
          "Komsa",
          "DDP",
          "P75-P1",
          "Power bank",
          "MagPro Slim 5K",
          "149.99",
          "50",
          "46027",
          "46054",
          "Start with Power"
        ]
      }
    ]);
  });

  test("preserves cells after a styled blank cell in the middle of a row", () => {
    const workbook = createXlsxWorkbook([
      {
        name: "2026-06",
        style: "promotionPlan",
        rows: [
          ["Country", "Channel / Retailer", "Promotion Name", "FD"],
          ["FR", "Boulanger", "", "BBC"]
        ]
      }
    ]);

    const compressedWorkbook = recompressXlsxWorkbook(workbook);

    expect(workbookHasDeflatedEntries(compressedWorkbook)).toBe(true);
    expect(readWorksheetRows(compressedWorkbook, "2026-06")).toEqual([
      {
        rowNumber: 1,
        cells: ["Country", "Channel / Retailer", "Promotion Name", "FD"]
      },
      {
        rowNumber: 2,
        cells: ["FR", "Boulanger", "", "BBC"]
      }
    ]);
  });
});

function workbookHasDeflatedEntries(buffer: Buffer) {
  const endOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16);
  let offset = centralDirectoryOffset;

  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("Invalid XLSX central directory");
    }

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    if (compressionMethod === 8) {
      return true;
    }

    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return false;
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

type XlsxCell = string | number | null | undefined;

function createNamespacedWorkbook(
  sheets: Array<{ name: string; rows: XlsxCell[][] }>
): Buffer {
  const sharedStrings: string[] = [];
  const sharedStringIndexes = new Map<string, number>();
  const files = new Map<string, string>([
    [
      "[Content_Types].xml",
      xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${sheets
    .map(
      (_sheet, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join("")}
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`
    ],
    [
      "_rels/.rels",
      xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
    ],
    [
      "xl/workbook.xml",
      xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<x:workbook xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <x:sheets>
    ${sheets
      .map(
        (sheet, index) =>
          `<x:sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId${index + 1}"/>`
      )
      .join("")}
  </x:sheets>
</x:workbook>`
    ],
    [
      "xl/_rels/workbook.xml.rels",
      xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheets
    .map(
      (_sheet, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/xl/worksheets/sheet${index + 1}.xml"/>`
    )
    .join("")}
</Relationships>`
    ]
  ]);

  sheets.forEach((sheet, index) => {
    files.set(
      `xl/worksheets/sheet${index + 1}.xml`,
      createNamespacedSheetXml(sheet.rows, sharedStrings, sharedStringIndexes)
    );
  });
  files.set(
    "xl/sharedStrings.xml",
    createNamespacedSharedStringsXml(sharedStrings)
  );

  return createZip(files);
}

function createNamespacedSheetXml(
  rows: XlsxCell[][],
  sharedStrings: string[],
  sharedStringIndexes: Map<string, number>
): string {
  const rowXml = rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cells = row
        .map((cell, columnIndex) => {
          if (cell === null || cell === undefined || cell === "") {
            return "";
          }

          const reference = `${columnName(columnIndex)}${rowNumber}`;
          if (typeof cell === "number") {
            return `<x:c r="${reference}"><x:v>${cell}</x:v></x:c>`;
          }

          const sharedStringIndex = getSharedStringIndex(
            cell,
            sharedStrings,
            sharedStringIndexes
          );
          return `<x:c r="${reference}" t="s"><x:v>${sharedStringIndex}</x:v></x:c>`;
        })
        .join("");

      return `<x:row r="${rowNumber}">${cells}</x:row>`;
    })
    .join("");

  return xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <x:sheetData>${rowXml}</x:sheetData>
</x:worksheet>`;
}

function createNamespacedSharedStringsXml(strings: string[]): string {
  const items = strings
    .map((value) => `<x:si><x:t>${escapeXml(value)}</x:t></x:si>`)
    .join("");

  return xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<x:sst xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  ${items}
</x:sst>`;
}

function getSharedStringIndex(
  value: string,
  sharedStrings: string[],
  sharedStringIndexes: Map<string, number>
): number {
  const existingIndex = sharedStringIndexes.get(value);
  if (existingIndex !== undefined) {
    return existingIndex;
  }

  const nextIndex = sharedStrings.length;
  sharedStrings.push(value);
  sharedStringIndexes.set(value, nextIndex);
  return nextIndex;
}

function createZip(files: Map<string, string>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const [path, contents] of files) {
    const name = Buffer.from(path);
    const data = Buffer.from(contents);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc32(data), 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, name, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc32(data), 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);

    offset += localHeader.length + name.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const localFiles = Buffer.concat(localParts);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(files.size, 8);
  endOfCentralDirectory.writeUInt16LE(files.size, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(localFiles.length, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  return Buffer.concat([localFiles, centralDirectory, endOfCentralDirectory]);
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }

  return (crc ^ 0xffffffff) >>> 0;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }

  return crc >>> 0;
});

function columnName(index: number): string {
  let name = "";
  let value = index;
  do {
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);

  return name;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function xml(
  strings: TemplateStringsArray,
  ...values: Array<number | string>
): string {
  return strings.reduce(
    (result, segment, index) => `${result}${segment}${String(values[index] ?? "")}`,
    ""
  );
}
