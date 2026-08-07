import type { CalculatorFilters, NormalTableRow } from "./calculatorRows";

export type CalculatorFilterField =
  | "countryCode"
  | "channelName"
  | "fdName"
  | "model"
  | "category"
  | "productName"
  | "kaBuyingMargin";

export type CalculatorFilterOptions = Record<CalculatorFilterField, string[]>;

const FILTER_FIELDS: CalculatorFilterField[] = [
  "countryCode",
  "channelName",
  "fdName",
  "model",
  "category",
  "productName",
  "kaBuyingMargin"
];

const FILTER_PRIORITY: CalculatorFilterField[] = [
  "countryCode",
  "category",
  "channelName",
  "fdName",
  "model",
  "productName",
  "kaBuyingMargin"
];

export function buildCalculatorFilterOptions(
  rows: NormalTableRow[],
  filters: CalculatorFilters
): CalculatorFilterOptions {
  return FILTER_FIELDS.reduce((options, field) => {
    const rowsForField = rows.filter((row) =>
      rowMatchesFiltersExcept(row, filters, field)
    );

    return {
      ...options,
      [field]: unique(rowsForField.map((row) => rowFilterValue(row, field)))
    };
  }, emptyOptions());
}

export function normalizeCalculatorFilters(
  rows: NormalTableRow[],
  filters: CalculatorFilters
): CalculatorFilters {
  const cleanedFilters = cleanCalculatorFilters(filters);
  let normalized: CalculatorFilters = {};

  for (const field of FILTER_PRIORITY) {
    const values = filterValues(cleanedFilters, field);
    if (values.length === 0) {
      continue;
    }

    const options = buildCalculatorFilterOptions(rows, normalized);
    const validValues = options[field].filter((option) =>
      values.includes(option)
    );
    if (validValues.length === 0) {
      continue;
    }

    normalized = setRawFilterValues(normalized, field, validValues);
  }
  return normalized;
}

export function areCalculatorFiltersEqual(
  left: CalculatorFilters,
  right: CalculatorFilters
) {
  return FILTER_FIELDS.every((field) =>
    areValuesEqual(filterValues(left, field), filterValues(right, field))
  );
}

export function setCalculatorFilterValue(
  rows: NormalTableRow[],
  filters: CalculatorFilters,
  field: CalculatorFilterField,
  value: string | string[]
) {
  const nextFilters = unsetFilter(filters, field);
  const selectedValues = normalizeStringValues(value);

  if (selectedValues.length === 0) {
    return normalizeCalculatorFilters(rows, nextFilters);
  }

  if (field === "kaBuyingMargin") {
    const margins = selectedValues
      .map((selectedValue) => Number(selectedValue))
      .filter(Number.isFinite);
    return normalizeCalculatorFilters(
      rows,
      margins.length > 0
        ? { ...nextFilters, kaBuyingMargin: margins }
        : nextFilters
    );
  }

  return normalizeCalculatorFilters(rows, {
    ...nextFilters,
    [field]: selectedValues
  });
}

/**
 * Keeps the Model and Product Name filters together when either identity is
 * selected directly. This is intentionally opt-in so other calculator pages
 * retain their independent multi-filter behaviour.
 */
export function synchronizeProductIdentityFilters(
  rows: NormalTableRow[],
  filters: CalculatorFilters,
  changedField: "model" | "productName"
): CalculatorFilters {
  const pairedField =
    changedField === "model" ? "productName" : "model";
  const selectedValues = filterValues(filters, changedField);
  const nextFilters = unsetFilter(filters, pairedField);

  if (selectedValues.length === 0) {
    return nextFilters;
  }

  const pairedValues = unique(
    rows
      .filter((row) => selectedValues.includes(row[changedField]))
      .map((row) => row[pairedField])
  );

  return pairedValues.length > 0
    ? setRawFilterValues(nextFilters, pairedField, pairedValues)
    : nextFilters;
}

export function calculatorFilterValues(
  filters: CalculatorFilters,
  field: CalculatorFilterField
) {
  return filterValues(filters, field);
}

function rowMatchesFiltersExcept(
  row: NormalTableRow,
  filters: CalculatorFilters,
  exceptField: CalculatorFilterField
) {
  return FILTER_FIELDS.every(
    (field) =>
      field === exceptField ||
      matchesValue(rowFilterValue(row, field), filterValues(filters, field))
  );
}

function matchesValue(value: string, filters: string[]) {
  return filters.length === 0 || filters.includes(value);
}

function rowFilterValue(row: NormalTableRow, field: CalculatorFilterField) {
  if (field === "kaBuyingMargin") {
    return String(row.kaBuyingMargin);
  }

  return row[field];
}

function filterValues(filters: CalculatorFilters, field: CalculatorFilterField) {
  if (field === "kaBuyingMargin") {
    const margins = filters.kaBuyingMargin;
    const values = Array.isArray(margins)
      ? margins
      : margins === undefined
        ? []
        : [margins];
    return values
      .filter((value) => Number.isFinite(value))
      .map((value) => String(value));
  }

  return normalizeStringValues(filters[field]);
}

function unsetFilter(
  filters: CalculatorFilters,
  field: CalculatorFilterField
): CalculatorFilters {
  const nextFilters = { ...filters };
  delete nextFilters[field];
  return nextFilters;
}

function setRawFilterValues(
  filters: CalculatorFilters,
  field: CalculatorFilterField,
  values: string[]
): CalculatorFilters {
  if (field === "kaBuyingMargin") {
    const margins = values.map((value) => Number(value)).filter(Number.isFinite);
    return margins.length > 0 ? { ...filters, kaBuyingMargin: margins } : filters;
  }

  return {
    ...filters,
    [field]: values
  };
}

function cleanCalculatorFilters(filters: CalculatorFilters): CalculatorFilters {
  const cleanedFilters: CalculatorFilters = {};

  for (const field of FILTER_FIELDS) {
    const values = filterValues(filters, field);
    if (values.length === 0) {
      continue;
    }

    if (field === "kaBuyingMargin") {
      const margins = values.map((value) => Number(value)).filter(Number.isFinite);
      if (margins.length > 0) {
        cleanedFilters.kaBuyingMargin = margins;
      }
      continue;
    }

    cleanedFilters[field] = values;
  }

  return cleanedFilters;
}

function normalizeStringValues(value?: string | string[]) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function areValuesEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) =>
    left.localeCompare(right)
  );
}

function emptyOptions(): CalculatorFilterOptions {
  return {
    countryCode: [],
    channelName: [],
    fdName: [],
    model: [],
    category: [],
    productName: [],
    kaBuyingMargin: []
  };
}
