const INPUT_PRECISION = 6;

export function marginRatioToPercentInput(value: number | string) {
  if (value === "") {
    return "";
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return String(value);
  }

  return formatInputNumber(parsed * 100);
}

export function percentInputToMarginRatio(value: string) {
  if (value.trim() === "") {
    return "";
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return formatInputNumber(parsed / 100);
}

function formatInputNumber(value: number) {
  const multiplier = 10 ** INPUT_PRECISION;
  return String(Math.round(value * multiplier) / multiplier);
}
