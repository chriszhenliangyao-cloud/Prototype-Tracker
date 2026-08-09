"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildRrppSimulationRows,
  type RrppSimulationInputsByRow
} from "@/lib/calculatorRows";
import {
  applyManualPreviewRowOrder,
  buildQuickProductSetSimulationPreview,
  buildQuickSimulationPreview,
  buildSuggestedSku,
  convertEurToLocalCurrency,
  dropManualPreviewRowOrder,
  inferCurrencyExchangeRateToEur,
  mergeQuickSimulationInputsByRow,
  moveManualPreviewRowOrder,
  normalizeSku,
  quickChannelKey,
  roundCurrency,
  uniqueSuggestedSku
} from "@/lib/quickSimulation";
import type { ReferenceData } from "@/lib/types";
import { isOutsideDropdownTarget } from "./dropdownOutsideClick";
import { NormalWideTable } from "./WideCalculatorTable";
import { AutosaveStatus } from "./AutosaveStatus";
import { useAutosaveDraft } from "./useAutosaveDraft";

type SaveResult = {
  status: "success";
  message: string;
  sku: string;
  rrpEur: number;
  exportUrl: string | null;
  archive: {
    id: string;
    driveStatus: "NOT_CONFIGURED" | "UPLOADED" | "FAILED";
    driveUrl: string | null;
    downloadUrl: string | null;
  } | null;
};

type QuickSimulationMode = "single" | "set";

type ProductSetDraft = {
  id: string;
  category: string;
  productName: string;
  model: string;
  rrpEur: string;
  simRrppEur: string;
  bomRmb: string;
};

export function QuickNewProductSimulation({
  data,
  canAddToFormalList,
  userEmail
}: {
  data: ReferenceData;
  canAddToFormalList: boolean;
  userEmail: string | null;
}) {
  const router = useRouter();
  const countryOptions = useMemo(
    () => data.countries.filter((country) => country.status === "ACTIVE"),
    [data.countries]
  );
  const categoryOptions = useMemo(() => {
    const categories = new Set<string>();
    for (const margin of data.operationalMargins) {
      if (margin.status === "ACTIVE") {
        categories.add(margin.category);
      }
    }
    for (const product of data.products) {
      if (product.status === "ACTIVE") {
        categories.add(product.category);
      }
    }
    return [...categories].sort((a, b) => a.localeCompare(b));
  }, [data.operationalMargins, data.products]);
  const [countryCodes, setCountryCodes] = useState<string[]>(
    countryOptions[0]?.code ? [countryOptions[0].code] : []
  );
  const [mode, setMode] = useState<QuickSimulationMode>("single");
  const [channelKeys, setChannelKeys] = useState<string[]>([]);
  const [category, setCategory] = useState(categoryOptions[0] ?? "");
  const [productName, setProductName] = useState("");
  const [model, setModel] = useState("");
  const [rrpEur, setRrpEur] = useState("");
  const [bomRmb, setBomRmb] = useState("");
  const [productSetDraftCounter, setProductSetDraftCounter] = useState(2);
  const [productSetDrafts, setProductSetDrafts] = useState<ProductSetDraft[]>([
    createProductSetDraft("draft-1", categoryOptions[0] ?? "")
  ]);
  const [bulkSimulationRrppEur, setBulkSimulationRrppEur] = useState("");
  const [bulkSimulationTargetId, setBulkSimulationTargetId] = useState("all");
  const [previewUpdatedAt, setPreviewUpdatedAt] = useState("");
  const [isAdjustingPreviewOrder, setIsAdjustingPreviewOrder] = useState(false);
  const [manualPreviewRowOrder, setManualPreviewRowOrder] = useState<string[]>([]);
  const [draggedPreviewRowKey, setDraggedPreviewRowKey] = useState<string | null>(
    null
  );
  const [previewDragOverRowKey, setPreviewDragOverRowKey] = useState<
    string | null
  >(null);
  const [nudgeFeedback, setNudgeFeedback] = useState<{
    rowKey: string;
    direction: "up" | "down";
  } | null>(null);
  const nudgeFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const [openQuickFilter, setOpenQuickFilter] = useState<
    "country" | "channel" | "category" | null
  >(null);
  const quickFiltersRef = useRef<HTMLDivElement | null>(null);
  const [quickRrppInputs, setQuickRrppInputs] =
    useState<RrppSimulationInputsByRow>({});
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState<
    | {
        tone: "success" | "error" | "neutral";
        message: string;
        exportUrl?: string;
        archiveUrl?: string;
        driveUrl?: string | null;
        driveStatus?: "NOT_CONFIGURED" | "UPLOADED" | "FAILED";
      }
    | null
  >(null);
  const autosave = useAutosaveDraft({
    workspace: "QUICK_NEW_PRODUCT",
    scope: "draft",
    userEmail,
    value: {
      countryCodes,
      mode,
      channelKeys,
      category,
      productName,
      model,
      rrpEur,
      bomRmb,
      productSetDraftCounter,
      productSetDrafts,
      bulkSimulationRrppEur,
      bulkSimulationTargetId,
      quickRrppInputs,
      manualPreviewRowOrder
    },
    onRestore: (snapshot) => {
      if (Array.isArray(snapshot.countryCodes)) setCountryCodes(snapshot.countryCodes as string[]);
      if (snapshot.mode === "single" || snapshot.mode === "set") setMode(snapshot.mode);
      if (Array.isArray(snapshot.channelKeys)) setChannelKeys(snapshot.channelKeys as string[]);
      if (typeof snapshot.category === "string") setCategory(snapshot.category);
      if (typeof snapshot.productName === "string") setProductName(snapshot.productName);
      if (typeof snapshot.model === "string") setModel(snapshot.model);
      if (typeof snapshot.rrpEur === "string") setRrpEur(snapshot.rrpEur);
      if (typeof snapshot.bomRmb === "string") setBomRmb(snapshot.bomRmb);
      if (typeof snapshot.productSetDraftCounter === "number") setProductSetDraftCounter(snapshot.productSetDraftCounter);
      if (Array.isArray(snapshot.productSetDrafts)) setProductSetDrafts(snapshot.productSetDrafts as ProductSetDraft[]);
      if (typeof snapshot.bulkSimulationRrppEur === "string") setBulkSimulationRrppEur(snapshot.bulkSimulationRrppEur);
      if (typeof snapshot.bulkSimulationTargetId === "string") setBulkSimulationTargetId(snapshot.bulkSimulationTargetId);
      if (snapshot.quickRrppInputs && typeof snapshot.quickRrppInputs === "object") setQuickRrppInputs(snapshot.quickRrppInputs as RrppSimulationInputsByRow);
      if (Array.isArray(snapshot.manualPreviewRowOrder)) setManualPreviewRowOrder(snapshot.manualPreviewRowOrder as string[]);
    }
  });

  const suggestedSku = model.trim()
    ? normalizeSku(model)
    : uniqueSuggestedSku(
        buildSuggestedSku(productName),
        data.products.map((product) => product.sku)
      );
  const channelOptions = useMemo(() => {
    const selectedCountries = new Set(countryCodes);
    const selectedCategories =
      mode === "single"
        ? new Set(category ? [category] : [])
        : new Set(
            productSetDrafts
              .map((draft) => draft.category.trim())
              .filter((draftCategory) => draftCategory !== "")
          );
    const options = new Map<string, string>();

    for (const margin of data.operationalMargins) {
      if (
        margin.status !== "ACTIVE" ||
        (selectedCountries.size > 0 && !selectedCountries.has(margin.countryCode)) ||
        (selectedCategories.size > 0 && !selectedCategories.has(margin.category))
      ) {
        continue;
      }

      const key = quickChannelKey(margin.countryCode, margin.retailerName);
      options.set(key, `${margin.countryCode} - ${margin.retailerName}`);
    }

    return [...options.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [category, countryCodes, data.operationalMargins, mode, productSetDrafts]);
  const channelLabelByValue = useMemo(
    () => new Map(channelOptions.map((option) => [option.value, option.label])),
    [channelOptions]
  );
  const bomRmbValue = parseInputNumber(bomRmb);
  const rmbExchangeRate = useMemo(
    () => inferCurrencyExchangeRateToEur(data, "RMB"),
    [data]
  );
  const convertedBomEur =
    bomRmbValue > 0 && rmbExchangeRate > 0
      ? roundCurrency(bomRmbValue / rmbExchangeRate)
      : 0;
  const bomConversionText =
    bomRmbValue <= 0
      ? "EUR BOM auto-calculates from EXR"
      : rmbExchangeRate > 0
        ? `EUR BOM approx. €${convertedBomEur.toFixed(2)} at RMB/EUR ${rmbExchangeRate}`
        : "Add RMB exchange rate in EXR";
  const singlePreview = useMemo(
    () =>
      buildQuickSimulationPreview(data, {
        countryCodes,
        channelKeys,
        category,
        productName,
        model: suggestedSku,
        rrpEur: parseInputNumber(rrpEur),
        bomRmb: bomRmbValue
      }),
    [
      bomRmbValue,
      category,
      channelKeys,
      countryCodes,
      data,
      productName,
      rrpEur,
      suggestedSku
    ]
  );
  const productSetPreview = useMemo(
    () =>
      buildQuickProductSetSimulationPreview(data, {
        countryCodes,
        channelKeys,
        products: productSetDrafts.map((draft) => ({
          id: draft.id,
          category: draft.category,
          productName: draft.productName,
          model: draft.model,
          rrpEur: parseInputNumber(draft.rrpEur),
          simRrppEur: parseOptionalInputNumber(draft.simRrppEur),
          bomRmb: parseInputNumber(draft.bomRmb)
        }))
      }),
    [channelKeys, countryCodes, data, productSetDrafts]
  );
  const preview = mode === "single" ? singlePreview : productSetPreview;
  const productSetPreviewCount = productSetPreview?.products.length ?? 0;
  const productSetBulkTargets = useMemo(
    () => [
      { value: "all", label: "All products" },
      ...productSetDrafts.map((draft, index) => ({
        value: draft.id,
        label: draft.productName.trim() || `Product ${index + 1}`
      }))
    ],
    [productSetDrafts]
  );
  const rawPreviewRows = useMemo(() => {
    if (!preview) {
      return [];
    }
    const mergedInputsByRow = mergeQuickSimulationInputsByRow({
      data: preview.data,
      baseInputsByRow: preview.inputsByRow,
      manualInputsByRow: quickRrppInputs,
      bulkRrppEur:
        mode === "single" && bulkSimulationRrppEur.trim() !== ""
          ? parseInputNumber(bulkSimulationRrppEur)
          : undefined,
      applyBulkRrppEur: mode === "single"
    });

    return buildRrppSimulationRows(
      preview.data,
      mergedInputsByRow,
      {
        countryCode: countryCodes,
        ...(mode === "single" ? { category } : {})
      },
      { lifecycle: "UNLAUNCHED" }
    );
  }, [
    bulkSimulationRrppEur,
    category,
    countryCodes,
    mode,
    preview,
    quickRrppInputs
  ]);
  const previewRows = useMemo(
    () => applyManualPreviewRowOrder(rawPreviewRows, manualPreviewRowOrder),
    [manualPreviewRowOrder, rawPreviewRows]
  );
  const canSave =
    mode === "single" &&
    Boolean(preview) &&
    productName.trim() !== "" &&
    category !== "" &&
    parseInputNumber(rrpEur) > 0 &&
    bomRmbValue > 0 &&
    rmbExchangeRate > 0;
  const previewStatus = useMemo(() => {
    if (previewRows.length === 0) {
      const missing = buildMissingInputLabels({
        mode,
        category,
        productName,
        rrpEur,
        bomRmb,
        rmbExchangeRate,
        productSetDrafts
      });

      return {
        tone: "waiting" as const,
        message:
          missing.length > 0
            ? `Waiting for required inputs: ${missing.join(", ")}`
            : "Waiting for required inputs"
      };
    }

    const countryCount = new Set(previewRows.map((row) => row.countryCode)).size;
    const channelCount = new Set(
      previewRows.map((row) => `${row.countryCode}|${row.channelName}`)
    ).size;
    const productCount = preview?.data.products.length ?? 0;
    const updatedAt = previewUpdatedAt ? ` · ${previewUpdatedAt}` : "";

    return {
      tone: "updated" as const,
      message: `Preview updated from latest inputs · ${productCount} ${
        productCount === 1 ? "product" : "products"
      } · ${countryCount} ${
        countryCount === 1 ? "country" : "countries"
      } · ${channelCount} ${
        channelCount === 1 ? "channel" : "channels"
      } · ${previewRows.length} rows${updatedAt}`
    };
  }, [
    bomRmb,
    category,
    mode,
    preview,
    previewRows,
    previewUpdatedAt,
    productName,
    productSetDrafts,
    rmbExchangeRate,
    rrpEur
  ]);
  const previewFingerprint = useMemo(
    () =>
      rawPreviewRows
        .map(
          (row) =>
            `${row.key}:${row.simulationRrppLocal}:${row.simulationPromoFrontMargin}:${row.simulationKaBuyingMargin}:${row.dealType}:${row.promoFdMargin}`
        )
        .join("|"),
    [rawPreviewRows]
  );

  useEffect(() => {
    if (!openQuickFilter) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (isOutsideDropdownTarget(quickFiltersRef.current, event.target)) {
        setOpenQuickFilter(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [openQuickFilter]);

  useEffect(
    () => () => {
      if (nudgeFeedbackTimeoutRef.current) {
        clearTimeout(nudgeFeedbackTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    setChannelKeys((current) =>
      current.filter((key) => channelLabelByValue.has(key))
    );
  }, [channelLabelByValue]);

  useEffect(() => {
    if (previewRows.length === 0) {
      setPreviewUpdatedAt("");
      return;
    }

    setPreviewUpdatedAt(
      new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      })
    );
  }, [previewFingerprint, previewRows.length]);

  useEffect(() => {
    if (
      bulkSimulationTargetId !== "all" &&
      !productSetDrafts.some((draft) => draft.id === bulkSimulationTargetId)
    ) {
      setBulkSimulationTargetId("all");
    }
  }, [bulkSimulationTargetId, productSetDrafts]);

  function switchMode(nextMode: QuickSimulationMode) {
    setMode(nextMode);
    setBulkSimulationRrppEur("");
    setQuickRrppInputs({});
    setManualPreviewRowOrder([]);
    setIsAdjustingPreviewOrder(false);
    setDraggedPreviewRowKey(null);
    setPreviewDragOverRowKey(null);
    setNudgeFeedback(null);
    setStatus(null);
  }

  function addProductSetDraft() {
    const nextId = `draft-${productSetDraftCounter}`;
    setProductSetDraftCounter((current) => current + 1);
    setProductSetDrafts((current) => [
      ...current,
      createProductSetDraft(nextId, categoryOptions[0] ?? "")
    ]);
  }

  function updateProductSetDraft(
    id: string,
    field: keyof Omit<ProductSetDraft, "id">,
    value: string
  ) {
    setProductSetDrafts((current) =>
      current.map((draft) =>
        draft.id === id
          ? {
              ...draft,
              [field]: value
            }
          : draft
      )
    );
    setQuickRrppInputs({});
  }

  function removeProductSetDraft(id: string) {
    setProductSetDrafts((current) => {
      const next = current.filter((draft) => draft.id !== id);
      return next.length > 0
        ? next
        : [createProductSetDraft("draft-1", categoryOptions[0] ?? "")];
    });
    setQuickRrppInputs({});
  }

  function updateQuickRrppInput(
    key: string,
    field:
      | "rrppLocal"
      | "kaBuyingMargin"
      | "actualFrontMargin"
      | "promoFrontMargin"
      | "dealType"
      | "promoFdMargin",
    value: string
  ) {
    setQuickRrppInputs((current) => {
      const nextInput = {
        ...current[key],
        [field]: value
      };

      if (field === "rrppLocal") {
        delete nextInput.rrppEur;
      }

      return {
        ...current,
        [key]: nextInput
      };
    });
  }

  function updateBulkSimulationRrppEur(value: string) {
    setBulkSimulationRrppEur(value);
    setQuickRrppInputs((current) => {
      if (previewRows.length === 0) {
        return current;
      }

      const next = { ...current };
      const hasBulkValue = value.trim() !== "";
      const bulkRrppEurValue = parseInputNumber(value);

      for (const row of previewRows) {
        const existing = { ...(next[row.key] ?? {}) };

        if (!hasBulkValue) {
          delete existing.rrppLocal;
          delete existing.rrppEur;
        } else {
          existing.rrppLocal = preview
            ? convertEurToLocalCurrency(
                preview.data,
                row.countryCode,
                bulkRrppEurValue
              )
            : bulkRrppEurValue;
          delete existing.rrppEur;
        }

        if (Object.keys(existing).length === 0) {
          delete next[row.key];
        } else {
          next[row.key] = existing;
        }
      }

      return next;
    });
  }

  function applyProductSetBulkSimulationRrppEur() {
    if (mode !== "set") {
      updateBulkSimulationRrppEur(bulkSimulationRrppEur);
      return;
    }

    const targetDraftIds =
      bulkSimulationTargetId === "all"
        ? productSetDrafts.map((draft) => draft.id)
        : [bulkSimulationTargetId];

    setProductSetDrafts((current) =>
      current.map((draft) =>
        targetDraftIds.includes(draft.id)
          ? {
              ...draft,
              simRrppEur: bulkSimulationRrppEur
            }
          : draft
      )
    );
    clearProductSetRrppOverrides(targetDraftIds);
  }

  function movePreviewRow(rowKey: string, direction: "up" | "down") {
    setManualPreviewRowOrder((current) =>
      moveManualPreviewRowOrder(rawPreviewRows, current, rowKey, direction)
    );
    showNudgeFeedback(rowKey, direction);
  }

  function showNudgeFeedback(rowKey: string, direction: "up" | "down") {
    if (nudgeFeedbackTimeoutRef.current) {
      clearTimeout(nudgeFeedbackTimeoutRef.current);
    }

    setNudgeFeedback({ rowKey, direction });
    nudgeFeedbackTimeoutRef.current = setTimeout(() => {
      setNudgeFeedback(null);
      nudgeFeedbackTimeoutRef.current = null;
    }, 650);
  }

  function previewDraggedRowOver(targetRowKey: string) {
    if (!draggedPreviewRowKey || draggedPreviewRowKey === targetRowKey) {
      setPreviewDragOverRowKey(null);
      return;
    }

    setPreviewDragOverRowKey(targetRowKey);
    setManualPreviewRowOrder((current) =>
      dropManualPreviewRowOrder(
        rawPreviewRows,
        current,
        draggedPreviewRowKey,
        targetRowKey
      )
    );
  }

  function finishPreviewRowDrag() {
    setDraggedPreviewRowKey(null);
    setPreviewDragOverRowKey(null);
  }

  function clearProductSetRrppOverrides(targetDraftIds: string[]) {
    const targetProductIds = new Set(
      (productSetPreview?.products ?? [])
        .filter((product) => targetDraftIds.includes(product.draftId))
        .map((product) => product.productId)
    );

    if (targetProductIds.size === 0) {
      return;
    }

    setQuickRrppInputs((current) => {
      const next: RrppSimulationInputsByRow = {};

      for (const [key, input] of Object.entries(current)) {
        const productId = key.split("|")[1] ?? "";
        if (!targetProductIds.has(productId)) {
          next[key] = input;
          continue;
        }

        const nextInput = { ...input };
        delete nextInput.rrppLocal;
        delete nextInput.rrppEur;

        if (Object.keys(nextInput).length > 0) {
          next[key] = nextInput;
        }
      }

      return next;
    });
  }

  async function saveToFormalList() {
    if (!canAddToFormalList || !canSave) {
      return;
    }

    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch("/api/simulation/quick-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryCodes,
          category,
          productName,
          model,
          rrpEur: parseInputNumber(rrpEur),
          bomRmb: bomRmbValue
        })
      });
      const result = (await response.json()) as SaveResult | { message: string };

      if (!response.ok || !("status" in result)) {
        throw new Error(result.message || "Save failed.");
      }

      setStatus({
        tone: "success",
        message: `${result.sku} saved. Master Data archive is ready.`,
        exportUrl: result.exportUrl ?? undefined,
        archiveUrl: result.archive?.downloadUrl ?? undefined,
        driveUrl: result.archive?.driveUrl,
        driveStatus: result.archive?.driveStatus
      });
      void autosave.clearAutosaveDraft();
      router.refresh();
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Save failed."
      });
    } finally {
      setSaving(false);
    }
  }

  async function exportPreviewWorkbook() {
    if (previewRows.length === 0 || exporting) {
      return;
    }

    setExporting(true);
    setStatus(null);

    try {
      const response = await fetch("/api/simulation/quick-export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rows: previewRows
        })
      });

      if (!response.ok) {
        const message = await readJsonError(
          response,
          "Unable to export simulation workbook."
        );
        throw new Error(message);
      }

      const blob = await response.blob();
      const href = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download =
        fileNameFromDisposition(response.headers.get("Content-Disposition")) ??
        `Quick Simulation ${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(href);
      setStatus({
        tone: "neutral",
        message: "Simulation workbook downloaded."
      });
    } catch (error) {
      setStatus({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to export simulation workbook."
      });
    } finally {
      setExporting(false);
    }
  }

  function discardDraft() {
    if (mode === "single") {
      setProductName("");
      setModel("");
      setRrpEur("");
      setBomRmb("");
    } else {
      setProductSetDraftCounter(2);
      setProductSetDrafts([
        createProductSetDraft("draft-1", categoryOptions[0] ?? "")
      ]);
    }
    setBulkSimulationRrppEur("");
    setQuickRrppInputs({});
    setManualPreviewRowOrder([]);
    setIsAdjustingPreviewOrder(false);
    setDraggedPreviewRowKey(null);
    setPreviewDragOverRowKey(null);
    setNudgeFeedback(null);
    setStatus({
      tone: "neutral",
      message: "Draft discarded. No master data was saved."
    });
    window.setTimeout(() => void autosave.clearAutosaveDraft(), 0);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-950">
            Quick New Product Simulation
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {canAddToFormalList
              ? "Master Data creation flow: draft a product, preview country/channel rows, then publish it to the shared product list."
              : "Draft a product and preview country/channel rows for simulation only."}
          </p>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
          <span className="font-semibold text-slate-500">
            {mode === "single" ? "Model" : "Products"}
          </span>
          <span className="ml-2 font-semibold text-slate-950">
            {mode === "single" ? suggestedSku : productSetPreviewCount}
          </span>
        </div>
      </div>
      <div className="mt-3">
        <AutosaveStatus
          status={autosave.status}
          lastSavedAt={autosave.lastSavedAt}
          hasConflict={Boolean(autosave.conflictDraft)}
          onLoadNewest={autosave.loadNewestSavedDraft}
          onKeepMyChanges={autosave.keepMyChanges}
        />
      </div>

      <div className="mt-3 inline-flex rounded-md border border-slate-200 bg-slate-50 p-1 text-xs font-semibold">
        <button
          className={`rounded px-3 py-1.5 ${
            mode === "single"
              ? "bg-slate-950 text-white shadow-sm"
              : "text-slate-600 hover:bg-white"
          }`}
          type="button"
          onClick={() => switchMode("single")}
        >
          Single product
        </button>
        <button
          className={`rounded px-3 py-1.5 ${
            mode === "set"
              ? "bg-slate-950 text-white shadow-sm"
              : "text-slate-600 hover:bg-white"
          }`}
          type="button"
          onClick={() => switchMode("set")}
        >
          Product set
        </button>
      </div>

      <div
        ref={quickFiltersRef}
        data-layout={mode === "single" ? "quick-single-compact" : "quick-set"}
        className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[minmax(120px,0.75fr)_minmax(128px,0.8fr)_minmax(120px,0.75fr)_minmax(160px,1.05fr)_minmax(140px,0.9fr)_minmax(105px,0.65fr)_minmax(105px,0.65fr)]"
      >
        <CompactField label="Country">
          <QuickMultiSelect
            field="quick-country"
            open={openQuickFilter === "country"}
            value={countryCodes}
            options={countryOptions.map((country) => country.code)}
            formatOption={(code) => {
              const country = countryOptions.find((item) => item.code === code);
              return country ? `${country.code} - ${country.name}` : code;
            }}
            onOpenChange={(open) => setOpenQuickFilter(open ? "country" : null)}
            onChange={setCountryCodes}
          />
        </CompactField>
        <CompactField label="Channel / Retailer">
          <QuickMultiSelect
            field="quick-channel"
            open={openQuickFilter === "channel"}
            value={channelKeys}
            options={channelOptions.map((option) => option.value)}
            formatOption={(value) => channelLabelByValue.get(value) ?? value}
            onOpenChange={(open) => setOpenQuickFilter(open ? "channel" : null)}
            onChange={setChannelKeys}
          />
        </CompactField>
        {mode === "single" ? (
          <>
            <CompactField label="Category">
              <QuickSingleSelect
                field="quick-category"
                open={openQuickFilter === "category"}
                value={category}
                options={categoryOptions}
                onOpenChange={(open) =>
                  setOpenQuickFilter(open ? "category" : null)
                }
                onChange={setCategory}
              />
            </CompactField>
            <CompactField label="Product name">
              <input
                className={compactControlClass}
                value={productName}
                onChange={(event) => setProductName(event.target.value)}
                placeholder="New product"
              />
            </CompactField>
            <CompactField label="Model / SKU">
              <input
                className={compactControlClass}
                value={model}
                onChange={(event) => setModel(event.target.value)}
                placeholder="Auto"
              />
            </CompactField>
            <CompactField label="RRP EUR">
              <input
                className={compactControlClass}
                inputMode="decimal"
                min="0"
                type="number"
                value={rrpEur}
                onChange={(event) => setRrpEur(event.target.value)}
                placeholder="0.00"
              />
            </CompactField>
            <CompactField label="BOM RMB" hint={bomConversionText}>
              <input
                className={compactControlClass}
                inputMode="decimal"
                min="0"
                type="number"
                value={bomRmb}
                onChange={(event) => setBomRmb(event.target.value)}
                placeholder="0.00"
              />
            </CompactField>
          </>
        ) : null}
      </div>

      {mode === "set" ? (
        <div className="mt-3 overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-full border-collapse text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="border-b border-slate-200 px-2 py-2 font-semibold">
                  Category
                </th>
                <th className="border-b border-slate-200 px-2 py-2 font-semibold">
                  Product name
                </th>
                <th className="border-b border-slate-200 px-2 py-2 font-semibold">
                  Model / SKU
                </th>
                <th className="border-b border-slate-200 px-2 py-2 font-semibold">
                  RRP EUR
                </th>
                <th className="border-b border-slate-200 px-2 py-2 font-semibold">
                  Sim RRPP EUR
                </th>
                <th className="border-b border-slate-200 px-2 py-2 font-semibold">
                  BOM RMB
                </th>
                <th className="border-b border-slate-200 px-2 py-2 font-semibold">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {productSetDrafts.map((draft) => (
                <tr key={draft.id} className="border-b border-slate-100 last:border-0">
                  <td className="min-w-36 px-2 py-2">
                    <select
                      className={`${compactControlClass} h-8 text-xs`}
                      value={draft.category}
                      onChange={(event) =>
                        updateProductSetDraft(
                          draft.id,
                          "category",
                          event.target.value
                        )
                      }
                    >
                      {categoryOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="min-w-56 px-2 py-2">
                    <input
                      className={`${compactControlClass} h-8 text-xs`}
                      value={draft.productName}
                      onChange={(event) =>
                        updateProductSetDraft(
                          draft.id,
                          "productName",
                          event.target.value
                        )
                      }
                      placeholder="New product"
                    />
                  </td>
                  <td className="min-w-40 px-2 py-2">
                    <input
                      className={`${compactControlClass} h-8 text-xs`}
                      value={draft.model}
                      onChange={(event) =>
                        updateProductSetDraft(draft.id, "model", event.target.value)
                      }
                      placeholder="Auto"
                    />
                  </td>
                  <td className="min-w-28 px-2 py-2">
                    <input
                      className={`${compactControlClass} h-8 text-xs`}
                      inputMode="decimal"
                      min="0"
                      type="number"
                      value={draft.rrpEur}
                      onChange={(event) =>
                        updateProductSetDraft(draft.id, "rrpEur", event.target.value)
                      }
                      placeholder="0.00"
                    />
                  </td>
                  <td className="min-w-28 px-2 py-2">
                    <input
                      className={`${compactControlClass} h-8 text-xs`}
                      inputMode="decimal"
                      min="0"
                      type="number"
                      value={draft.simRrppEur}
                      onChange={(event) =>
                        updateProductSetDraft(
                          draft.id,
                          "simRrppEur",
                          event.target.value
                        )
                      }
                      placeholder="Same as RRP"
                    />
                  </td>
                  <td className="min-w-28 px-2 py-2">
                    <input
                      className={`${compactControlClass} h-8 text-xs`}
                      inputMode="decimal"
                      min="0"
                      type="number"
                      value={draft.bomRmb}
                      onChange={(event) =>
                        updateProductSetDraft(draft.id, "bomRmb", event.target.value)
                      }
                      placeholder="0.00"
                    />
                  </td>
                  <td className="w-24 px-2 py-2">
                    <button
                      className="rounded-md border border-slate-200 px-2 py-1.5 font-semibold text-slate-600 hover:bg-slate-50"
                      type="button"
                      onClick={() => removeProductSetDraft(draft.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between gap-2 bg-slate-50 px-2 py-2">
            <button
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              type="button"
              onClick={addProductSetDraft}
            >
              Add product
            </button>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Preview only
            </span>
          </div>
        </div>
      ) : null}

      <div
        className={`mt-3 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-xs ${
          previewStatus.tone === "updated"
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : "border-amber-200 bg-amber-50 text-amber-900"
        }`}
      >
        <span className="font-semibold uppercase tracking-wide">
          Preview status
        </span>
        <span className="font-medium">{previewStatus.message}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {canAddToFormalList && mode === "single" ? (
            <button
              className="rounded-md bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={!canSave || saving}
              type="button"
              onClick={saveToFormalList}
            >
              {saving ? "Saving..." : "Create Master Data product"}
            </button>
          ) : null}
          {mode === "set" ? (
            <span className="rounded-md bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
              Product set preview
            </span>
          ) : null}
          {mode === "set" && previewRows.length > 0 ? (
            <>
              <button
                className={`rounded-md border px-3 py-2 text-xs font-semibold shadow-sm transition ${
                  isAdjustingPreviewOrder
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
                type="button"
                onClick={() =>
                  setIsAdjustingPreviewOrder((current) => !current)
                }
              >
                {isAdjustingPreviewOrder ? "Done" : "Adjust order"}
              </button>
              <button
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                disabled={manualPreviewRowOrder.length === 0}
                type="button"
                onClick={() => setManualPreviewRowOrder([])}
              >
                Reset order
              </button>
              {isAdjustingPreviewOrder ? (
                <span className="rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800">
                  Drag a row handle; the order updates live.
                </span>
              ) : null}
            </>
          ) : null}
          <button
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            disabled={exporting || previewRows.length === 0}
            type="button"
            onClick={exportPreviewWorkbook}
          >
            {exporting ? "Preparing Excel..." : "Export Excel"}
          </button>
          <button
            className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
            type="button"
            onClick={discardDraft}
          >
            Discard draft
          </button>
          {status ? (
            <span
              className={`rounded-md px-3 py-2 text-xs font-semibold ${
                status.tone === "success"
                  ? "bg-emerald-50 text-emerald-800"
                  : status.tone === "error"
                    ? "bg-rose-50 text-rose-800"
                    : "bg-slate-100 text-slate-600"
              }`}
            >
              {status.message}
            </span>
          ) : null}
          {status?.exportUrl ? (
            <a
              className="rounded-md border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800"
              href={status.archiveUrl ?? status.exportUrl}
            >
              Download archive workbook
            </a>
          ) : null}
          {status?.driveStatus === "UPLOADED" && status.driveUrl ? (
            <a
              className="rounded-md border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-sky-800"
              href={status.driveUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open Drive archive
            </a>
          ) : status?.driveStatus === "FAILED" ? (
            <span className="rounded-md bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              Drive upload failed. Local archive kept.
            </span>
          ) : status?.driveStatus === "NOT_CONFIGURED" ? (
            <span className="rounded-md bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
              Drive upload pending configuration.
            </span>
          ) : null}
        </div>
        {mode === "set" || preview ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-100 bg-amber-50/50 px-2.5 py-1.5">
            <label
              className="text-[10px] font-semibold uppercase tracking-wide text-slate-500"
              htmlFor="quick-bulk-sim-rrpp-eur"
            >
              {mode === "set" ? "Apply Sim RRPP EUR" : "Bulk Sim RRPP EUR"}
            </label>
            <input
              id="quick-bulk-sim-rrpp-eur"
              aria-label={
                mode === "set"
                  ? "Apply simulation RRPP EUR"
                  : "Bulk simulation RRPP EUR"
              }
              className={`${compactControlClass} h-8 w-32 text-xs`}
              inputMode="decimal"
              min="0"
              type="number"
              value={bulkSimulationRrppEur}
              onChange={(event) => {
                if (mode === "set") {
                  setBulkSimulationRrppEur(event.target.value);
                } else {
                  updateBulkSimulationRrppEur(event.target.value);
                }
              }}
              placeholder="0.00"
            />
            {mode === "set" ? (
              <>
                <select
                  aria-label="Apply simulation RRPP target"
                  className={`${compactControlClass} h-8 w-36 text-xs`}
                  value={bulkSimulationTargetId}
                  onChange={(event) =>
                    setBulkSimulationTargetId(event.target.value)
                  }
                >
                  {productSetBulkTargets.map((target) => (
                    <option key={target.value} value={target.value}>
                      {target.label}
                    </option>
                  ))}
                </select>
                <button
                  className="h-8 rounded-md bg-slate-950 px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  disabled={bulkSimulationRrppEur.trim() === ""}
                  type="button"
                  onClick={applyProductSetBulkSimulationRrppEur}
                >
                  Apply
                </button>
              </>
            ) : null}
            <span className="text-[10px] font-medium text-slate-500">
              {mode === "set"
                ? "Writes the selected product RRPP and converts by row"
                : "Converts into each row's local currency"}
            </span>
          </div>
        ) : null}
      </div>

      {preview ? (
        <div className="mt-3">
          <NormalWideTable
            mode="simulation"
            rows={previewRows}
            onRrppInputChange={updateQuickRrppInput}
            getSimulationRowAttributes={
              mode === "set" && isAdjustingPreviewOrder
                ? (row) => {
                    const isDragging = draggedPreviewRowKey === row.key;
                    const isDropTarget =
                      previewDragOverRowKey === row.key &&
                      draggedPreviewRowKey !== row.key;
                    const isNudgeFeedback = nudgeFeedback?.rowKey === row.key;
                    const rowLabel = `${row.countryCode} ${row.channelName} ${row.productName}`;

                    return {
                      draggable: true,
                      className: [
                        "group/order-row cursor-grab transition-colors duration-150 active:cursor-grabbing [&>td]:transition-colors [&>td]:duration-150",
                        isDragging
                          ? "opacity-70 [&>td]:bg-sky-50 [&>td]:shadow-[inset_0_0_0_2px_rgba(14,165,233,0.35)]"
                          : "",
                        isDropTarget
                          ? "[&>td]:bg-emerald-50 [&>td]:shadow-[inset_0_3px_0_#10b981]"
                          : "",
                        isNudgeFeedback
                          ? "[&>td]:bg-sky-50 [&>td]:shadow-[inset_0_0_0_1px_rgba(14,165,233,0.30)]"
                          : ""
                      ]
                        .filter(Boolean)
                        .join(" "),
                      onDragEnd: finishPreviewRowDrag,
                      onDragEnter: (event) => {
                        event.preventDefault();
                        previewDraggedRowOver(row.key);
                      },
                      onDragOver: (event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                      },
                      onDragStart: (event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", rowLabel);
                        setDraggedPreviewRowKey(row.key);
                        setPreviewDragOverRowKey(null);
                      },
                      onDrop: (event) => {
                        event.preventDefault();
                        finishPreviewRowDrag();
                      }
                    };
                  }
                : undefined
            }
            renderSimulationOrderControls={
              mode === "set" && isAdjustingPreviewOrder
                ? (row, rowIndex, rowCount) => (
                    <ManualOrderControls
                      isDragging={draggedPreviewRowKey === row.key}
                      isDropTarget={
                        previewDragOverRowKey === row.key &&
                        draggedPreviewRowKey !== row.key
                      }
                      nudgeFeedbackDirection={
                        nudgeFeedback?.rowKey === row.key
                          ? nudgeFeedback.direction
                          : null
                      }
                      rowCount={rowCount}
                      rowIndex={rowIndex}
                      rowLabel={`${row.countryCode} ${row.channelName} ${row.productName}`}
                      onDragEnd={finishPreviewRowDrag}
                      onDragStart={() => setDraggedPreviewRowKey(row.key)}
                      onMoveDown={() => movePreviewRow(row.key, "down")}
                      onMoveUp={() => movePreviewRow(row.key, "up")}
                    />
                  )
                : undefined
            }
          />
        </div>
      ) : null}
    </section>
  );
}

export function ManualOrderControls({
  isDragging,
  isDropTarget,
  nudgeFeedbackDirection,
  rowCount,
  rowIndex,
  rowLabel,
  onDragEnd,
  onDragStart,
  onMoveDown,
  onMoveUp
}: {
  isDragging: boolean;
  isDropTarget: boolean;
  nudgeFeedbackDirection?: "up" | "down" | null;
  rowCount: number;
  rowIndex: number;
  rowLabel: string;
  onDragEnd: () => void;
  onDragStart: () => void;
  onMoveDown: () => void;
  onMoveUp: () => void;
}) {
  const upFeedback = nudgeFeedbackDirection === "up";
  const downFeedback = nudgeFeedbackDirection === "down";
  const nudgeButtonClass =
    "flex h-5 w-5 items-center justify-center rounded border text-slate-600 transition disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300";
  const feedbackClass = "border-sky-300 bg-sky-50 text-sky-700 ring-1 ring-sky-200";
  const idleClass = "border-slate-300 bg-white hover:bg-slate-50";

  return (
    <div className="grid justify-items-center gap-1">
      <button
        aria-label={`Drag ${rowLabel}`}
        className={`flex h-7 w-8 items-center justify-center rounded-md border text-slate-600 shadow-sm transition ${
          isDragging
            ? "border-sky-300 bg-sky-50 text-sky-700"
            : isDropTarget
              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
              : "border-slate-300 bg-white hover:bg-slate-50"
        }`}
        draggable
        title="Drag row"
        type="button"
        onDragEnd={onDragEnd}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", rowLabel);
          onDragStart();
        }}
      >
        <span aria-hidden="true" className="grid gap-0.5">
          <span className="block h-0.5 w-4 rounded bg-current" />
          <span className="block h-0.5 w-4 rounded bg-current" />
          <span className="block h-0.5 w-4 rounded bg-current" />
        </span>
      </button>
      <div className="flex gap-1">
        <button
          aria-label={`Move ${rowLabel} up`}
          className={`${nudgeButtonClass} ${upFeedback ? feedbackClass : idleClass}`}
          data-nudge-feedback={upFeedback ? "up" : undefined}
          disabled={rowIndex === 0}
          title="Move up"
          type="button"
          onClick={onMoveUp}
        >
          <ArrowIcon direction="up" />
        </button>
        <button
          aria-label={`Move ${rowLabel} down`}
          className={`${nudgeButtonClass} ${downFeedback ? feedbackClass : idleClass}`}
          data-nudge-feedback={downFeedback ? "down" : undefined}
          disabled={rowIndex >= rowCount - 1}
          title="Move down"
          type="button"
          onClick={onMoveDown}
        >
          <ArrowIcon direction="down" />
        </button>
      </div>
    </div>
  );
}

function ArrowIcon({ direction }: { direction: "up" | "down" }) {
  return (
    <svg
      aria-hidden="true"
      className="h-3 w-3"
      data-order-arrow={direction}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 16 16"
    >
      {direction === "up" ? (
        <>
          <path d="M8 13V3" />
          <path d="M4.5 6.5 8 3l3.5 3.5" />
        </>
      ) : (
        <>
          <path d="M8 3v10" />
          <path d="M4.5 9.5 8 13l3.5-3.5" />
        </>
      )}
    </svg>
  );
}

function QuickMultiSelect({
  field,
  open,
  value,
  options,
  formatOption,
  onOpenChange,
  onChange
}: {
  field: string;
  open: boolean;
  value: string[];
  options: string[];
  formatOption?: (option: string) => string;
  onOpenChange: (open: boolean) => void;
  onChange: (value: string[]) => void;
}) {
  const selected = value.filter((option) => options.includes(option));
  const summary =
    selected.length === 0
      ? "All"
      : selected.length === 1
        ? formatOption
          ? formatOption(selected[0])
          : selected[0]
        : `${selected.length} selected`;

  function toggleOption(option: string) {
    onChange(
      selected.includes(option)
        ? selected.filter((selectedOption) => selectedOption !== option)
        : [...selected, option]
    );
  }

  return (
    <details className="relative" open={open}>
      <summary
        aria-controls={`${field}-options`}
        aria-expanded={open}
        className={quickSelectTriggerClass}
        onClick={(event) => {
          event.preventDefault();
          onOpenChange(!open);
        }}
      >
        <span className="truncate">{summary}</span>
        <span className="text-[10px] text-slate-400" aria-hidden="true">
          v
        </span>
      </summary>
      <div className={quickSelectPanelClass} id={`${field}-options`}>
        <div className="mb-1 flex items-center justify-between gap-2 border-b border-slate-100 pb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {selected.length === 0 ? "All" : `${selected.length} selected`}
          </span>
          {selected.length > 0 ? (
            <button
              className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-100"
              type="button"
              onClick={() => onChange([])}
            >
              Clear
            </button>
          ) : null}
        </div>
        <label className={quickOptionClass}>
          <input
            checked={selected.length === 0}
            className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900"
            type="checkbox"
            onChange={() => onChange([])}
          />
          <span>All</span>
        </label>
        <div className="grid max-h-56 gap-1 overflow-auto border-t border-slate-100 pt-1">
          {options.map((option) => (
            <label
              key={option}
              className={quickOptionClass}
            >
              <input
                checked={selected.includes(option)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900"
                type="checkbox"
                onChange={() => toggleOption(option)}
              />
              <span className="truncate">
                {formatOption ? formatOption(option) : option}
              </span>
            </label>
          ))}
        </div>
      </div>
    </details>
  );
}

function QuickSingleSelect({
  field,
  open,
  value,
  options,
  onOpenChange,
  onChange
}: {
  field: string;
  open: boolean;
  value: string;
  options: string[];
  onOpenChange: (open: boolean) => void;
  onChange: (value: string) => void;
}) {
  return (
    <details className="relative" open={open}>
      <summary
        aria-controls={`${field}-options`}
        aria-expanded={open}
        className={quickSelectTriggerClass}
        onClick={(event) => {
          event.preventDefault();
          onOpenChange(!open);
        }}
      >
        <span className="truncate">{value || "Select"}</span>
        <span className="text-[10px] text-slate-400" aria-hidden="true">
          v
        </span>
      </summary>
      <div className={quickSelectPanelClass} id={`${field}-options`}>
        <div className="mb-1 border-b border-slate-100 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Select one
        </div>
        <div className="grid max-h-56 gap-1 overflow-auto">
          {options.length === 0 ? (
            <span className="px-1 py-1 text-slate-400">No options</span>
          ) : (
            options.map((option) => (
              <label key={option} className={quickOptionClass}>
                <input
                  checked={value === option}
                  className="h-3.5 w-3.5 border-slate-300 text-slate-900"
                  type="radio"
                  onChange={() => {
                    onChange(option);
                    onOpenChange(false);
                  }}
                />
                <span className="truncate">{option}</span>
              </label>
            ))
          )}
        </div>
      </div>
    </details>
  );
}

function CompactField({
  label,
  hint,
  children
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-1 text-xs font-semibold uppercase text-slate-500">
      <span className="tracking-wide">{label}</span>
      {children}
      {hint ? (
        <span className="min-h-4 text-[10px] font-medium normal-case text-slate-500">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

function createProductSetDraft(id: string, category: string): ProductSetDraft {
  return {
    id,
    category,
    productName: "",
    model: "",
    rrpEur: "",
    simRrppEur: "",
    bomRmb: ""
  };
}

function buildMissingInputLabels({
  mode,
  category,
  productName,
  rrpEur,
  bomRmb,
  rmbExchangeRate,
  productSetDrafts
}: {
  mode: QuickSimulationMode;
  category: string;
  productName: string;
  rrpEur: string;
  bomRmb: string;
  rmbExchangeRate: number;
  productSetDrafts: ProductSetDraft[];
}) {
  const missing = new Set<string>();

  if (mode === "single") {
    if (category.trim() === "") {
      missing.add("Category");
    }
    if (productName.trim() === "") {
      missing.add("Product name");
    }
    if (parseInputNumber(rrpEur) <= 0) {
      missing.add("RRP EUR");
    }
    if (parseInputNumber(bomRmb) <= 0) {
      missing.add("BOM RMB");
    } else if (rmbExchangeRate <= 0) {
      missing.add("RMB EXR");
    }
    return [...missing];
  }

  const completeProductCount = productSetDrafts.filter((draft) =>
    isCompleteProductSetDraft(draft, rmbExchangeRate)
  ).length;
  if (completeProductCount === 0) {
    missing.add("at least one complete product");
  }

  const firstIncompleteIndex = productSetDrafts.findIndex(
    (draft) => !isCompleteProductSetDraft(draft, rmbExchangeRate)
  );
  if (firstIncompleteIndex >= 0) {
    const draft = productSetDrafts[firstIncompleteIndex];
    const productMissing: string[] = [];
    if (draft.category.trim() === "") {
      productMissing.push("Category");
    }
    if (draft.productName.trim() === "") {
      productMissing.push("Product name");
    }
    if (parseInputNumber(draft.rrpEur) <= 0) {
      productMissing.push("RRP EUR");
    }
    if (parseInputNumber(draft.bomRmb) <= 0) {
      productMissing.push("BOM RMB");
    } else if (rmbExchangeRate <= 0) {
      productMissing.push("RMB EXR");
    }
    if (productMissing.length > 0) {
      missing.add(
        `Product ${firstIncompleteIndex + 1} missing ${productMissing.join("/")}`
      );
    }
  }

  return [...missing];
}

function isCompleteProductSetDraft(
  draft: ProductSetDraft,
  rmbExchangeRate: number
) {
  return (
    draft.category.trim() !== "" &&
    draft.productName.trim() !== "" &&
    parseInputNumber(draft.rrpEur) > 0 &&
    parseInputNumber(draft.bomRmb) > 0 &&
    rmbExchangeRate > 0
  );
}

function parseInputNumber(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseOptionalInputNumber(value: string) {
  const parsed = parseInputNumber(value);
  return parsed > 0 ? parsed : undefined;
}

async function readJsonError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { message?: string };
    return payload.message ?? fallback;
  } catch {
    return fallback;
  }
}

function fileNameFromDisposition(value: string | null) {
  if (!value) {
    return null;
  }

  const match = /filename="([^"]+)"/.exec(value);
  return match?.[1] ?? null;
}

const compactControlClass =
  "h-9 min-w-0 rounded-md border border-slate-300 bg-white px-2 text-sm font-semibold normal-case text-slate-900 outline-none transition hover:border-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-200";

const quickSelectTriggerClass = `${compactControlClass} flex cursor-pointer list-none items-center justify-between gap-2`;

const quickSelectPanelClass =
  "absolute z-[120] mt-1 w-full min-w-56 rounded-md border border-slate-200 bg-white p-2 text-[11px] font-medium normal-case text-slate-800 shadow-lg";

const quickOptionClass =
  "flex cursor-pointer items-center gap-2 rounded px-1.5 py-1.5 font-medium text-slate-800 hover:bg-slate-50";
