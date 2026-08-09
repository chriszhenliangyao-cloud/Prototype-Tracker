import { inflateRawSync } from "node:zlib";

export type XlsxRow = {
  rowNumber: number;
  cells: string[];
};

type ZipEntry = {
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
};

export function readFirstWorksheetRows(input: Buffer | ArrayBuffer): XlsxRow[] {
  const files = readZipFiles(toBuffer(input));
  const worksheetPath = findFirstWorksheetPath(files);
  const worksheetXml = getRequiredText(files, worksheetPath);
  const sharedStrings = parseSharedStrings(files.get("xl/sharedStrings.xml"));

  return parseWorksheetRows(worksheetXml, sharedStrings);
}

export function readWorksheetRows(
  input: Buffer | ArrayBuffer,
  sheetName: string
): XlsxRow[] {
  const files = readZipFiles(toBuffer(input));
  const worksheetPath = findWorksheetPath(files, sheetName);
  const worksheetXml = getRequiredText(files, worksheetPath);
  const sharedStrings = parseSharedStrings(files.get("xl/sharedStrings.xml"));

  return parseWorksheetRows(worksheetXml, sharedStrings);
}

export function readWorkbookSheetNames(input: Buffer | ArrayBuffer): string[] {
  const files = readZipFiles(toBuffer(input));
  return readWorkbookSheets(files).map((sheet) => sheet.name);
}

/**
 * Reads the XML Spreadsheet 2003 format commonly saved with an `.xls` extension.
 * This is intentionally separate from the ZIP/XLSX reader above so callers can
 * accept an operational export without treating legacy XML as a corrupt XLSX file.
 */
export function readExcel2003XmlWorksheetRows(
  input: Buffer | ArrayBuffer,
  sheetName: string
): XlsxRow[] {
  const xml = toBuffer(input).toString("utf8");
  const worksheet = matchTagContentsWithAttributes(xml, "Worksheet").find(
    (item) => readAttributes(item.attributes).get("ss:Name") === sheetName
  );

  if (!worksheet) {
    throw new Error(`Missing worksheet: ${sheetName}`);
  }

  return matchTagContentsWithAttributes(worksheet.contents, "Row").map(
    ({ attributes, contents }, rowIndex) => {
      const rowNumber =
        Number(readAttributes(attributes).get("ss:Index")) || rowIndex + 1;
      const cells: string[] = [];
      let fallbackColumnIndex = 0;

      for (const cell of matchTagContentsWithAttributes(contents, "Cell")) {
        const cellAttributes = readAttributes(cell.attributes);
        const cellIndex = Number(cellAttributes.get("ss:Index"));
        const columnIndex =
          Number.isInteger(cellIndex) && cellIndex > 0
            ? cellIndex - 1
            : fallbackColumnIndex;
        cells[columnIndex] = readExcel2003CellValue(cell.contents);
        fallbackColumnIndex = columnIndex + 1;
      }

      return { rowNumber, cells };
    }
  );
}

export function isExcel2003XmlWorkbook(input: Buffer | ArrayBuffer): boolean {
  const text = toBuffer(input).subarray(0, 2048).toString("utf8");
  return /<\?xml|<Workbook\b/i.test(text) && /urn:schemas-microsoft-com:office:spreadsheet/i.test(text);
}

function toBuffer(input: Buffer | ArrayBuffer): Buffer {
  return Buffer.isBuffer(input) ? input : Buffer.from(input);
}

function readZipFiles(buffer: Buffer): Map<string, Buffer> {
  const endOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16);
  const files = new Map<string, Buffer>();
  let offset = centralDirectoryOffset;

  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("Invalid XLSX central directory");
    }

    const entry = readCentralDirectoryEntry(buffer, offset);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const nameStart = offset + 46;
    const name = buffer.toString("utf8", nameStart, nameStart + nameLength);

    files.set(name, readLocalEntry(buffer, entry));
    offset = nameStart + nameLength + extraLength + commentLength;
  }

  return files;
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

function readCentralDirectoryEntry(buffer: Buffer, offset: number): ZipEntry {
  return {
    compressionMethod: buffer.readUInt16LE(offset + 10),
    compressedSize: buffer.readUInt32LE(offset + 20),
    localHeaderOffset: buffer.readUInt32LE(offset + 42)
  };
}

function readLocalEntry(buffer: Buffer, entry: ZipEntry): Buffer {
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

function findFirstWorksheetPath(files: Map<string, Buffer>): string {
  const firstSheet = readWorkbookSheets(files)[0];
  if (firstSheet) {
    return firstSheet.path;
  }

  return "xl/worksheets/sheet1.xml";
}

function findWorksheetPath(files: Map<string, Buffer>, sheetName: string): string {
  const normalizedSheetName = normalizeSheetName(sheetName);
  const sheets = readWorkbookSheets(files);
  const sheet = sheets.find(
    (item) => normalizeSheetName(item.name) === normalizedSheetName
  );

  if (!sheet) {
    throw new Error(`Missing worksheet: ${sheetName}`);
  }

  return sheet.path;
}

function readWorkbookSheets(
  files: Map<string, Buffer>
): Array<{ name: string; path: string }> {
  const workbookXml = files.get("xl/workbook.xml")?.toString("utf8");
  const relsXml = files.get("xl/_rels/workbook.xml.rels")?.toString("utf8");

  if (!workbookXml || !relsXml) {
    return [];
  }

  const relationships = new Map<string, string>();
  for (const relationshipTag of matchTags(relsXml, "Relationship")) {
    const attributes = readAttributes(relationshipTag);
    const id = attributes.get("Id");
    const target = attributes.get("Target");
    if (id && target) {
      relationships.set(id, resolveWorkbookTarget(target));
    }
  }

  return matchTags(workbookXml, "sheet").flatMap((sheetTag) => {
    const attributes = readAttributes(sheetTag);
    const name = attributes.get("name");
    const relationshipId = attributes.get("r:id");
    const path = relationshipId ? relationships.get(relationshipId) : undefined;

    return name && path ? [{ name, path }] : [];
  });
}

function normalizeSheetName(sheetName: string): string {
  return sheetName.trim().replace(/\s+/g, " ").toLowerCase();
}

function resolveWorkbookTarget(target: string): string {
  if (target.startsWith("/")) {
    return target.slice(1);
  }

  return normalizePath(`xl/${target}`);
}

function normalizePath(path: string): string {
  const segments: string[] = [];
  for (const segment of path.split("/")) {
    if (segment === "" || segment === ".") {
      continue;
    }

    if (segment === "..") {
      segments.pop();
      continue;
    }

    segments.push(segment);
  }

  return segments.join("/");
}

function getRequiredText(files: Map<string, Buffer>, path: string): string {
  const file = files.get(path);
  if (!file) {
    throw new Error(`Missing XLSX part: ${path}`);
  }

  return file.toString("utf8");
}

function parseSharedStrings(file: Buffer | undefined): string[] {
  if (!file) {
    return [];
  }

  const xml = file.toString("utf8");
  return matchTagContents(xml, "si").map(readTextContent);
}

function parseWorksheetRows(xml: string, sharedStrings: string[]): XlsxRow[] {
  return matchTagContentsWithAttributes(xml, "row").map(
    ({ attributes, contents }, rowIndex) => {
      const rowNumber = Number(readAttributes(attributes).get("r")) || rowIndex + 1;
      const cells: string[] = [];
      let fallbackColumnIndex = 0;

      for (const cell of matchTagContentsWithAttributes(contents, "c")) {
        const cellAttributes = readAttributes(cell.attributes);
        const reference = cellAttributes.get("r");
        const columnIndex = reference
          ? columnIndexFromReference(reference)
          : fallbackColumnIndex;

        cells[columnIndex] = readCellValue(
          cell.contents,
          cellAttributes.get("t"),
          sharedStrings
        );
        fallbackColumnIndex = columnIndex + 1;
      }

      return { rowNumber, cells };
    }
  );
}

function readCellValue(
  contents: string,
  type: string | undefined,
  sharedStrings: string[]
): string {
  if (type === "s") {
    const sharedStringIndex = Number(readFirstValue(contents));
    return sharedStrings[sharedStringIndex] ?? "";
  }

  if (type === "inlineStr") {
    return readTextContent(contents);
  }

  return decodeXml(readFirstValue(contents));
}

function readExcel2003CellValue(contents: string): string {
  const data = matchTagContentsWithAttributes(contents, "Data")[0];
  return data ? decodeXml(stripXmlTags(data.contents)).trim() : "";
}

function readFirstValue(contents: string): string {
  const match = contents.match(
    new RegExp(`<${xmlTagPattern("v")}\\b[^>]*>([\\s\\S]*?)<\\/${xmlTagPattern("v")}>`, "i")
  );
  return match ? match[1] : "";
}

function readTextContent(contents: string): string {
  const textValues = [
    ...contents.matchAll(
      new RegExp(
        `<${xmlTagPattern("t")}\\b[^>]*>([\\s\\S]*?)<\\/${xmlTagPattern("t")}>`,
        "gi"
      )
    )
  ];
  if (textValues.length === 0) {
    return "";
  }

  return textValues.map((match) => decodeXml(match[1])).join("");
}

function matchTags(xml: string, tagName: string): string[] {
  return [...xml.matchAll(new RegExp(`<${xmlTagPattern(tagName)}\\b[^>]*\\/?>`, "gi"))].map(
    (match) => match[0]
  );
}

function matchTagContents(xml: string, tagName: string): string[] {
  return matchTagContentsWithAttributes(xml, tagName).map(
    ({ contents }) => contents
  );
}

function matchTagContentsWithAttributes(
  xml: string,
  tagName: string
): Array<{ attributes: string; contents: string }> {
  return [
    ...xml.matchAll(
      new RegExp(
        `<${xmlTagPattern(tagName)}\\b([^>]*?)\\/\\>|<${xmlTagPattern(tagName)}\\b([^>]*)>([\\s\\S]*?)<\\/${xmlTagPattern(tagName)}>`,
        "gi"
      )
    )
  ].map((match) => ({
    attributes: match[1] ?? match[2] ?? "",
    contents: match[3] ?? ""
  }));
}

function xmlTagPattern(tagName: string) {
  return `(?:[\\w.-]+:)?${tagName}`;
}

function readAttributes(tagOrAttributes: string): Map<string, string> {
  const attributes = new Map<string, string>();
  for (const match of tagOrAttributes.matchAll(
    /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
  )) {
    attributes.set(match[1], decodeXml(match[2] ?? match[3] ?? ""));
  }

  return attributes;
}

function columnIndexFromReference(reference: string): number {
  const letters = reference.match(/^[A-Z]+/i)?.[0].toUpperCase() ?? "A";
  let index = 0;

  for (const letter of letters) {
    index = index * 26 + letter.charCodeAt(0) - 64;
  }

  return index - 1;
}

function decodeXml(value: string): string {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,
    (_entity, code: string) => {
      if (code.toLowerCase().startsWith("#x")) {
        return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
      }

      if (code.startsWith("#")) {
        return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
      }

      switch (code.toLowerCase()) {
        case "amp":
          return "&";
        case "lt":
          return "<";
        case "gt":
          return ">";
        case "quot":
          return '"';
        case "apos":
          return "'";
        default:
          return "";
      }
    }
  );
}

function stripXmlTags(value: string): string {
  return value.replace(/<[^>]*>/g, "");
}
