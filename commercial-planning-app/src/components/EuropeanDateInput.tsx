"use client";

import { useEffect, useState } from "react";
import { formatEuropeanDate } from "@/lib/format";
import { parsePromotionDateInput } from "@/lib/promotionPlanDates";

type EuropeanDateInputProps = {
  label: string;
  value?: string;
  defaultValue?: string | number;
  name?: string;
  className?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  onChange?: (value: string) => void;
};

export function EuropeanDateInput({
  label,
  value,
  defaultValue,
  name,
  className = "",
  disabled = false,
  readOnly = false,
  required = false,
  onChange
}: EuropeanDateInputProps) {
  const [internalValue, setInternalValue] = useState(
    String(value ?? defaultValue ?? "")
  );
  const currentValue = value ?? internalValue;
  const [draftValue, setDraftValue] = useState(formatDateForDisplay(currentValue));
  const hiddenValue = parsePromotionDateInput(currentValue) ?? currentValue;
  const pickerValue = parsePromotionDateInput(currentValue) ?? "";

  useEffect(() => {
    setDraftValue(formatDateForDisplay(currentValue));
  }, [currentValue]);

  function updateValue(nextDisplayValue: string, shouldFormat: boolean) {
    setDraftValue(nextDisplayValue);

    const trimmedValue = nextDisplayValue.trim();
    const nextValue =
      trimmedValue === "" ? "" : parsePromotionDateInput(trimmedValue) ?? trimmedValue;

    if (value === undefined) {
      setInternalValue(nextValue);
    }
    onChange?.(nextValue);

    if (shouldFormat) {
      setDraftValue(formatDateForDisplay(nextValue));
    }
  }

  return (
    <span className="relative block">
      {name ? <input name={name} type="hidden" value={hiddenValue} /> : null}
      <input
        aria-label={label}
        className={`${className} pr-6`}
        disabled={disabled}
        inputMode="numeric"
        placeholder="DD/MM/YYYY"
        readOnly={readOnly}
        required={required}
        type="text"
        value={draftValue}
        onBlur={() => updateValue(draftValue, true)}
        onChange={(event) => {
          if (!readOnly) {
            updateValue(event.target.value, false);
          }
        }}
      />
      {!readOnly && !disabled ? (
        <input
          aria-label={`${label} picker`}
          className="absolute inset-y-0 right-0 h-full w-6 cursor-pointer opacity-0"
          tabIndex={-1}
          type="date"
          value={pickerValue}
          onChange={(event) => updateValue(event.target.value, true)}
        />
      ) : null}
      {!readOnly && !disabled ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-1 grid place-items-center text-[10px] font-semibold text-slate-400"
        >
          v
        </span>
      ) : null}
    </span>
  );
}

function formatDateForDisplay(value: string | number | null | undefined) {
  const textValue = String(value ?? "").trim();
  if (textValue === "") {
    return "";
  }

  const parsedValue = parsePromotionDateInput(textValue);
  return parsedValue ? formatEuropeanDate(parsedValue) : textValue;
}
