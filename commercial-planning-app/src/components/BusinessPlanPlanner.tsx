"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  buildBusinessPlanProfileAssumption,
  buildBusinessPlanBaseRows,
  buildBusinessPlanLines,
  businessPlanChannelProfileKey,
  businessPlanChannelProfileLabel,
  getBusinessPlanMonths,
  monthLabel,
  summarizeBusinessPlan,
  temporaryAssumptionRowKey,
  type BusinessPlanTemporaryAssumption,
  type BusinessPlanChannelProductOverrideDraft,
  type BusinessPlanChannelProfileDraft,
  type BusinessPlanDraftLine,
  type BusinessPlanGroupMetric,
  type BusinessPlanLine,
  type BusinessPlanMetric
} from "@/lib/calculations/businessPlan";
import { formatMoney, formatPercent } from "@/lib/format";
import { BusinessPlanAchievementPanel } from "@/components/BusinessPlanAchievementPanel";
import type {
  BusinessPlanApprovalQueueItem,
  BusinessPlanActualEntryOption,
  BusinessPlanChannelProfileOption,
  BusinessPlanEntryOption,
  BusinessPlanYearStatusOption,
  PromotionPlanStatus,
  ReferenceData
} from "@/lib/types";
import { businessPlanDraftLinesFromEntries } from "@/lib/businessPlanPersistence";
import { AutosaveStatus } from "./AutosaveStatus";
import { useAutosaveDraft } from "./useAutosaveDraft";

type ImportResult = {
  status: "success" | "error";
  message: string;
  imported?: number;
  skipped?: number;
  errors?: Array<{ sheetName: string; rowNumber: number; message: string }>;
  channelProfiles?: BusinessPlanClientChannelProfile[];
  rows?: BusinessPlanDraftLine[];
};

type SaveResult = {
  status?: "success" | "error";
  message?: string;
  saved?: number;
  deleted?: number;
  skipped?: number;
  entries?: BusinessPlanEntryOption[];
  profiles?: BusinessPlanChannelProfileOption[];
};

type StatusActionResult = {
  status?: "success" | "error";
  message?: string;
  updated?: number;
  skipped?: number;
  errors?: Array<{ message: string }>;
};

type InputEditorState = {
  year: string;
  month: string;
  countryCode: string;
  channelKey: string;
  productKey: string;
};

type InputCellDraft = {
  promoPriceLocal: string;
  siUnits: string;
  soUnits: string;
  promoDiscountPercent: string;
};

type InputEditorSaveLine = BusinessPlanDraftLine & {
  isEmpty: boolean;
};

type BusinessPlanClientChannelProfile = BusinessPlanChannelProfileDraft & {
  productOverrides: BusinessPlanChannelProductOverrideDraft[];
};

type DataInputFormState = {
  countryCode: string;
  channelName: string;
  fdName: string;
  incoterms: string;
  month: string;
  productKey: string;
  promoPriceLocal: string;
  promoDiscountPercent: string;
  siUnits: string;
  soUnits: string;
  kaBuyingMargin: string;
  kaFrontMargin: string;
  kaBackMargin: string;
  fdMargin: string;
};

type BusinessPlanBaseRow = ReturnType<typeof buildBusinessPlanBaseRows>[number];

type MetricDisplayMode = "units" | "value";

type TargetAnalysisDimension = "product" | "channel";

type TimeDimension = "MONTHLY" | "QUARTERLY";

type BusinessPlanViewMode = "PLAN" | "ACHIEVEMENT";

type TimePeriodFilter = "ALL" | `MONTH_${number}` | "Q1" | "Q2" | "Q3" | "Q4";

type CategoryMixSegment = {
  key: string;
  label: string;
  value: number;
  share: number;
  color: string;
};

type TargetMixSegment = BusinessPlanGroupMetric & {
  value: number;
  share: number;
  color: string;
};

type TargetDrilldownRow = TargetMixSegment & {
  secondaryLabel?: string;
};

type BusinessPlanPlannerProps = {
  approvalQueue: BusinessPlanApprovalQueueItem[];
  canApprovePlan: boolean;
  canChangeCountry: boolean;
  canFinalApprovePlan: boolean;
  canFirstApprovePlan: boolean;
  canSavePlan: boolean;
  countryOptions: string[];
  data: ReferenceData;
  initialActuals?: BusinessPlanActualEntryOption[];
  initialDraftLines: BusinessPlanDraftLine[];
  initialChannelProfiles?: BusinessPlanChannelProfileOption[];
  selectedCountryCode: string | null;
  selectedYear: number;
  initialExpandedTargetKeys?: string[];
  initialInputOpen?: boolean;
  initialTargetDimension?: TargetAnalysisDimension;
  userEmail: string | null;
  yearStatuses: BusinessPlanYearStatusOption[];
};

const months = getBusinessPlanMonths();
const currentYear = new Date().getFullYear();
const metricZero: BusinessPlanMetric = {
  siUnits: 0,
  soUnits: 0,
  siValueEur: 0,
  soValueEur: 0,
  kaSiValueEur: 0,
  gpEur: 0,
  promoRebateEur: 0,
  netProfitEur: 0
};

const initialEditorState: InputEditorState = {
  year: String(currentYear),
  month: "ALL",
  countryCode: "ALL",
  channelKey: "ALL",
  productKey: "ALL"
};

const initialDataInputFormState: DataInputFormState = {
  countryCode: "ALL",
  channelName: "",
  fdName: "",
  incoterms: "DDP",
  month: "1",
  productKey: "",
  promoPriceLocal: "",
  promoDiscountPercent: "0",
  siUnits: "0",
  soUnits: "0",
  kaBuyingMargin: "40",
  kaFrontMargin: "40",
  kaBackMargin: "0",
  fdMargin: "10"
};
const categoryMixColors = [
  "#0f172a",
  "#0891b2",
  "#4f46e5",
  "#059669",
  "#d97706",
  "#be123c"
];

export function BusinessPlanPlanner({
  approvalQueue,
  canApprovePlan,
  canChangeCountry,
  canFinalApprovePlan,
  canFirstApprovePlan,
  canSavePlan,
  countryOptions,
  data,
  initialExpandedTargetKeys = [],
  initialInputOpen = false,
  initialTargetDimension = "product",
  initialChannelProfiles = [],
  initialDraftLines,
  initialActuals = [],
  selectedCountryCode,
  selectedYear,
  userEmail,
  yearStatuses
}: BusinessPlanPlannerProps) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const isNativePlatform = pathname.startsWith("/platform/");
  const businessPlanHref = isNativePlatform
    ? "/platform/business/bp"
    : "/business-plan";
  const masterDataHref = isNativePlatform
    ? "/platform/system/master-data"
    : "/master-data";
  const isAllMarketsView = selectedCountryCode === null;
  const planScopeLabel = isAllMarketsView
    ? "All markets"
    : selectedCountryCode ?? "No country";
  const [draftLines, setDraftLines] =
    useState<BusinessPlanDraftLine[]>(initialDraftLines);
  const [channelProfiles, setChannelProfiles] = useState<
    BusinessPlanClientChannelProfile[]
  >(() => initialChannelProfiles.map(clientProfileFromOption));
  const autosave = useAutosaveDraft({
    workspace: "BUSINESS_PLAN",
    scope: `${selectedYear}:${selectedCountryCode ?? "ALL"}`,
    userEmail,
    enabled: Boolean(selectedCountryCode),
    value: { draftLines, channelProfiles },
    onRestore: (snapshot) => {
      if (Array.isArray(snapshot.draftLines)) {
        setDraftLines(snapshot.draftLines as BusinessPlanDraftLine[]);
      }
      if (Array.isArray(snapshot.channelProfiles)) {
        setChannelProfiles(snapshot.channelProfiles as BusinessPlanClientChannelProfile[]);
      }
    }
  });
  const draftAssumptions = useMemo(
    () =>
      draftLines
        .map((line) => line.assumption)
        .filter(
          (assumption): assumption is BusinessPlanTemporaryAssumption =>
            assumption !== undefined
        ),
    [draftLines]
  );
  const baseRows = useMemo(
    () => buildBusinessPlanBaseRows(data, draftAssumptions),
    [data, draftAssumptions]
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editorState, setEditorState] =
    useState<InputEditorState>({
      ...initialEditorState,
      countryCode: selectedCountryCode ?? "ALL",
      year: String(selectedYear)
    });
  const [editorValues, setEditorValues] = useState<Record<string, InputCellDraft>>(
    {}
  );
  const [isInputOpen, setIsInputOpen] = useState(initialInputOpen);
  const [isExcelInputOpen, setIsExcelInputOpen] = useState(false);
  const [selectedUploadFileName, setSelectedUploadFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);
  const [statusResult, setStatusResult] = useState<StatusActionResult | null>(
    null
  );
  const [savedChannelFilter, setSavedChannelFilter] = useState("ALL");
  const [savedProductFilter, setSavedProductFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState<BusinessPlanViewMode>("PLAN");
  const [monthlyMetricView, setMonthlyMetricView] =
    useState<MetricDisplayMode>("units");
  const [categoryMetricView, setCategoryMetricView] =
    useState<MetricDisplayMode>("value");
  const [targetMetricView, setTargetMetricView] =
    useState<MetricDisplayMode>("units");
  const [timeDimension, setTimeDimension] = useState<TimeDimension>("MONTHLY");
  const [selectedTimePeriod, setSelectedTimePeriod] =
    useState<TimePeriodFilter>("ALL");
  const currentStatus = useMemo(
    () =>
      selectedCountryCode
        ? yearStatuses.find(
            (status) => status.countryCode === selectedCountryCode
          )?.status ?? "DRAFT"
        : "DRAFT",
    [selectedCountryCode, yearStatuses]
  );
  const displayedStatusLabel = isAllMarketsView
    ? "View only"
    : bpStatusLabel(currentStatus);
  const displayedStatusClass = isAllMarketsView
    ? "inline-flex h-10 items-center rounded-md border border-cyan-100 bg-cyan-50 px-3 text-sm font-semibold text-cyan-800"
    : bpStatusClass(currentStatus);
  const lockedReason = businessPlanLockedReason(currentStatus);
  const isLocked = Boolean(lockedReason);
  const lines = useMemo(
    () => buildBusinessPlanLines(data, draftLines),
    [data, draftLines]
  );
  const scopedLines = useMemo(
    () =>
      lines.filter(
        (line) =>
          (savedChannelFilter === "ALL" ||
            channelFilterKeyForLine(line) === savedChannelFilter) &&
          (savedProductFilter === "ALL" ||
            productFilterKeyForLine(line) === savedProductFilter)
      ),
    [lines, savedChannelFilter, savedProductFilter]
  );
  const filteredLines = useMemo(
    () =>
      scopedLines.filter((line) =>
        lineMatchesTimePeriod(line, selectedTimePeriod)
      ),
    [scopedLines, selectedTimePeriod]
  );
  const summary = useMemo(() => summarizeBusinessPlan(filteredLines), [filteredLines]);
  const missingRows = filteredLines.filter(
    (line) => line.missingFields.length > 0
  );
  const savedChannelOptions = useMemo(
    () => buildSavedChannelOptions(lines),
    [lines]
  );
  const savedProductOptions = useMemo(
    () =>
      buildSavedProductOptions(
        lines,
        viewMode === "ACHIEVEMENT" ? "ALL" : savedChannelFilter
      ),
    [lines, savedChannelFilter, viewMode]
  );
  const timePeriodOptions = useMemo(
    () => buildTimePeriodOptions(timeDimension),
    [timeDimension]
  );
  const timeTrendRows = buildTimeTrendRows(
    summary,
    timeDimension,
    selectedTimePeriod
  );
  const timeTargetRows =
    timeDimension === "MONTHLY" ? summary.byMonth : summary.byQuarter;
  const timeTargetTitle =
    timeDimension === "MONTHLY" ? "Monthly Targets" : "Quarterly Targets";
  const trendTitle =
    timeDimension === "MONTHLY" ? "Monthly SI Trend" : "Quarterly SI Trend";
  const selectedTimeLabel = timePeriodFilterLabel(
    selectedTimePeriod,
    timeDimension
  );
  const summaryPeriodLabel =
    selectedTimePeriod === "ALL" ? "Annual" : selectedTimeLabel;
  const monthlyPrimaryLabel =
    monthlyMetricView === "units" ? "SI units" : "INIU SI value EUR";
  const monthlyAccentColor =
    monthlyMetricView === "units" ? "#0f172a" : "#0891b2";
  const monthlyTotalLabel =
    monthlyMetricView === "units"
      ? `${formatWhole(summary.annual.siUnits)} ${selectedTimeLabel} SI units`
      : `${formatMoney(summary.annual.siValueEur, "EUR")} ${selectedTimeLabel} INIU SI value`;
  const maxMonthlyPrimary = Math.max(
    1,
    ...timeTrendRows.map((item) =>
      monthlyPrimaryMetricValue(item, monthlyMetricView)
    )
  );
  const categoryMixSegments = buildCategoryMixSegments(
    summary.byCategory,
    categoryMetricView
  );
  const templateHref = `/api/business-plan/template?year=${encodeURIComponent(
    String(selectedYear)
  )}${selectedCountryCode ? `&country=${encodeURIComponent(selectedCountryCode)}` : ""}`;
  const exportHref = selectedCountryCode
    ? `/api/business-plan/export?year=${encodeURIComponent(
        String(selectedYear)
      )}&country=${encodeURIComponent(selectedCountryCode)}`
    : "#";
  const canEditCurrentPlan =
    canSavePlan && !isLocked && Boolean(selectedCountryCode);
  const canSubmitCurrentPlan =
    canEditCurrentPlan &&
    lines.length > 0 &&
    (currentStatus === "DRAFT" || currentStatus === "REJECTED");
  const canApproveCurrentPlan =
    selectedCountryCode !== null &&
    ((currentStatus === "SUBMITTED" && canFirstApprovePlan) ||
      (currentStatus === "FIRST_APPROVED" && canFinalApprovePlan));
  const canRejectCurrentPlan =
    selectedCountryCode !== null &&
    canApprovePlan &&
    (currentStatus === "SUBMITTED" || currentStatus === "FIRST_APPROVED");

  useEffect(() => {
    setDraftLines(initialDraftLines);
    setChannelProfiles(initialChannelProfiles.map(clientProfileFromOption));
    setEditorState((current) => ({
      ...current,
      year: String(selectedYear),
      countryCode: selectedCountryCode ?? "ALL",
      channelKey: "ALL",
      productKey: "ALL"
    }));
    setSavedChannelFilter("ALL");
    setSavedProductFilter("ALL");
    setViewMode("PLAN");
    setTimeDimension("MONTHLY");
    setSelectedTimePeriod("ALL");
    setImportResult(null);
    setSaveResult(null);
    setStatusResult(null);
  }, [initialChannelProfiles, initialDraftLines, selectedCountryCode, selectedYear]);

  useEffect(() => {
    if (
      savedProductFilter !== "ALL" &&
      !savedProductOptions.some((option) => option.value === savedProductFilter)
    ) {
      setSavedProductFilter("ALL");
    }
  }, [savedProductFilter, savedProductOptions]);

  useEffect(() => {
    if (
      !timePeriodOptions.some((option) => option.value === selectedTimePeriod)
    ) {
      setSelectedTimePeriod("ALL");
    }
  }, [selectedTimePeriod, timePeriodOptions]);

  function openInputEditor(preset?: Partial<InputEditorState>) {
    if (!canEditCurrentPlan) {
      setStatusResult({
        status: "error",
        message: lockedReason
          ? `This BP is locked: ${lockedReason}.`
          : "You cannot edit this BP."
      });
      return;
    }
    setEditorValues(draftLinesToEditorValues(draftLines, baseRows));
    setEditorState((current) => ({
      ...current,
      ...preset,
      countryCode: preset?.countryCode ?? selectedCountryCode ?? current.countryCode,
      year: preset?.year ?? String(selectedYear)
    }));
    setIsInputOpen(true);
  }

  function openNewInput() {
    openInputEditor();
  }

  function openEditInput(line: BusinessPlanLine) {
    const baseRow = baseRows.find((row) => row.key === line.rowKey);
    openInputEditor({
      year: String(line.year),
      month: String(line.month),
      countryCode: line.countryCode,
      channelKey: baseRow ? channelKeyForRow(baseRow) : "ALL",
      productKey: baseRow ? productKeyForRow(baseRow) : "ALL"
    });
  }

  function saveEditorLines(linesToSave: InputEditorSaveLine[]) {
    setDraftLines((current) => mergeEditorLines(current, linesToSave));
    setIsInputOpen(false);
  }

  function removeLine(id: string) {
    setDraftLines((current) => current.filter((line) => line.id !== id));
  }

  function navigateToContext(update: { year?: number; countryCode?: string }) {
    const params = new URLSearchParams();
    params.set("year", String(update.year ?? selectedYear));
    const nextCountry =
      update.countryCode ?? (isAllMarketsView ? "ALL" : selectedCountryCode);
    if (nextCountry) {
      params.set("country", nextCountry);
    }
    router.push(`${businessPlanHref}?${params.toString()}`);
  }

  async function saveCurrentPlan() {
    if (!canEditCurrentPlan || !selectedCountryCode || isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveResult(null);
    setStatusResult(null);
    try {
      const response = await fetch("/api/business-plan/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planYear: selectedYear,
          countryCode: selectedCountryCode,
          channelProfiles,
          rows: draftLines
        })
      });
      const result = (await response.json()) as SaveResult;
      setSaveResult(result);
      if (response.ok && result.status === "success") {
        if (result.profiles) {
          setChannelProfiles(result.profiles.map(clientProfileFromOption));
        }
        if (result.entries) {
          setDraftLines(businessPlanDraftLinesFromEntries(result.entries, data));
        }
        window.setTimeout(() => void autosave.clearAutosaveDraft(), 0);
      }
    } catch {
      setSaveResult({
        status: "error",
        message: "Save failed. Please try again."
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function runStatusAction(
    action: "submit" | "approve" | "reject",
    countryCode = selectedCountryCode
  ) {
    if (!countryCode || isStatusUpdating) {
      return;
    }

    setIsStatusUpdating(true);
    setStatusResult(null);
    setSaveResult(null);
    try {
      const response = await fetch("/api/business-plan/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          planYear: selectedYear,
          countryCodes: [countryCode]
        })
      });
      const result = (await response.json()) as StatusActionResult;
      setStatusResult(result);
      if (response.ok && result.status === "success") {
        void autosave.clearAutosaveDraft();
        window.location.reload();
      }
    } catch {
      setStatusResult({
        status: "error",
        message: "Status update failed. Please try again."
      });
    } finally {
      setIsStatusUpdating(false);
    }
  }

  async function uploadWorkbook() {
    const file = fileInputRef.current?.files?.[0];
    if (!canEditCurrentPlan) {
      setImportResult({
        status: "error",
        message: lockedReason
          ? `This BP is locked: ${lockedReason}.`
          : "You cannot upload into this BP."
      });
      return;
    }
    if (!file || isUploading) {
      setImportResult({
        status: "error",
        message: "Choose an Excel workbook first."
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setIsUploading(true);
    setImportResult(null);

    try {
      const uploadUrl = selectedCountryCode
        ? `/api/business-plan/import?country=${encodeURIComponent(
            selectedCountryCode
          )}`
        : "/api/business-plan/import";
      const response = await fetch(uploadUrl, {
        method: "POST",
        body: formData
      });
      const result = (await response.json()) as ImportResult;

      if (response.ok && result.rows) {
        setImportResult({
          ...result,
          message: `${result.rows.length} BP row(s) imported. Current draft has been replaced; click Save Draft to write this BP.`
        });
        setChannelProfiles(
          sortBusinessPlanChannelProfiles(result.channelProfiles ?? [])
        );
        setDraftLines(result.rows ?? []);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        setSelectedUploadFileName("");
      } else {
        setImportResult(result);
      }
    } catch {
      setImportResult({
        status: "error",
        message: "Upload failed. Please try again."
      });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">BP Actions</h2>
          </div>
          <span className={displayedStatusClass}>
            {displayedStatusLabel}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="text-sm font-medium text-slate-500">
            {isAllMarketsView
              ? "Aggregated saved BP for all visible markets. Select one market to edit, upload, save, or submit."
              : selectedCountryCode
                ? `Latest saved BP for ${selectedCountryCode}.`
                : "No country is available for this account."}
            {lockedReason ? ` Editing is locked after ${lockedReason}.` : ""}
          </div>
          <AutosaveStatus
            status={autosave.status}
            lastSavedAt={autosave.lastSavedAt}
            hasConflict={Boolean(autosave.conflictDraft)}
            onLoadNewest={autosave.loadNewestSavedDraft}
            onKeepMyChanges={autosave.keepMyChanges}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={openNewInput}
              disabled={!canEditCurrentPlan}
              className="inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            >
              <PlusIcon />
              System Input
            </button>
            <button
              type="button"
              onClick={() => setIsExcelInputOpen(true)}
              disabled={!canEditCurrentPlan}
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              <UploadIcon />
              Excel Input
            </button>
            <button
              type="button"
              onClick={saveCurrentPlan}
              disabled={!canEditCurrentPlan || isSaving}
              className="inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            >
              <SaveIcon />
              {isSaving ? "Saving..." : "Save Draft"}
            </button>
            <a
              href={exportHref}
              className={`inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold ${
                selectedCountryCode
                  ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  : "pointer-events-none border-slate-200 bg-slate-100 text-slate-400"
              }`}
            >
              <DownloadIcon />
              Export Current BP
            </a>
            <button
              type="button"
              onClick={() => runStatusAction("submit")}
              disabled={!canSubmitCurrentPlan || isStatusUpdating}
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              <SendIcon />
              Submit
            </button>
            {canApproveCurrentPlan ? (
              <button
                type="button"
                onClick={() => runStatusAction("approve")}
                disabled={isStatusUpdating}
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                <CheckIcon />
                {currentStatus === "FIRST_APPROVED"
                  ? "Final Approve"
                  : "First Approve"}
              </button>
            ) : null}
            {canRejectCurrentPlan ? (
              <button
                type="button"
                onClick={() => runStatusAction("reject")}
                disabled={isStatusUpdating}
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                Reject
              </button>
            ) : null}
          </div>
        </div>

        {saveResult ? (
          <div className={resultClass(saveResult.status)}>
            <div className="font-semibold">
              {saveResult.message ?? "Save status updated."}
            </div>
          </div>
        ) : null}
        {statusResult ? (
          <div className={resultClass(statusResult.status)}>
            <div className="font-semibold">
              {statusResult.message ?? "BP status updated."}
            </div>
            {statusResult.errors?.slice(0, 3).map((error) => (
              <div key={error.message} className="mt-1 text-xs">
                {error.message}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Saved BP View
            </h2>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className={displayedStatusClass}>
              {displayedStatusLabel}
            </span>
            <span className="rounded-md border border-cyan-100 bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-800">
              {filteredLines.length} / {lines.length} BP line(s)
            </span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-3">
          <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
            <span>Year</span>
            <input
              type="number"
              min="2020"
              max="2100"
              defaultValue={selectedYear}
              onBlur={(event) => {
                const nextYear = parseWholeNumber(
                  event.currentTarget.value,
                  selectedYear
                );
                if (nextYear !== selectedYear) {
                  navigateToContext({ year: nextYear });
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
              className="w-full min-w-0 min-h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm"
            />
          </label>
          {canChangeCountry ? (
            <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
              <span>Country</span>
              <select
                value={isAllMarketsView ? "ALL" : selectedCountryCode ?? ""}
                onChange={(event) =>
                  navigateToContext({ countryCode: event.target.value })
                }
                className="w-full min-w-0 min-h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm"
              >
                <option value="ALL">All markets</option>
                {countryOptions.map((countryCode) => (
                  <option key={countryCode} value={countryCode}>
                    {countryCode}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
              <span>Country</span>
              <span className="inline-flex w-full min-w-0 min-h-10 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-950">
                {planScopeLabel}
              </span>
            </div>
          )}
          <SelectField
            label={viewMode === "ACHIEVEMENT" ? "Channel / KA (BP Plan)" : "Channel / KA"}
            value={savedChannelFilter}
            onChange={(value) => {
              setSavedChannelFilter(value);
              setSavedProductFilter("ALL");
            }}
            options={[
              { label: "All channels", value: "ALL" },
              ...savedChannelOptions
            ]}
            disabled={viewMode === "ACHIEVEMENT"}
          />
          <SelectField
            label="Product"
            value={savedProductFilter}
            onChange={setSavedProductFilter}
            options={[
              { label: "All products", value: "ALL" },
              ...savedProductOptions
            ]}
          />
          <SelectField
            label="Time dimension"
            value={timeDimension}
            onChange={(value) => {
              setTimeDimension(value as TimeDimension);
              setSelectedTimePeriod("ALL");
            }}
            options={[
              { label: "Monthly", value: "MONTHLY" },
              { label: "Quarterly", value: "QUARTERLY" }
            ]}
          />
          <SelectField
            label="Period"
            value={selectedTimePeriod}
            onChange={(value) => setSelectedTimePeriod(value as TimePeriodFilter)}
            options={timePeriodOptions}
          />
        </div>
      </section>

      {approvalQueue.length > 0 ? (
        <ApprovalQueuePanel
          items={approvalQueue}
          selectedCountryCode={selectedCountryCode}
          selectedYear={selectedYear}
          onApprove={(item) => runStatusAction("approve", item.countryCode)}
          onReject={(item) => runStatusAction("reject", item.countryCode)}
          onOpen={(item) =>
            navigateToContext({
              year: item.planYear,
              countryCode: item.countryCode
            })
          }
        />
      ) : null}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <h2
              id="saved-bp-view-results-heading"
              className="text-lg font-semibold text-slate-950"
            >
              {viewMode === "PLAN" ? "Saved BP View Results" : "PO Achievement Results"}
            </h2>
            <div className="mt-2 inline-flex rounded-md border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setViewMode("PLAN")}
                className={`min-h-8 rounded px-3 text-xs font-semibold transition ${
                  viewMode === "PLAN"
                    ? "bg-slate-950 text-white shadow-sm"
                    : "text-slate-600 hover:bg-white hover:text-slate-950"
                }`}
              >
                BP Plan
              </button>
              <button
                type="button"
                onClick={() => setViewMode("ACHIEVEMENT")}
                className={`min-h-8 rounded px-3 text-xs font-semibold transition ${
                  viewMode === "ACHIEVEMENT"
                    ? "bg-slate-950 text-white shadow-sm"
                    : "text-slate-600 hover:bg-white hover:text-slate-950"
                }`}
              >
                PO Achievement
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
            <span className="rounded-md bg-slate-100 px-2 py-1">
              {planScopeLabel} · {selectedYear}
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-1">
              {timeDimension === "MONTHLY" ? "Monthly" : "Quarterly"} · {selectedTimeLabel}
            </span>
          </div>
        </div>

        {viewMode === "ACHIEVEMENT" ? (
          <BusinessPlanAchievementPanel
            aggregateProductsAcrossMarkets={isAllMarketsView}
            actuals={initialActuals}
            canImport={canSavePlan}
            lines={lines}
            planScopeLabel={planScopeLabel}
            productFilter={savedProductFilter}
            selectedTimeLabel={selectedTimeLabel}
            selectedYear={selectedYear}
            timePeriod={selectedTimePeriod}
          />
        ) : (
        <div className="grid gap-4 bg-slate-50/70 p-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              BP Summary
            </h2>
          </div>
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
            {planScopeLabel} · {selectedYear}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={<TargetIcon />}
            label={`${summaryPeriodLabel} SI Units`}
            value={formatWhole(summary.annual.siUnits)}
            subValue={`${formatWhole(summary.annual.soUnits)} SO units`}
            tone="ink"
          />
          <KpiCard
            icon={<EuroIcon />}
            label={`${summaryPeriodLabel} INIU SI Value`}
            value={formatMoney(summary.annual.siValueEur, "EUR")}
            subValue={`${formatMoney(summary.annual.kaSiValueEur, "EUR")} KA SI value`}
            tone="cyan"
          />
          <KpiCard
            icon={<ChartIcon />}
            label={`${summaryPeriodLabel} GP`}
            value={formatMoney(summary.annual.gpEur, "EUR")}
            subValue={`${formatMoney(summary.annual.netProfitEur, "EUR")} NP`}
            tone="emerald"
          />
          <KpiCard
            icon={<RebateIcon />}
            label="Promo Rebate"
            value={formatMoney(summary.annual.promoRebateEur, "EUR")}
            subValue={`${filteredLines.length} / ${lines.length} BP line(s)`}
            tone="amber"
          />
        </div>

        {baseRows.length === 0 ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <span>No active rows are available from Master Data for BP planning.</span>
            <a
              href={masterDataHref}
              className="rounded-md bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Open Master Data
            </a>
          </div>
        ) : null}
        {missingRows.length > 0 ? (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
            {missingRows.length} BP lines are missing RRP, BOM, or logistics
            master data and are excluded from value totals.
          </p>
        ) : null}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.8fr)]">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-950">
                {trendTitle}
              </h3>
              <div className="mt-1 text-sm font-medium text-slate-500">
                {monthlyTotalLabel}
              </div>
            </div>
            <MetricSwitch value={monthlyMetricView} onChange={setMonthlyMetricView} />
          </div>
          <div className="mt-4 grid grid-cols-6 gap-2 lg:grid-cols-12">
            {timeTrendRows.map((item) => {
              const primaryValue = monthlyPrimaryMetricValue(item, monthlyMetricView);
              const fullValueLabel = formatMetricDisplayValue(
                primaryValue,
                monthlyMetricView
              );
              const compactValueLabel = formatChartLabelValue(
                primaryValue,
                monthlyMetricView
              );

              return (
                <div key={item.key} className="grid min-h-36 grid-rows-[1fr_auto] gap-2">
                  <div className="relative flex items-end justify-center rounded-md bg-slate-50 px-2 pb-2 pt-8">
                    <div
                      className="absolute left-1/2 top-2 max-w-full -translate-x-1/2 truncate px-1 text-[10px] font-semibold leading-none text-slate-600"
                      title={fullValueLabel}
                    >
                      {compactValueLabel}
                    </div>
                    <div
                      aria-label={`${item.key} ${monthlyPrimaryLabel} ${fullValueLabel}`}
                      className="w-7 rounded-t-sm"
                      title={`${item.key} ${monthlyPrimaryLabel}: ${formatMetricDisplayValue(primaryValue, monthlyMetricView)}`}
                      style={{
                        backgroundColor: monthlyAccentColor,
                        height: barHeight(primaryValue, maxMonthlyPrimary)
                      }}
                    />
                  </div>
                  <div className="text-center text-xs font-semibold text-slate-600">
                    {item.label}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs font-medium text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span
                className="h-2 w-2 rounded-sm"
                style={{ backgroundColor: monthlyAccentColor }}
              /> {monthlyPrimaryLabel}
            </span>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-950">
                Category Mix
              </h3>
              <div className="mt-1 text-sm font-medium text-slate-500">
                {categoryMetricView === "units" ? "SI units" : "INIU SI value EUR"}
              </div>
            </div>
            <MetricSwitch value={categoryMetricView} onChange={setCategoryMetricView} />
          </div>
          <div className="mt-4">
            {categoryMixSegments.length === 0 ? (
              <div className="relative mx-auto h-72 w-full max-w-[34rem]">
                <div
                  aria-label="Category mix pie chart"
                  role="img"
                  className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-inner ring-1 ring-slate-100"
                  style={{
                    background: "conic-gradient(#e2e8f0 0% 100%)"
                  }}
                >
                  <div className="absolute inset-8 grid place-items-center rounded-full bg-white text-center ring-1 ring-slate-100">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Total
                      </div>
                      <div className="mt-1 text-lg font-semibold text-slate-950">
                        {categoryMetricView === "units" ? "0" : "€0.00"}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="absolute left-1/2 top-[88%] -translate-x-1/2 rounded-md bg-slate-50 px-3 py-1.5 text-center text-xs font-semibold text-slate-500">
                  No category share yet.
                </div>
              </div>
            ) : (
              <div className="relative mx-auto h-80 w-full max-w-[34rem]">
                <div
                  aria-label="Category mix pie chart"
                  role="img"
                  className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-inner ring-1 ring-slate-100"
                  style={{
                    background: buildPieGradient(categoryMixSegments)
                  }}
                >
                  <div className="absolute inset-8 grid place-items-center rounded-full bg-white text-center ring-1 ring-slate-100">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Total
                      </div>
                      <div className="mt-1 text-lg font-semibold text-slate-950">
                        {formatMetricDisplayValue(
                          categoryMixSegments.reduce(
                            (sum, segment) => sum + segment.value,
                            0
                          ),
                          categoryMetricView
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                {categoryMixSegments.map((segment, index) => (
                    <div
                      key={segment.key}
                      aria-label={`${segment.label} category mix annotation`}
                      className="absolute max-w-36 rounded-md border border-slate-100 bg-white/95 px-2.5 py-1.5 text-xs shadow-sm"
                      style={categoryAnnotationStyle(
                        index,
                        categoryMixSegments.length
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: segment.color }}
                        />
                        <div className="truncate font-semibold text-slate-950">
                          {segment.label}
                        </div>
                      </div>
                      <div className="mt-0.5 whitespace-nowrap font-semibold text-slate-700">
                        {formatMetricDisplayValue(
                          segment.value,
                          categoryMetricView
                        )}
                      </div>
                      <div className="whitespace-nowrap text-slate-500">
                        {formatShare(segment.share)}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <SummaryTable title={timeTargetTitle} rows={timeTargetRows} />
      <TargetAnalysisPanel
        initialExpandedKeys={initialExpandedTargetKeys}
        initialDimension={initialTargetDimension}
        lines={filteredLines}
        metricView={targetMetricView}
        onMetricViewChange={setTargetMetricView}
      />
        </div>
        )}
      </section>

      {isInputOpen ? (
        <InputDialog
          baseRows={baseRows}
          channelProfiles={channelProfiles}
          data={data}
          draftLines={draftLines}
          lines={lines}
          editorState={editorState}
          editorValues={editorValues}
          onChannelProfilesChange={(nextProfiles) => {
            setChannelProfiles(nextProfiles);
            setDraftLines((current) =>
              recalculateProfileDraftLines(current, nextProfiles, data)
            );
          }}
          onClearLines={() => setDraftLines([])}
          onClose={() => setIsInputOpen(false)}
          onEditLine={openEditInput}
          onRemoveLine={removeLine}
          onSave={saveEditorLines}
          onStateChange={setEditorState}
          onValuesChange={setEditorValues}
        />
      ) : null}
      {isExcelInputOpen ? (
        <ExcelInputDialog
          canEditCurrentPlan={canEditCurrentPlan}
          fileInputRef={fileInputRef}
          importResult={importResult}
          isUploading={isUploading}
          onClose={() => setIsExcelInputOpen(false)}
          onFileNameChange={setSelectedUploadFileName}
          onUpload={uploadWorkbook}
          selectedUploadFileName={selectedUploadFileName}
          templateHref={templateHref}
        />
      ) : null}
    </div>
  );
}

function InputLinesTable({
  lines,
  onEdit,
  onRemove
}: {
  lines: BusinessPlanLine[];
  onEdit: (line: BusinessPlanLine) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1500px] w-full border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">Period</th>
            <th className="px-3 py-2">Country</th>
            <th className="px-3 py-2">Channel / KA</th>
            <th className="px-3 py-2">Product</th>
            <th className="px-3 py-2 text-right">SI</th>
            <th className="px-3 py-2 text-right">SO</th>
            <th className="px-3 py-2 text-right">RRP Local</th>
            <th className="px-3 py-2 text-right">Promo Disc.</th>
            <th className="px-3 py-2 text-right">Promo Price</th>
            <th className="px-3 py-2 text-right">INIU SI Value</th>
            <th className="px-3 py-2 text-right">GP</th>
            <th className="px-3 py-2 text-right">Promo Rebate</th>
            <th className="px-3 py-2 text-right">NP</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {lines.length === 0 ? (
            <tr>
              <td colSpan={15} className="px-3 py-8 text-center text-slate-500">
                No BP input lines yet.
              </td>
            </tr>
          ) : (
            lines.map((line) => (
              <tr key={line.id} className="align-top hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-700">
                  {line.year} · {monthLabel(line.month)}
                </td>
                <td className="px-3 py-2 text-slate-700">{line.countryCode}</td>
                <td className="px-3 py-2 text-slate-700">
                  <div className="font-medium text-slate-950">{line.channelName}</div>
                  <div className="text-xs text-slate-500">
                    {line.fdName} · {line.incoterms}
                  </div>
                  {line.source === "BP_ASSUMPTION" ? (
                    <div className="mt-1 inline-flex rounded bg-cyan-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-cyan-700">
                      BP New Channel
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-slate-700">
                  <div className="font-medium text-slate-950">{line.model}</div>
                  <div className="text-xs text-slate-500">
                    {line.category} · {line.lifecycleStatus}
                  </div>
                </td>
                <td className="px-3 py-2 text-right text-slate-700">
                  {formatWhole(line.siUnits)}
                </td>
                <td className="px-3 py-2 text-right text-slate-700">
                  {formatWhole(line.soUnits)}
                </td>
                <td className="px-3 py-2 text-right text-slate-700">
                  {line.rrpLocal === null ? "-" : formatMoney(line.rrpLocal, line.currency)}
                </td>
                <td className="px-3 py-2 text-right text-slate-700">
                  {formatPercent(line.promoDiscountPercent)}
                </td>
                <td className="px-3 py-2 text-right text-slate-700">
                  <div>
                    {line.promoPriceLocal === null
                      ? "-"
                      : formatMoney(line.promoPriceLocal, line.currency)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {line.promoPriceEur === null
                      ? "-"
                      : formatMoney(line.promoPriceEur, "EUR")}
                  </div>
                </td>
                <td className="px-3 py-2 text-right font-semibold text-slate-950">
                  {formatMoney(line.siValueEur, "EUR")}
                </td>
                <td className="px-3 py-2 text-right text-slate-700">
                  {formatMoney(line.gpEur, "EUR")}
                </td>
                <td className="px-3 py-2 text-right text-slate-700">
                  {formatMoney(line.promoRebateEur, "EUR")}
                </td>
                <td className="px-3 py-2 text-right font-semibold text-slate-950">
                  {formatMoney(line.netProfitEur, "EUR")}
                </td>
                <td className="px-3 py-2">
                  <span className={warningClass(line.warningLevel)}>
                    {line.warningLevel ?? "MISSING"}
                  </span>
                  {line.npPercent !== null ? (
                    <div className="mt-1 text-xs text-slate-500">
                      NP {formatPercent(line.npPercent)}
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(line)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-white"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(line.id)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-white"
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function InputDialog({
  baseRows,
  channelProfiles,
  data,
  draftLines,
  lines,
  editorState,
  editorValues,
  onChannelProfilesChange,
  onClearLines,
  onClose,
  onEditLine,
  onRemoveLine,
  onSave,
  onStateChange,
  onValuesChange
}: {
  baseRows: BusinessPlanBaseRow[];
  channelProfiles: BusinessPlanClientChannelProfile[];
  data: ReferenceData;
  draftLines: BusinessPlanDraftLine[];
  lines: BusinessPlanLine[];
  editorState: InputEditorState;
  editorValues: Record<string, InputCellDraft>;
  onChannelProfilesChange: (
    profiles: BusinessPlanClientChannelProfile[]
  ) => void;
  onClearLines: () => void;
  onClose: () => void;
  onEditLine: (line: BusinessPlanLine) => void;
  onRemoveLine: (id: string) => void;
  onSave: (linesToSave: InputEditorSaveLine[]) => void;
  onStateChange: (state: InputEditorState) => void;
  onValuesChange: (values: Record<string, InputCellDraft>) => void;
}) {
  const channelOptions = buildChannelOptions(baseRows, editorState.countryCode);
  const productOptions = buildProductOptions(baseRows, editorState);
  const countryOptions = buildCountryOptions(baseRows);
  const visibleRows = buildEditorRows(baseRows, editorState);
  const initialDataInputCountry =
    editorState.countryCode !== "ALL"
      ? editorState.countryCode
      : countryOptions[0] ?? "ALL";
  const [dataInputState, setDataInputState] = useState<DataInputFormState>(() => ({
    ...initialDataInputFormState,
    countryCode: initialDataInputCountry,
    month: editorState.month === "ALL" ? "1" : editorState.month,
    productKey:
      buildBpOnlyTargetProductOptions(baseRows, initialDataInputCountry)[0]
        ?.value ?? ""
  }));
  const [dataInputError, setDataInputError] = useState<string | null>(null);
  const dataInputProductOptions = useMemo(
    () =>
      buildBpOnlyTargetProductOptions(
        baseRows,
        dataInputState.countryCode !== "ALL"
          ? dataInputState.countryCode
          : initialDataInputCountry
      ),
    [baseRows, dataInputState.countryCode, initialDataInputCountry]
  );
  const dataInputProductRow = findBpOnlyProductRow(
    baseRows,
    dataInputState.countryCode !== "ALL"
      ? dataInputState.countryCode
      : initialDataInputCountry,
    dataInputState.productKey
  );
  const matchingMasterDataRow = useMemo(
    () =>
      baseRows.find(
        (row) =>
          !row.key.startsWith("bp-assumption:") &&
          row.countryCode === dataInputState.countryCode &&
          normalizeBusinessInput(row.channelName) ===
            normalizeBusinessInput(dataInputState.channelName) &&
          normalizeBusinessInput(row.fdName) ===
            normalizeBusinessInput(dataInputState.fdName) &&
          normalizeBusinessInput(row.incoterms) ===
            normalizeBusinessInput(dataInputState.incoterms) &&
          productKeyForRow(row) === dataInputState.productKey
      ) ?? null,
    [
      baseRows,
      dataInputState.channelName,
      dataInputState.countryCode,
      dataInputState.fdName,
      dataInputState.incoterms,
      dataInputState.productKey
    ]
  );
  const existingValues = useMemo(
    () => draftLinesToEditorValues(draftLines, baseRows),
    [baseRows, draftLines]
  );

  useEffect(() => {
    setDataInputState((current) => ({
      ...current,
      productKey:
        current.productKey &&
        dataInputProductOptions.some((option) => option.value === current.productKey)
          ? current.productKey
          : dataInputProductOptions[0]?.value ?? ""
    }));
  }, [dataInputProductOptions]);

  function updateState(update: Partial<InputEditorState>) {
    onStateChange({
      ...editorState,
      ...update
    });
  }

  function updateDataInputState(update: Partial<DataInputFormState>) {
    setDataInputError(null);
    setDataInputState((current) => ({
      ...current,
      ...update
    }));
  }

  function updateCell(
    identity: string,
    field: keyof InputCellDraft,
    value: string,
    row: BusinessPlanBaseRow
  ) {
    const currentValue = getEditorCellValue(
      identity,
      editorValues,
      existingValues,
      row
    );
    const nextValue = { ...currentValue, [field]: value };

    if (field === "promoPriceLocal") {
      nextValue.promoDiscountPercent = discountInputFromPrice(value, row);
    }
    if (field === "promoDiscountPercent") {
      nextValue.promoPriceLocal = priceInputFromDiscount(value, row);
    }

    onValuesChange({
      ...editorValues,
      [identity]: nextValue
    });
  }

  function clearVisibleRows() {
    const nextValues = { ...editorValues };
    for (const row of visibleRows) {
      nextValues[row.identity] = emptyCellDraft();
    }
    onValuesChange(nextValues);
  }

  function saveVisibleRows() {
    onSave(
      visibleRows.map((row) => {
        const value = getEditorCellValue(
          row.identity,
          editorValues,
          existingValues,
          row.baseRow
        );
        const promoPriceLocal = parseOptionalNumber(value.promoPriceLocal);
        const siUnits = parseWholeNumber(value.siUnits, 0);
        const soUnits = parseWholeNumber(value.soUnits, 0);
        const promoDiscountPercent = parsePercentInput(
          value.promoDiscountPercent
        );

        return {
          id: `bp-${row.identity}`,
          rowKey: row.baseRow.key,
          year: parseWholeNumber(editorState.year, currentYear),
          month: row.month,
          promoPriceLocal,
          siUnits,
          soUnits,
          promoDiscountPercent,
          assumption: assumptionFromBaseRow(row.baseRow),
          isEmpty:
            siUnits === 0 && soUnits === 0 && promoDiscountPercent === 0
        };
      })
    );
  }

  function addDataInputLine() {
    const countryCode = dataInputState.countryCode.trim().toUpperCase();
    const channelName = dataInputState.channelName.trim();
    const fdName = dataInputState.fdName.trim();
    const incoterms = dataInputState.incoterms.trim() || "DDP";
    const productRow = dataInputProductRow;
    const year = parseWholeNumber(editorState.year, currentYear);

    if (!countryCode || countryCode === "ALL") {
      setDataInputError("Select one country before adding a BP row.");
      return;
    }
    if (!channelName || !fdName || !incoterms) {
      setDataInputError("Fill Channel / KA, FD, and Incoterms.");
      return;
    }
    if (!productRow) {
      setDataInputError("Select a product that exists in Master Data for this country.");
      return;
    }

    const month = parseWholeNumber(dataInputState.month, 1);
    const siUnits = parseWholeNumber(dataInputState.siUnits, 0);
    const soUnits = parseWholeNumber(dataInputState.soUnits, 0);
    const promoPriceLocal = parseOptionalNumber(dataInputState.promoPriceLocal);
    const promoDiscountPercent = parsePercentInput(
      dataInputState.promoDiscountPercent
    );
    const targetRow = matchingMasterDataRow;

    if (targetRow) {
      onSave([
        {
          id: `bp-${year}-${month}-${targetRow.key}`,
          rowKey: targetRow.key,
          year,
          month,
          promoPriceLocal,
          siUnits,
          soUnits,
          promoDiscountPercent,
          assumption: assumptionFromBaseRow(targetRow),
          isEmpty:
            siUnits === 0 && soUnits === 0 && promoDiscountPercent === 0
        }
      ]);
      return;
    }

    const channelProfileDraft: BusinessPlanChannelProfileDraft = {
      id: businessPlanChannelProfileKey({
        planYear: year,
        countryCode,
        retailerName: channelName,
        fdName,
        incoterms
      }),
      planYear: year,
      countryCode,
      retailerName: channelName,
      fdName,
      incoterms,
      kaBuyingMargin: parsePercentInput(dataInputState.kaBuyingMargin),
      kaFrontMargin: parsePercentInput(dataInputState.kaFrontMargin),
      kaBackMargin: parsePercentInput(dataInputState.kaBackMargin),
      fdMargin: parsePercentInput(dataInputState.fdMargin)
    };
    const existingProfile = channelProfiles.find(
      (profile) =>
        channelProfileBusinessKey(profile) ===
        channelProfileBusinessKey(channelProfileDraft)
    );
    const nextProfile: BusinessPlanClientChannelProfile = {
      ...channelProfileDraft,
      id: existingProfile?.id ?? channelProfileDraft.id,
      productOverrides: existingProfile?.productOverrides ?? []
    };
    const assumption = buildBusinessPlanProfileAssumption({
      data,
      profile: nextProfile,
      productSku: productRow.model,
      override: null
    });
    if (!assumption) {
      setDataInputError(
        "This product is missing Master Data for the selected country. Maintain product price, BOM, and logistics in Master Data first."
      );
      return;
    }
    const bpOnlyBaseRow = buildBusinessPlanBaseRows(data, [assumption]).find(
      (row) => row.key === temporaryAssumptionRowKey(assumption)
    );
    if (!bpOnlyBaseRow || bpOnlyBaseRow.missingFields.length > 0) {
      setDataInputError(
        "This BP-only row is missing product RRP, BOM, or Logistics in Master Data."
      );
      return;
    }
    const rowKey = temporaryAssumptionRowKey(assumption);

    onChannelProfilesChange(upsertChannelProfile(channelProfiles, nextProfile));
    onSave([
      {
        id: `bp-${year}-${month}-${rowKey}`,
        rowKey,
        year,
        month,
        promoPriceLocal,
        siUnits,
        soUnits,
        promoDiscountPercent,
        assumption,
        channelProfileId: nextProfile.id,
        isEmpty:
          siUnits === 0 && soUnits === 0 && promoDiscountPercent === 0
      }
    ]);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-3 py-3">
      <section className="grid h-[94vh] w-[96vw] max-w-[1800px] grid-rows-[auto_auto_minmax(260px,1fr)_minmax(180px,0.65fr)_auto] overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-950">
              BP Input Editor
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Add or update KA targets. RRP/RRPP inputs stay in local currency; value columns convert to EUR.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="grid gap-3 border-b border-slate-200 px-4 py-3">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            <Field
              label="Year"
              value={editorState.year}
              onChange={(value) => updateState({ year: value })}
            />
            <SelectField
              label="Month"
              value={editorState.month}
              onChange={(value) => updateState({ month: value })}
              options={[
                { label: "All months", value: "ALL" },
                ...months.map((month) => ({
                  label: month.label,
                  value: String(month.month)
                }))
              ]}
            />
            <SelectField
              label="Country"
              value={editorState.countryCode}
              onChange={(value) =>
                updateState({
                  countryCode: value,
                  channelKey: "ALL",
                  productKey: "ALL"
                })
              }
              options={[
                { label: "All countries", value: "ALL" },
                ...countryOptions.map((code) => ({ label: code, value: code }))
              ]}
            />
            <SelectField
              label="Channel / KA / FD"
              value={editorState.channelKey}
              onChange={(value) =>
                updateState({ channelKey: value, productKey: "ALL" })
              }
              options={[
                { label: "All channels / FD", value: "ALL" },
                ...channelOptions
              ]}
            />
            <SelectField
              label="Product"
              value={editorState.productKey}
              onChange={(value) => updateState({ productKey: value })}
              options={[
                { label: "All products", value: "ALL" },
                ...productOptions
              ]}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-medium text-slate-500">
            <span>{formatWhole(visibleRows.length)} target row(s) match the current filters.</span>
            <span>Use filters for month-led, channel-led, or product-led input.</span>
          </div>
          <section className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-slate-950">
                Add BP Input Row
              </h4>
              <span
                className={`rounded-md px-2 py-1 text-xs font-semibold ${
                  matchingMasterDataRow
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-cyan-50 text-cyan-700"
                }`}
              >
                {matchingMasterDataRow ? "Master Data" : "BP-only"}
              </span>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
              <SelectField
                label="Country"
                value={dataInputState.countryCode}
                onChange={(value) =>
                  updateDataInputState({
                    countryCode: value,
                    productKey:
                      buildBpOnlyTargetProductOptions(baseRows, value)[0]
                        ?.value ?? ""
                  })
                }
                options={countryOptions.map((code) => ({
                  label: code,
                  value: code
                }))}
              />
              <SelectField
                label="Month"
                value={dataInputState.month}
                onChange={(value) => updateDataInputState({ month: value })}
                options={months.map((month) => ({
                  label: month.label,
                  value: String(month.month)
                }))}
              />
              <TextField
                label="Channel / KA"
                value={dataInputState.channelName}
                onChange={(value) =>
                  updateDataInputState({ channelName: value })
                }
              />
              <TextField
                label="FD"
                value={dataInputState.fdName}
                onChange={(value) => updateDataInputState({ fdName: value })}
              />
              <TextField
                label="Incoterms"
                value={dataInputState.incoterms}
                onChange={(value) =>
                  updateDataInputState({ incoterms: value })
                }
              />
              <SelectField
                label="Product"
                value={dataInputState.productKey}
                onChange={(value) => updateDataInputState({ productKey: value })}
                options={dataInputProductOptions}
              />
              <Field
                label="Promo Price Local"
                step="0.01"
                value={dataInputState.promoPriceLocal}
                onChange={(value) =>
                  updateDataInputState({
                    promoPriceLocal: value,
                    promoDiscountPercent: dataInputProductRow
                      ? discountInputFromPrice(value, dataInputProductRow)
                      : dataInputState.promoDiscountPercent
                  })
                }
              />
              <Field
                label="Promo Discount %"
                step="0.1"
                value={dataInputState.promoDiscountPercent}
                onChange={(value) =>
                  updateDataInputState({
                    promoDiscountPercent: value,
                    promoPriceLocal: dataInputProductRow
                      ? priceInputFromDiscount(value, dataInputProductRow)
                      : dataInputState.promoPriceLocal
                  })
                }
              />
              <Field
                label="SI Units"
                value={dataInputState.siUnits}
                onChange={(value) => updateDataInputState({ siUnits: value })}
              />
              <Field
                label="SO Units"
                value={dataInputState.soUnits}
                onChange={(value) => updateDataInputState({ soUnits: value })}
              />
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-4">
              <Field
                label="KA Buying %"
                step="0.1"
                value={dataInputState.kaBuyingMargin}
                onChange={(value) =>
                  updateDataInputState({ kaBuyingMargin: value })
                }
              />
              <Field
                label="KA Front %"
                step="0.1"
                value={dataInputState.kaFrontMargin}
                onChange={(value) =>
                  updateDataInputState({ kaFrontMargin: value })
                }
              />
              <Field
                label="KA Back %"
                step="0.1"
                value={dataInputState.kaBackMargin}
                onChange={(value) =>
                  updateDataInputState({ kaBackMargin: value })
                }
              />
              <Field
                label="FD Margin %"
                step="0.1"
                value={dataInputState.fdMargin}
                onChange={(value) => updateDataInputState({ fdMargin: value })}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-medium text-slate-500">
                {dataInputProductRow ? (
                  <span>
                    RRP{" "}
                    {dataInputProductRow.rrpLocal === null
                      ? "-"
                      : formatMoney(
                          dataInputProductRow.rrpLocal,
                          dataInputProductRow.currency
                        )}{" "}
                    /{" "}
                    {dataInputProductRow.rrpEur === null
                      ? "-"
                      : formatMoney(dataInputProductRow.rrpEur, "EUR")}
                  </span>
                ) : (
                  <span>Select country and product.</span>
                )}
              </div>
              {dataInputError ? (
                <div className="text-xs font-semibold text-rose-700">
                  {dataInputError}
                </div>
              ) : null}
              <button
                type="button"
                onClick={addDataInputLine}
                disabled={!dataInputProductRow}
                className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              >
                Add input row
              </button>
            </div>
          </section>
        </div>

        <div className="min-h-0 overflow-auto">
          <table className="min-w-[1540px] w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Period</th>
                <th className="px-3 py-2">Country</th>
                <th className="px-3 py-2">Currency</th>
                <th className="px-3 py-2">Channel / KA / FD</th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2 text-right">RRP Local</th>
                <th className="bg-emerald-50 px-3 py-2 text-right text-emerald-800">
                  Promo Price Local
                </th>
                <th className="px-3 py-2 text-right">Promo Price EUR</th>
                <th className="bg-emerald-50 px-3 py-2 text-right text-emerald-800">
                  Promo Discount %
                </th>
                <th className="bg-emerald-50 px-3 py-2 text-right text-emerald-800">
                  SI Units
                </th>
                <th className="bg-emerald-50 px-3 py-2 text-right text-emerald-800">
                  SO Units
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-slate-500">
                    No matching BP rows.
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => {
                  const value = getEditorCellValue(
                    row.identity,
                    editorValues,
                    existingValues,
                    row.baseRow
                  );
                  const promoPriceEurPreview = promoPriceEurFromInput(
                    value,
                    row.baseRow
                  );

                  return (
                    <tr key={row.identity} className="align-top hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium text-slate-700">
                        {editorState.year} · {monthLabel(row.month)}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {row.baseRow.countryCode}
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-700">
                        {row.baseRow.currency}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        <div className="font-medium text-slate-950">
                          {row.baseRow.channelName}
                        </div>
                        <div className="text-xs text-slate-500">
                          {row.baseRow.fdName} · {row.baseRow.incoterms}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        <div className="font-medium text-slate-950">
                          {row.baseRow.model}
                        </div>
                        <div className="text-xs text-slate-500">
                          {row.baseRow.category}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-slate-700">
                        {row.baseRow.rrpLocal === null
                          ? "-"
                          : formatMoney(row.baseRow.rrpLocal, row.baseRow.currency)}
                      </td>
                      <td className="bg-emerald-50/60 px-3 py-2">
                        <EditorNumberInput
                          ariaLabel={`Promo Price Local ${row.identity}`}
                          step="0.01"
                          value={value.promoPriceLocal}
                          onChange={(nextValue) =>
                            updateCell(
                              row.identity,
                              "promoPriceLocal",
                              nextValue,
                              row.baseRow
                            )
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-950">
                        {promoPriceEurPreview === null
                          ? "-"
                          : formatMoney(promoPriceEurPreview, "EUR")}
                      </td>
                      <td className="bg-emerald-50/60 px-3 py-2">
                        <EditorNumberInput
                          ariaLabel={`Promo Discount ${row.identity}`}
                          step="0.1"
                          value={value.promoDiscountPercent}
                          onChange={(nextValue) =>
                            updateCell(
                              row.identity,
                              "promoDiscountPercent",
                              nextValue,
                              row.baseRow
                            )
                          }
                        />
                      </td>
                      <td className="bg-emerald-50/60 px-3 py-2">
                        <EditorNumberInput
                          ariaLabel={`SI Units ${row.identity}`}
                          value={value.siUnits}
                          onChange={(nextValue) =>
                            updateCell(
                              row.identity,
                              "siUnits",
                              nextValue,
                              row.baseRow
                            )
                          }
                        />
                      </td>
                      <td className="bg-emerald-50/60 px-3 py-2">
                        <EditorNumberInput
                          ariaLabel={`SO Units ${row.identity}`}
                          value={value.soUnits}
                          onChange={(nextValue) =>
                            updateCell(
                              row.identity,
                              "soUnits",
                              nextValue,
                              row.baseRow
                            )
                          }
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="min-h-0 overflow-hidden border-t border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-2">
            <div>
              <h4 className="text-sm font-semibold text-slate-950">
                Current BP Input Lines
              </h4>
              <div className="mt-0.5 text-xs font-medium text-slate-500">
                {formatWhole(lines.length)} line(s) in this draft
              </div>
            </div>
            {lines.length > 0 ? (
              <button
                type="button"
                onClick={onClearLines}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Clear all
              </button>
            ) : null}
          </div>
          <div className="h-full overflow-auto">
            <InputLinesTable
              lines={lines}
              onEdit={onEditLine}
              onRemove={onRemoveLine}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
          <div className="text-xs font-medium text-slate-500">
            Saving applies only to the rows currently visible in this editor.
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={clearVisibleRows}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Clear visible rows
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveVisibleRows}
              disabled={visibleRows.length === 0}
              className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            >
              Add / update visible rows
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ExcelInputDialog({
  canEditCurrentPlan,
  fileInputRef,
  importResult,
  isUploading,
  onClose,
  onFileNameChange,
  onUpload,
  selectedUploadFileName,
  templateHref
}: {
  canEditCurrentPlan: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  importResult: ImportResult | null;
  isUploading: boolean;
  onClose: () => void;
  onFileNameChange: (fileName: string) => void;
  onUpload: () => void;
  selectedUploadFileName: string;
  templateHref: string;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-3 py-3">
      <section className="w-[96vw] max-w-4xl overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">
              Excel Input
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Download the BP template, maintain BP Master Data if needed, edit BP Input, then upload the workbook for recognition.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h4 className="text-sm font-semibold text-slate-950">
              Template
            </h4>
            <p className="mt-1 text-sm text-slate-500">
              New Channel / FD margins belong in BP Master Data. Local currency price inputs in BP Input are converted to EUR after upload.
            </p>
            <a
              href={templateHref}
              className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <DownloadIcon />
              Download template
            </a>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-950">
              Upload workbook
            </h4>
            <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(220px,1fr)_auto]">
              <FilePicker
                inputRef={fileInputRef}
                fileName={selectedUploadFileName}
                onFileNameChange={onFileNameChange}
              />
              <button
                type="button"
                disabled={isUploading || !canEditCurrentPlan}
                onClick={onUpload}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              >
                <UploadIcon />
                {isUploading ? "Uploading..." : "Upload Excel"}
              </button>
            </div>
            {importResult ? (
              <div className={statusClass(importResult.status)}>
                <div className="font-semibold">{importResult.message}</div>
                {importResult.skipped ? (
                  <div className="mt-1 text-xs">
                    {importResult.skipped} row(s) skipped during recognition.
                  </div>
                ) : null}
                {importResult.errors?.slice(0, 5).map((error) => (
                  <div
                    key={`${error.sheetName}-${error.rowNumber}-${error.message}`}
                    className="mt-1 text-xs"
                  >
                    {error.sheetName} row {error.rowNumber}: {error.message}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricSwitch({
  onChange,
  value
}: {
  onChange: (value: MetricDisplayMode) => void;
  value: MetricDisplayMode;
}) {
  return (
    <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-1">
      {(["units", "value"] as const).map((mode) => {
        const isActive = value === mode;

        return (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            className={`min-h-8 rounded px-3 text-xs font-semibold transition ${
              isActive
                ? "bg-slate-950 text-white shadow-sm"
                : "text-slate-600 hover:bg-white hover:text-slate-950"
            }`}
          >
            {mode === "units" ? "Units" : "Value"}
          </button>
        );
      })}
    </div>
  );
}

function TargetAnalysisPanel({
  initialExpandedKeys,
  initialDimension,
  lines,
  metricView,
  onMetricViewChange
}: {
  initialExpandedKeys: string[];
  initialDimension: TargetAnalysisDimension;
  lines: BusinessPlanLine[];
  metricView: MetricDisplayMode;
  onMetricViewChange: (value: MetricDisplayMode) => void;
}) {
  const [dimension, setDimension] =
    useState<TargetAnalysisDimension>(initialDimension);
  const [expandedTargetKeys, setExpandedTargetKeys] = useState<string[]>(
    initialExpandedKeys
  );
  const isProductDimension = dimension === "product";
  const channelTargetRows = useMemo(
    () => buildChannelTargetRows(lines),
    [lines]
  );
  const productTargetRows = useMemo(
    () => buildProductTargetRows(lines),
    [lines]
  );
  const channelSegments = useMemo(
    () => buildTargetMixSegments(channelTargetRows, metricView),
    [channelTargetRows, metricView]
  );
  const channelRows = useMemo(
    () => buildTargetContributionRows(channelTargetRows, metricView),
    [channelTargetRows, metricView]
  );
  const productSegments = useMemo(
    () => buildTargetMixSegments(productTargetRows, metricView),
    [productTargetRows, metricView]
  );
  const productRows = useMemo(
    () => buildTargetContributionRows(productTargetRows, metricView),
    [productTargetRows, metricView]
  );
  const channelTotal = sumGroupMetrics(channelSegments);
  const productTotal = sumGroupMetrics(productSegments);
  const activeRows = isProductDimension ? productRows : channelRows;
  const activeSegments = isProductDimension ? productSegments : channelSegments;
  const activeTotal = isProductDimension ? productTotal : channelTotal;
  const drilldownRowsByKey = useMemo(
    () =>
      new Map(
        activeRows.map((row) => [
          row.key,
          isProductDimension
            ? buildProductChannelDrilldownRows(lines, row.key)
            : buildChannelProductDrilldownRows(lines, row.key)
        ])
      ),
    [activeRows, isProductDimension, lines]
  );

  function selectDimension(nextDimension: TargetAnalysisDimension) {
    setDimension(nextDimension);
    setExpandedTargetKeys([]);
  }

  function toggleTargetKey(key: string) {
    setExpandedTargetKeys((currentKeys) =>
      currentKeys.includes(key)
        ? currentKeys.filter((currentKey) => currentKey !== key)
        : [...currentKeys, key]
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-950">
              Target Analysis
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TargetDimensionSwitch
              value={dimension}
              onChange={selectDimension}
            />
            <MetricSwitch value={metricView} onChange={onMetricViewChange} />
          </div>
        </div>
      </div>

      <div className="p-4">
        <TargetMixBreakdown
          title={isProductDimension ? "Product Contribution" : "Channel Mix"}
          ariaLabel={
            isProductDimension
              ? "Target product mix pie chart"
              : "Target channel mix pie chart"
          }
          listAriaLabel={
            isProductDimension
              ? "Product contribution list"
              : "Channel contribution list"
          }
          annotationKind={isProductDimension ? "product" : "channel"}
          chartSegments={activeSegments}
          contributionRows={activeRows}
          dimension={dimension}
          drilldownRowsByKey={drilldownRowsByKey}
          expandedKeys={expandedTargetKeys}
          metricView={metricView}
          onToggle={toggleTargetKey}
          total={activeTotal}
          listMaxHeightClassName="max-h-[26rem]"
        />
      </div>
    </section>
  );
}

function TargetDimensionSwitch({
  onChange,
  value
}: {
  onChange: (value: TargetAnalysisDimension) => void;
  value: TargetAnalysisDimension;
}) {
  return (
    <div
      aria-label="Target analysis dimension"
      className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-1"
    >
      {(["product", "channel"] as const).map((dimension) => {
        const isActive = value === dimension;

        return (
          <button
            key={dimension}
            type="button"
            onClick={() => onChange(dimension)}
            className={`min-h-8 rounded px-3 text-xs font-semibold transition ${
              isActive
                ? "bg-slate-950 text-white shadow-sm"
                : "text-slate-600 hover:bg-white hover:text-slate-950"
            }`}
          >
            {dimension === "product" ? "Product" : "Channel"}
          </button>
        );
      })}
    </div>
  );
}

function TargetMixBreakdown({
  annotationKind,
  ariaLabel,
  chartSegments,
  contributionRows,
  dimension,
  drilldownRowsByKey,
  expandedKeys,
  listAriaLabel,
  listMaxHeightClassName = "max-h-80",
  metricView,
  onToggle,
  title,
  total
}: {
  annotationKind: "channel" | "product";
  ariaLabel: string;
  chartSegments: TargetMixSegment[];
  contributionRows: TargetMixSegment[];
  dimension: TargetAnalysisDimension;
  drilldownRowsByKey: Map<string, TargetDrilldownRow[]>;
  expandedKeys: string[];
  listAriaLabel: string;
  listMaxHeightClassName?: string;
  metricView: MetricDisplayMode;
  onToggle: (key: string) => void;
  title: string;
  total: BusinessPlanMetric;
}) {
  const totalValue = metricDisplayValue(total, metricView);
  const expandedSegments = contributionRows.filter((row) =>
    expandedKeys.includes(row.key)
  );
  const highlightedSegment = expandedSegments[0] ?? null;
  const selectedColor = highlightedSegment?.color ?? "#64748b";
  const expandedCount = expandedSegments.length;
  const expandedShare = expandedSegments.reduce(
    (sum, segment) => sum + segment.share,
    0
  );
  const chartShadow =
    expandedCount > 0
      ? `0 0 0 8px ${hexToRgba(selectedColor, 0.08)}, 0 18px 38px ${hexToRgba(
          selectedColor,
          0.18
        )}`
      : "inset 0 0 0 1px rgba(226, 232, 240, 0.9)";
  const chartCallout =
    expandedCount === 0
      ? null
      : expandedCount === 1
        ? highlightedSegment?.label
        : `${expandedCount} open`;
  const chartCalloutTitle =
    expandedCount > 1 ? "Expanded segments" : "Expanded segment";
  const centerHint =
    expandedCount > 0
      ? expandedCount === 1
        ? formatShare(highlightedSegment?.share ?? 0)
        : `${formatShare(expandedShare)} open`
      : null;

  return (
    <div className="rounded-lg border border-slate-100 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-950">{title}</h4>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
          {contributionRows.length} group(s)
        </span>
      </div>
      {contributionRows.length === 0 ? (
        <div className="relative mx-auto mt-3 h-56 w-full max-w-[24rem]">
          <div
            aria-label={ariaLabel}
            role="img"
            className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-inner ring-1 ring-slate-100"
            style={{ background: "conic-gradient(#e2e8f0 0% 100%)" }}
          >
            <div className="absolute inset-7 grid place-items-center rounded-full bg-white text-center ring-1 ring-slate-100">
              <div className="text-xs font-semibold text-slate-500">
                No data
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-center">
          <div className="relative mx-auto h-60 w-full max-w-60">
            <div
              aria-label={ariaLabel}
              role="img"
              className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-inner ring-1 ring-slate-100 transition"
              style={{
                background: buildPieGradient(chartSegments),
                boxShadow: chartShadow
              }}
            >
              <div className="absolute inset-8 grid place-items-center rounded-full bg-white text-center ring-1 ring-slate-100">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Total
                  </div>
                  <div className="mt-1 text-base font-semibold text-slate-950">
                    {formatMetricDisplayValue(totalValue, metricView)}
                  </div>
                  {centerHint ? (
                    <div className="mt-1 text-[10px] font-semibold text-slate-500">
                      {centerHint}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            {chartCallout ? (
              <div
                className="absolute bottom-0 left-1/2 w-48 -translate-x-1/2 rounded-md border border-slate-100 bg-white/95 px-2.5 py-1.5 text-xs shadow-sm"
                style={{
                  boxShadow: `0 12px 28px ${hexToRgba(selectedColor, 0.18)}`
                }}
              >
                <div className="flex items-center gap-1.5 text-slate-500">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: selectedColor }}
                  />
                  <span className="font-semibold">{chartCalloutTitle}</span>
                </div>
                <div className="mt-0.5 truncate font-semibold text-slate-950">
                  {chartCallout}
                </div>
              </div>
            ) : null}
          </div>
          <div
            aria-label={listAriaLabel}
            className={`overflow-y-auto rounded-md border border-slate-100 bg-slate-50/70 ${listMaxHeightClassName}`}
          >
            <div className="divide-y divide-slate-100">
              {contributionRows.map((segment, index) => {
                const isExpanded = expandedKeys.includes(segment.key);
                const drilldownRows = drilldownRowsByKey.get(segment.key) ?? [];

                return (
                  <div
                    key={segment.key}
                    className={`transition ${
                      isExpanded
                        ? "bg-white text-slate-950"
                        : "hover:bg-white"
                    }`}
                    style={
                      isExpanded
                        ? {
                            boxShadow: `inset 3px 0 0 ${segment.color}`
                          }
                        : undefined
                    }
                  >
                    <button
                      type="button"
                      aria-label={`${segment.label} ${annotationKind} target annotation`}
                      aria-pressed={isExpanded}
                      onClick={() => onToggle(segment.key)}
                      className="grid w-full gap-2 px-3 py-2.5 text-left text-sm sm:grid-cols-[minmax(0,1fr)_5rem_5rem_8rem] sm:items-center"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: segment.color }}
                        />
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-950">
                            {segment.label}
                          </div>
                          <div className="text-xs text-slate-500">
                            #{index + 1}
                          </div>
                        </div>
                      </div>
                      <div className="font-semibold text-slate-700 sm:text-right">
                        {formatMetricDisplayValue(segment.value, metricView)}
                      </div>
                      <div className="text-slate-500 sm:text-right">
                        {formatShare(segment.share)}
                      </div>
                      <div className="text-slate-600 sm:text-right">
                        <div>{formatWhole(segment.siUnits)} SI</div>
                        <div className="text-xs">
                          INIU SI value {formatMoney(segment.siValueEur, "EUR")}
                        </div>
                      </div>
                    </button>
                    {isExpanded ? (
                      <TargetInlineDrilldown
                        dimension={dimension}
                        rows={drilldownRows}
                        selectedLabel={segment.label}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TargetInlineDrilldown({
  dimension,
  rows,
  selectedLabel
}: {
  dimension: TargetAnalysisDimension;
  rows: TargetDrilldownRow[];
  selectedLabel: string;
}) {
  const title =
    dimension === "product"
      ? "Channels / FD in this product"
      : "Products in this channel";

  return (
    <div
      aria-label={`${selectedLabel} child detail list`}
      className="border-t border-slate-100 bg-slate-50/80 px-3 pb-3 pt-2"
    >
      <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold text-slate-500">
        <span>{title}</span>
        <span>{rows.length} item(s)</span>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-md bg-white px-3 py-3 text-center text-xs text-slate-500">
          No planned data.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-slate-100 bg-white">
          <div className="min-w-[680px] divide-y divide-slate-100 text-xs">
            {rows.map((row) => (
              <div
                key={row.key}
                className="grid gap-2 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_5rem_5rem_8rem_4.5rem] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-950">
                    {row.label}
                  </div>
                  {dimension === "channel" ? (
                    <div className="mt-0.5 text-slate-500">
                      {row.secondaryLabel ?? "-"}
                    </div>
                  ) : null}
                </div>
                <div className="text-slate-600 sm:text-right">
                  {formatWhole(row.siUnits)} SI
                </div>
                <div className="text-slate-600 sm:text-right">
                  {formatWhole(row.soUnits)} SO
                </div>
                <div className="font-semibold text-slate-950 sm:text-right">
                  {formatMoney(row.siValueEur, "EUR")}
                </div>
                <div className="text-slate-600 sm:text-right">
                  {formatShare(row.share)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryTable({
  rows,
  title
}: {
  rows: BusinessPlanGroupMetric[];
  title: string;
}) {
  const totalRow = sumGroupMetrics(rows);

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-base font-semibold text-slate-950">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[720px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Group</th>
              <th className="px-3 py-2 text-right">SI</th>
              <th className="px-3 py-2 text-right">SO</th>
              <th className="px-3 py-2 text-right">INIU SI Value</th>
              <th className="px-3 py-2 text-right">GP</th>
              <th className="px-3 py-2 text-right">NP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  No data.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.key} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-950">
                    {row.label}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {formatWhole(row.siUnits)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {formatWhole(row.soUnits)}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-950">
                    {formatMoney(row.siValueEur, "EUR")}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {formatMoney(row.gpEur, "EUR")}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-950">
                    {formatMoney(row.netProfitEur, "EUR")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 ? (
            <tfoot className="border-t border-slate-200 bg-slate-50 text-sm">
              <tr>
                <td className="px-3 py-2 font-semibold text-slate-950">
                  Total
                </td>
                <td className="px-3 py-2 text-right font-semibold text-slate-950">
                  {formatWhole(totalRow.siUnits)}
                </td>
                <td className="px-3 py-2 text-right font-semibold text-slate-950">
                  {formatWhole(totalRow.soUnits)}
                </td>
                <td className="px-3 py-2 text-right font-semibold text-slate-950">
                  {formatMoney(totalRow.siValueEur, "EUR")}
                </td>
                <td className="px-3 py-2 text-right font-semibold text-slate-950">
                  {formatMoney(totalRow.gpEur, "EUR")}
                </td>
                <td className="px-3 py-2 text-right font-semibold text-slate-950">
                  {formatMoney(totalRow.netProfitEur, "EUR")}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </section>
  );
}

function ApprovalQueuePanel({
  items,
  onApprove,
  onOpen,
  onReject,
  selectedCountryCode,
  selectedYear
}: {
  items: BusinessPlanApprovalQueueItem[];
  onApprove: (item: BusinessPlanApprovalQueueItem) => void;
  onOpen: (item: BusinessPlanApprovalQueueItem) => void;
  onReject: (item: BusinessPlanApprovalQueueItem) => void;
  selectedCountryCode: string | null;
  selectedYear: number;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-950">
            BP Approval Inbox
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Submitted country plans waiting for BP approval.
          </p>
        </div>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
          {items.length} item(s)
        </span>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-[760px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">BP</th>
              <th className="px-3 py-2">Stage</th>
              <th className="px-3 py-2 text-right">Lines</th>
              <th className="px-3 py-2">Submitted by</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => {
              const isCurrent =
                item.countryCode === selectedCountryCode &&
                item.planYear === selectedYear;
              return (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-semibold text-slate-950">
                    {item.planYear} · {item.countryCode}
                    {isCurrent ? (
                      <span className="ml-2 rounded-md bg-cyan-50 px-2 py-0.5 text-xs font-semibold text-cyan-700">
                        open
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {item.stage === "first" ? "First approval" : "Final approval"}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {formatWhole(item.entryCount)}
                  </td>
                  <td className="px-3 py-2 text-slate-500">
                    {item.submittedByEmail ?? "-"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onOpen(item)}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-white"
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => onApprove(item)}
                        className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => onReject(item)}
                        className="rounded-md border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function KpiCard({
  icon,
  label,
  subValue,
  tone,
  value
}: {
  icon: ReactNode;
  label: string;
  subValue: string;
  tone: "amber" | "cyan" | "emerald" | "ink";
  value: string;
}) {
  const toneClass = kpiToneClass(tone);

  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </div>
          <div className="mt-1 truncate text-xl font-semibold text-slate-950">
            {value}
          </div>
        </div>
        <div
          className={`grid h-9 w-9 place-items-center rounded-md border shadow-sm ${toneClass}`}
        >
          {icon}
        </div>
      </div>
      <div className="mt-2 truncate text-sm font-medium text-slate-500">
        {subValue}
      </div>
    </div>
  );
}

function kpiToneClass(tone: "amber" | "cyan" | "emerald" | "ink") {
  if (tone === "cyan") {
    return "border-cyan-100 bg-cyan-50 text-cyan-700";
  }
  if (tone === "emerald") {
    return "border-emerald-100 bg-emerald-50 text-emerald-700";
  }
  if (tone === "amber") {
    return "border-amber-100 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-950 text-white";
}

function InputStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 truncate text-base font-semibold text-slate-950">
        {value}
      </div>
    </div>
  );
}

function Field({
  label,
  onChange,
  step = "1",
  value
}: {
  label: string;
  onChange: (value: string) => void;
  step?: string;
  value: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <input
        type="number"
        min="0"
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm"
      />
    </label>
  );
}

function TextField({
  label,
  onChange,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm"
      />
    </label>
  );
}

function SelectField({
  disabled = false,
  label,
  onChange,
  options,
  value
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
      <span className="truncate">{label}</span>
      <select
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full min-w-0 min-h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function EditorNumberInput({
  ariaLabel,
  onChange,
  step = "1",
  value
}: {
  ariaLabel: string;
  onChange: (value: string) => void;
  step?: string;
  value: string;
}) {
  return (
    <input
      aria-label={ariaLabel}
      type="number"
      min="0"
      step={step}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-full min-w-24 rounded-md border border-emerald-200 bg-white px-2 text-right text-sm font-medium text-slate-950 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
    />
  );
}

function FilePicker({
  fileName,
  inputRef,
  onFileNameChange
}: {
  fileName: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onFileNameChange: (fileName: string) => void;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      <span>Excel workbook</span>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        onChange={(event) =>
          onFileNameChange(event.target.files?.[0]?.name ?? "")
        }
        className="sr-only"
      />
      <span className="inline-flex min-h-10 cursor-pointer items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
        {fileName || "Choose .xlsx file"}
      </span>
    </label>
  );
}

function buildEditorRows(
  baseRows: BusinessPlanBaseRow[],
  state: InputEditorState
) {
  const year = parseWholeNumber(state.year, currentYear);
  const filteredRows = baseRows.filter((row) => rowMatchesEditorState(row, state));
  const rowMonths =
    state.month === "ALL"
      ? months.map((month) => month.month)
      : [parseWholeNumber(state.month, 1)];

  return filteredRows.flatMap((baseRow) =>
    rowMonths.map((month) => ({
      baseRow,
      identity: lineIdentity({
        id: "",
        month,
        promoDiscountPercent: 0,
        rowKey: baseRow.key,
        siUnits: 0,
        soUnits: 0,
        year
      }),
      month
    }))
  );
}

function rowMatchesEditorState(
  row: BusinessPlanBaseRow,
  state: InputEditorState
) {
  if (state.countryCode !== "ALL" && row.countryCode !== state.countryCode) {
    return false;
  }
  if (state.channelKey !== "ALL" && channelKeyForRow(row) !== state.channelKey) {
    return false;
  }
  if (state.productKey !== "ALL" && productKeyForRow(row) !== state.productKey) {
    return false;
  }

  return true;
}

function buildCountryOptions(baseRows: BusinessPlanBaseRow[]) {
  return [...new Set(baseRows.map((row) => row.countryCode))].sort();
}

function buildChannelOptions(
  baseRows: BusinessPlanBaseRow[],
  countryCode: string
) {
  const channels = new Map<string, string>();

  for (const row of baseRows) {
    if (countryCode !== "ALL" && row.countryCode !== countryCode) {
      continue;
    }
    const key = channelKeyForRow(row);
    channels.set(
      key,
      `${row.countryCode} · ${row.channelName} · ${row.fdName} · ${row.incoterms}`
    );
  }

  return [...channels.entries()]
    .map(([value, label]) => ({ label, value }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function buildProductOptions(
  baseRows: BusinessPlanBaseRow[],
  state: InputEditorState
) {
  const products = new Map<string, string>();

  for (const row of baseRows) {
    if (state.countryCode !== "ALL" && row.countryCode !== state.countryCode) {
      continue;
    }
    if (state.channelKey !== "ALL" && channelKeyForRow(row) !== state.channelKey) {
      continue;
    }
    products.set(productKeyForRow(row), `${row.model} · ${row.productName}`);
  }

  return [...products.entries()]
    .map(([value, label]) => ({ label, value }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function buildBpOnlyTargetProductOptions(
  baseRows: BusinessPlanBaseRow[],
  countryCode: string
) {
  const products = new Map<string, string>();

  for (const row of baseRows) {
    if (row.key.startsWith("bp-assumption:") || row.countryCode !== countryCode) {
      continue;
    }
    products.set(productKeyForRow(row), `${row.model} · ${row.productName}`);
  }

  return [...products.entries()]
    .map(([value, label]) => ({ label, value }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function findBpOnlyProductRow(
  baseRows: BusinessPlanBaseRow[],
  countryCode: string,
  productKey: string
) {
  return baseRows.find(
    (row) =>
      !row.key.startsWith("bp-assumption:") &&
      row.countryCode === countryCode &&
      productKeyForRow(row) === productKey
  );
}

function buildSavedChannelOptions(lines: BusinessPlanLine[]) {
  const channels = new Map<string, string>();

  for (const line of lines) {
    channels.set(
      channelFilterKeyForLine(line),
      `${line.channelName} · ${line.fdName} · ${line.incoterms}`
    );
  }

  return [...channels.entries()]
    .map(([value, label]) => ({ label, value }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function buildSavedProductOptions(
  lines: BusinessPlanLine[],
  channelFilter: string
) {
  const products = new Map<string, string>();

  for (const line of lines) {
    if (
      channelFilter !== "ALL" &&
      channelFilterKeyForLine(line) !== channelFilter
    ) {
      continue;
    }
    products.set(productFilterKeyForLine(line), `${line.model} · ${line.productName}`);
  }

  return [...products.entries()]
    .map(([value, label]) => ({ label, value }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function channelFilterKeyForLine(line: BusinessPlanLine) {
  return `${line.countryCode}|${line.channelName}|${line.fdName}|${line.incoterms}`;
}

function productFilterKeyForLine(line: BusinessPlanLine) {
  return line.model;
}

function buildTimePeriodOptions(timeDimension: TimeDimension) {
  if (timeDimension === "QUARTERLY") {
    return [
      { label: "All quarters", value: "ALL" },
      { label: "Q1", value: "Q1" },
      { label: "Q2", value: "Q2" },
      { label: "Q3", value: "Q3" },
      { label: "Q4", value: "Q4" }
    ];
  }

  return [
    { label: "All months", value: "ALL" },
    ...months.map((month) => ({
      label: month.label,
      value: `MONTH_${month.month}`
    }))
  ];
}

function lineMatchesTimePeriod(
  line: BusinessPlanLine,
  selectedTimePeriod: TimePeriodFilter
) {
  if (selectedTimePeriod === "ALL") {
    return true;
  }

  if (selectedTimePeriod.startsWith("MONTH_")) {
    return line.month === parseWholeNumber(selectedTimePeriod.slice(6), 0);
  }

  return line.quarter === selectedTimePeriod;
}

function buildTimeTrendRows(
  summary: ReturnType<typeof summarizeBusinessPlan>,
  timeDimension: TimeDimension,
  selectedTimePeriod: TimePeriodFilter
) {
  const periods =
    timeDimension === "MONTHLY"
      ? months.map((month) => ({
          key: month.label,
          label: month.label.slice(0, 3),
          metricLabel: month.label,
          value: `MONTH_${month.month}` as TimePeriodFilter
        }))
      : (["Q1", "Q2", "Q3", "Q4"] as const).map((quarter) => ({
          key: quarter,
          label: quarter,
          metricLabel: quarter,
          value: quarter as TimePeriodFilter
        }));
  const visiblePeriods =
    selectedTimePeriod === "ALL"
      ? periods
      : periods.filter((period) => period.value === selectedTimePeriod);
  const groupedMetrics =
    timeDimension === "MONTHLY" ? summary.byMonth : summary.byQuarter;

  return visiblePeriods.map((period) => {
    const metric = groupedMetrics.find(
      (item) => item.label === period.metricLabel
    );

    return {
      key: period.key,
      label: period.label,
      ...metricZero,
      ...metric
    };
  });
}

function timePeriodFilterLabel(
  selectedTimePeriod: TimePeriodFilter,
  timeDimension: TimeDimension
) {
  if (selectedTimePeriod === "ALL") {
    return timeDimension === "MONTHLY" ? "annual" : "annual";
  }

  if (selectedTimePeriod.startsWith("MONTH_")) {
    return monthLabel(parseWholeNumber(selectedTimePeriod.slice(6), 1));
  }

  return selectedTimePeriod;
}

function metricDisplayValue(
  metric: BusinessPlanMetric,
  mode: MetricDisplayMode
) {
  return mode === "units" ? metric.siUnits : metric.siValueEur;
}

function buildCategoryMixSegments(
  categories: BusinessPlanGroupMetric[],
  mode: MetricDisplayMode
): CategoryMixSegment[] {
  const sortedCategories = categories
    .map((category) => ({
      key: category.key,
      label: category.label,
      value: metricDisplayValue(category, mode)
    }))
    .filter((category) => category.value > 0)
    .sort(
      (left, right) =>
        right.value - left.value || left.label.localeCompare(right.label)
    );
  const visibleCategories = sortedCategories.slice(0, 5);
  const otherValue = sortedCategories
    .slice(5)
    .reduce((sum, category) => sum + category.value, 0);
  const totalValue =
    sortedCategories.reduce((sum, category) => sum + category.value, 0) || 1;
  const segmentInputs =
    otherValue > 0
      ? [
          ...visibleCategories,
          {
            key: "others",
            label: "Others",
            value: otherValue
          }
        ]
      : visibleCategories;

  return segmentInputs.map((category, index) => ({
    ...category,
    share: category.value / totalValue,
    color: categoryMixColors[index % categoryMixColors.length]
  }));
}

function buildPieGradient(segments: CategoryMixSegment[]) {
  let cursor = 0;
  const stops = segments.map((segment) => {
    const start = cursor;
    const end = cursor + segment.share * 100;
    cursor = end;

    return `${segment.color} ${start}% ${end}%`;
  });

  return stops.length > 0
    ? `conic-gradient(${stops.join(", ")})`
    : "conic-gradient(#e2e8f0 0% 100%)";
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function categoryAnnotationStyle(index: number, total: number) {
  const angle = total === 1 ? -25 : -90 + ((index + 0.5) * 360) / total;
  const radians = (angle * Math.PI) / 180;
  const x = 50 + Math.cos(radians) * 34;
  const y = 50 + Math.sin(radians) * 34;

  return {
    left: `${x}%`,
    top: `${y}%`,
    transform: "translate(-50%, -50%)"
  };
}

function monthlyPrimaryMetricValue(
  metric: BusinessPlanMetric,
  mode: MetricDisplayMode
) {
  return mode === "units" ? metric.siUnits : metric.siValueEur;
}

function formatMetricDisplayValue(value: number, mode: MetricDisplayMode) {
  return mode === "units" ? formatWhole(value) : formatMoney(value, "EUR");
}

function formatChartLabelValue(value: number, mode: MetricDisplayMode) {
  if (mode === "units") {
    return formatWhole(value);
  }

  return new Intl.NumberFormat("en-GB", {
    currency: "EUR",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
    notation: value >= 1000 ? "compact" : "standard",
    style: "currency"
  }).format(value);
}

function formatShare(value: number) {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
    style: "percent"
  }).format(value);
}

function barHeight(value: number, maxValue: number) {
  if (value <= 0 || maxValue <= 0) {
    return "0%";
  }

  return `${Math.max(4, (value / maxValue) * 100)}%`;
}

function buildChannelTargetRows(lines: BusinessPlanLine[]) {
  const groups = new Map<
    string,
    {
      label: string;
      lines: BusinessPlanLine[];
    }
  >();

  for (const line of lines) {
    const key = channelFilterKeyForLine(line);
    const label = `${line.channelName} · ${line.fdName}`;
    const current = groups.get(key);

    if (current) {
      current.lines.push(line);
      continue;
    }

    groups.set(key, {
      label,
      lines: [line]
    });
  }

  return [...groups.entries()].map(([key, group]) => ({
    key,
    label: group.label,
    ...sumBusinessPlanMetrics(group.lines)
  }));
}

function buildProductTargetRows(lines: BusinessPlanLine[]) {
  const groups = new Map<
    string,
    {
      label: string;
      lines: BusinessPlanLine[];
    }
  >();

  for (const line of lines) {
    const key = productFilterKeyForLine(line);
    const label = `${line.model} · ${line.productName}`;
    const current = groups.get(key);

    if (current) {
      current.lines.push(line);
      continue;
    }

    groups.set(key, {
      label,
      lines: [line]
    });
  }

  return [...groups.entries()].map(([key, group]) => ({
    key,
    label: group.label,
    ...sumBusinessPlanMetrics(group.lines)
  }));
}

function buildProductChannelDrilldownRows(
  lines: BusinessPlanLine[],
  productKey: string
) {
  return buildTargetDrilldownRows(
    lines.filter((line) => productFilterKeyForLine(line) === productKey),
    (line) => ({
      key: channelFilterKeyForLine(line),
      label: `${line.channelName} · ${line.fdName}`
    })
  );
}

function buildChannelProductDrilldownRows(
  lines: BusinessPlanLine[],
  channelKey: string
) {
  return buildTargetDrilldownRows(
    lines.filter((line) => channelFilterKeyForLine(line) === channelKey),
    (line) => ({
      key: productFilterKeyForLine(line),
      label: `${line.model} · ${line.productName}`,
      secondaryLabel: line.category
    })
  );
}

function buildTargetDrilldownRows(
  lines: BusinessPlanLine[],
  groupForLine: (line: BusinessPlanLine) => {
    key: string;
    label: string;
    secondaryLabel?: string;
  }
): TargetDrilldownRow[] {
  const groups = new Map<
    string,
    {
      label: string;
      secondaryLabel?: string;
      lines: BusinessPlanLine[];
    }
  >();

  for (const line of lines) {
    const group = groupForLine(line);
    const current = groups.get(group.key);

    if (current) {
      current.lines.push(line);
      continue;
    }

    groups.set(group.key, {
      label: group.label,
      lines: [line],
      secondaryLabel: group.secondaryLabel
    });
  }

  const rows = [...groups.entries()]
    .map(([key, group]) => ({
      key,
      label: group.label,
      secondaryLabel: group.secondaryLabel,
      ...sumBusinessPlanMetrics(group.lines)
    }))
    .filter(
      (row) =>
        row.siUnits > 0 || row.soUnits > 0 || Math.abs(row.siValueEur) > 0
    )
    .sort(
      (left, right) =>
        right.siUnits - left.siUnits || left.label.localeCompare(right.label)
    );
  const totalSiUnits = rows.reduce((sum, row) => sum + row.siUnits, 0) || 1;

  return rows.map((row, index) => ({
    ...row,
    color: categoryMixColors[index % categoryMixColors.length],
    share: row.siUnits / totalSiUnits,
    value: row.siUnits
  }));
}

function buildTargetMixSegments(
  rows: BusinessPlanGroupMetric[],
  mode: MetricDisplayMode
): TargetMixSegment[] {
  const sortedRows = rows
    .map((row) => ({
      ...row,
      value: metricDisplayValue(row, mode)
    }))
    .filter((row) => row.value > 0)
    .sort(
      (left, right) =>
        right.value - left.value || left.label.localeCompare(right.label)
    );
  const visibleRows = sortedRows.slice(0, 5);
  const otherRows = sortedRows.slice(5);
  const totalValue = sortedRows.reduce((sum, row) => sum + row.value, 0) || 1;
  const segmentInputs =
    otherRows.length > 0
      ? [
          ...visibleRows,
          {
            key: "others",
            label: "Others",
            ...sumGroupMetrics(otherRows),
            value: otherRows.reduce((sum, row) => sum + row.value, 0)
          }
        ]
      : visibleRows;

  return segmentInputs.map((row, index) => ({
    ...row,
    share: row.value / totalValue,
    color: categoryMixColors[index % categoryMixColors.length]
  }));
}

function buildTargetContributionRows(
  rows: BusinessPlanGroupMetric[],
  mode: MetricDisplayMode
): TargetMixSegment[] {
  const sortedRows = rows
    .map((row) => ({
      ...row,
      value: metricDisplayValue(row, mode)
    }))
    .filter((row) => row.value > 0)
    .sort(
      (left, right) =>
        right.value - left.value || left.label.localeCompare(right.label)
    );
  const totalValue = sortedRows.reduce((sum, row) => sum + row.value, 0) || 1;

  return sortedRows.map((row, index) => ({
    ...row,
    share: row.value / totalValue,
    color: categoryMixColors[index % categoryMixColors.length]
  }));
}

function sumGroupMetrics(rows: BusinessPlanGroupMetric[]) {
  return rows.reduce<BusinessPlanMetric>(
    (sum, row) => ({
      siUnits: sum.siUnits + row.siUnits,
      soUnits: sum.soUnits + row.soUnits,
      siValueEur: sum.siValueEur + row.siValueEur,
      soValueEur: sum.soValueEur + row.soValueEur,
      kaSiValueEur: sum.kaSiValueEur + row.kaSiValueEur,
      gpEur: sum.gpEur + row.gpEur,
      promoRebateEur: sum.promoRebateEur + row.promoRebateEur,
      netProfitEur: sum.netProfitEur + row.netProfitEur
    }),
    { ...metricZero }
  );
}

function sumBusinessPlanMetrics(lines: BusinessPlanLine[]) {
  return lines.reduce<BusinessPlanMetric>(
    (sum, line) => ({
      siUnits: sum.siUnits + line.siUnits,
      soUnits: sum.soUnits + line.soUnits,
      siValueEur: sum.siValueEur + line.siValueEur,
      soValueEur: sum.soValueEur + line.soValueEur,
      kaSiValueEur: sum.kaSiValueEur + line.kaSiValueEur,
      gpEur: sum.gpEur + line.gpEur,
      promoRebateEur: sum.promoRebateEur + line.promoRebateEur,
      netProfitEur: sum.netProfitEur + line.netProfitEur
    }),
    { ...metricZero }
  );
}

function channelKeyForRow(row: BusinessPlanBaseRow) {
  return `${row.countryCode}|${row.channelName}|${row.fdName}|${row.incoterms}`;
}

function productKeyForRow(row: BusinessPlanBaseRow) {
  return row.model;
}

function draftLinesToEditorValues(
  lines: BusinessPlanDraftLine[],
  baseRows: BusinessPlanBaseRow[]
) {
  const rowsByKey = new Map(baseRows.map((row) => [row.key, row]));

  return Object.fromEntries(
    lines.map((line) => {
      const baseRow = rowsByKey.get(line.rowKey);
      return [
        lineIdentity(line),
        {
          promoDiscountPercent: String(roundPercent(line.promoDiscountPercent * 100)),
          promoPriceLocal:
            typeof line.promoPriceLocal === "number"
              ? formatInputNumber(line.promoPriceLocal)
              : baseRow
                ? priceInputFromDiscount(
                    String(roundPercent(line.promoDiscountPercent * 100)),
                    baseRow
                  )
                : "",
          siUnits: String(line.siUnits),
          soUnits: String(line.soUnits)
        }
      ];
    })
  );
}

function getEditorCellValue(
  identity: string,
  currentValues: Record<string, InputCellDraft>,
  existingValues: Record<string, InputCellDraft>,
  row: BusinessPlanBaseRow
) {
  return (
    currentValues[identity] ??
    existingValues[identity] ??
    defaultCellDraft(row)
  );
}

function defaultCellDraft(row: BusinessPlanBaseRow): InputCellDraft {
  return {
    promoDiscountPercent: "0",
    promoPriceLocal:
      row.rrpLocal === null ? "" : formatInputNumber(row.rrpLocal),
    siUnits: "0",
    soUnits: "0"
  };
}

function emptyCellDraft(): InputCellDraft {
  return {
    promoDiscountPercent: "0",
    promoPriceLocal: "",
    siUnits: "0",
    soUnits: "0"
  };
}

function mergeEditorLines(
  current: BusinessPlanDraftLine[],
  linesToSave: InputEditorSaveLine[]
) {
  const affectedIdentities = new Set(linesToSave.map(lineIdentity));
  const previousByIdentity = new Map(
    current.map((line) => [lineIdentity(line), line])
  );
  const keptLines = current.filter(
    (line) => !affectedIdentities.has(lineIdentity(line))
  );
  const nextLines = linesToSave.flatMap((line) => {
    if (line.isEmpty) {
      return [];
    }

    const previous = previousByIdentity.get(lineIdentity(line));
    return [
      {
        id:
          previous?.id ??
          `bp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        rowKey: line.rowKey,
        year: line.year,
        month: line.month,
        promoPriceLocal: line.promoPriceLocal,
        siUnits: line.siUnits,
        soUnits: line.soUnits,
        promoDiscountPercent: line.promoDiscountPercent,
        assumption: line.assumption,
        channelProfileId: line.channelProfileId ?? null
      }
    ];
  });

  return [...keptLines, ...nextLines];
}

function lineIdentity(line: BusinessPlanDraftLine) {
  return `${line.year}|${line.month}|${line.rowKey}`;
}

function assumptionFromBaseRow(
  row: BusinessPlanBaseRow
): BusinessPlanTemporaryAssumption | undefined {
  if (!row.key.startsWith("bp-assumption:")) {
    return undefined;
  }

  return {
    countryCode: row.countryCode,
    retailerName: row.retailerName,
    fdName: row.fdName,
    incoterms: row.incoterms,
    productSku: row.model,
    productName: row.productName,
    category: row.category,
    currency: row.currency,
    rrpLocal: row.rrpLocal,
    rrpEur: row.rrpEur,
    kaBuyingMargin: row.kaBuyingMargin,
    kaFrontMargin: row.kaFrontMargin,
    kaBackMargin: row.kaBackMargin,
    fdMargin: row.fdMargin,
    bomCostEur: row.bomCost,
    logisticsCostEur: row.logisticsCost
  };
}

function parseWholeNumber(value: string, fallback: number) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback;
}

function parseOptionalNumber(value: string) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parsePercentInput(value: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.min(100, Math.max(0, parsed)) / 100;
}

function clientProfileFromOption(
  profile: BusinessPlanChannelProfileOption
): BusinessPlanClientChannelProfile {
  return {
    id: profile.id,
    planYear: profile.planYear,
    countryCode: profile.countryCode,
    retailerName: profile.retailerName,
    fdName: profile.fdName,
    incoterms: profile.incoterms,
    kaBuyingMargin: profile.kaBuyingMargin,
    kaFrontMargin: profile.kaFrontMargin,
    kaBackMargin: profile.kaBackMargin,
    fdMargin: profile.fdMargin,
    productOverrides: profile.productOverrides.map((override) => ({
      id: override.id,
      channelProfileId: override.channelProfileId,
      productSku: override.productSku,
      rrpLocal: override.rrpLocal,
      rrpEur: override.rrpEur,
      currency: override.currency,
      kaBuyingMargin: override.kaBuyingMargin,
      kaFrontMargin: override.kaFrontMargin,
      kaBackMargin: override.kaBackMargin,
      fdMargin: override.fdMargin,
      bomCost: override.bomCost,
      logisticsCost: override.logisticsCost
    }))
  };
}

function sortBusinessPlanChannelProfiles(
  profiles: BusinessPlanClientChannelProfile[]
) {
  return [...profiles].sort((left, right) =>
    businessPlanChannelProfileLabel(left).localeCompare(
      businessPlanChannelProfileLabel(right)
    )
  );
}

function upsertChannelProfile(
  current: BusinessPlanClientChannelProfile[],
  nextProfile: BusinessPlanClientChannelProfile
) {
  const nextKey = channelProfileBusinessKey(nextProfile);
  const updated = current.filter(
    (profile) => profile.id !== nextProfile.id && channelProfileBusinessKey(profile) !== nextKey
  );

  return [...updated, nextProfile].sort((left, right) =>
    businessPlanChannelProfileLabel(left).localeCompare(
      businessPlanChannelProfileLabel(right)
    )
  );
}

function recalculateProfileDraftLines(
  lines: BusinessPlanDraftLine[],
  profiles: BusinessPlanClientChannelProfile[],
  data: ReferenceData
) {
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));

  return lines.map((line) => {
    if (!line.channelProfileId) {
      return line;
    }

    const profile = profilesById.get(line.channelProfileId);
    const productSku = line.assumption?.productSku;
    if (!profile || !productSku) {
      return line;
    }

    const override =
      profile.productOverrides.find(
        (item) => item.productSku.toLowerCase() === productSku.toLowerCase()
      ) ?? null;
    const assumption = buildBusinessPlanProfileAssumption({
      data,
      profile,
      productSku,
      override
    });
    if (!assumption) {
      return line;
    }

    return {
      ...line,
      rowKey: temporaryAssumptionRowKey(assumption),
      assumption
    };
  });
}

function channelProfileBusinessKey(profile: BusinessPlanChannelProfileDraft) {
  return [
    profile.planYear,
    profile.countryCode,
    profile.retailerName,
    profile.fdName,
    profile.incoterms
  ]
    .map((value) => normalizeBusinessInput(String(value)))
    .join("|");
}

function normalizeBusinessInput(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function roundPercent(value: number) {
  return Math.round(value * 10) / 10;
}

function discountInputFromPrice(value: string, row: BusinessPlanBaseRow) {
  const price = parseOptionalNumber(value);

  if (price === null || row.rrpLocal === null || row.rrpLocal <= 0) {
    return "0";
  }

  return String(roundPercent(Math.max(0, 1 - price / row.rrpLocal) * 100));
}

function priceInputFromDiscount(value: string, row: BusinessPlanBaseRow) {
  if (row.rrpLocal === null) {
    return "";
  }

  const discount = parsePercentInput(value);

  return formatInputNumber(Math.max(0, row.rrpLocal * (1 - discount)));
}

function promoPriceEurFromInput(
  value: InputCellDraft,
  row: BusinessPlanBaseRow
) {
  if (row.rrpEur === null) {
    return null;
  }

  const localPrice = parseOptionalNumber(value.promoPriceLocal);
  if (localPrice !== null && row.rrpLocal !== null && row.rrpLocal > 0) {
    return Math.round((localPrice / row.rrpLocal) * row.rrpEur * 100) / 100;
  }

  const discount = parsePercentInput(value.promoDiscountPercent);
  return Math.round(row.rrpEur * (1 - discount) * 100) / 100;
}

function formatInputNumber(value: number) {
  return String(Math.round(value * 100) / 100);
}

function formatWhole(value: number) {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 0
  }).format(value);
}

function warningClass(level: string | null) {
  const base =
    "inline-flex rounded-md border px-2 py-1 text-xs font-semibold uppercase";

  if (level === "GOOD") {
    return `${base} border-emerald-200 bg-emerald-50 text-emerald-700`;
  }

  if (level === "WARNING") {
    return `${base} border-amber-200 bg-amber-50 text-amber-700`;
  }

  return `${base} border-rose-200 bg-rose-50 text-rose-700`;
}

function businessPlanLockedReason(status: PromotionPlanStatus) {
  if (status === "SUBMITTED") {
    return "submission";
  }
  if (status === "FIRST_APPROVED") {
    return "first approval";
  }
  if (status === "APPROVED") {
    return "approval";
  }

  return null;
}

function bpStatusLabel(status: PromotionPlanStatus) {
  const labels: Record<PromotionPlanStatus, string> = {
    DRAFT: "Draft",
    SUBMITTED: "Submitted",
    FIRST_APPROVED: "First approved",
    APPROVED: "Approved",
    REJECTED: "Rejected"
  };

  return labels[status];
}

function bpStatusClass(status: PromotionPlanStatus) {
  const base =
    "inline-flex h-10 items-center rounded-md border px-3 text-sm font-semibold";

  if (status === "APPROVED") {
    return `${base} border-emerald-200 bg-emerald-50 text-emerald-800`;
  }
  if (status === "SUBMITTED" || status === "FIRST_APPROVED") {
    return `${base} border-cyan-200 bg-cyan-50 text-cyan-800`;
  }
  if (status === "REJECTED") {
    return `${base} border-rose-200 bg-rose-50 text-rose-700`;
  }

  return `${base} border-slate-200 bg-slate-50 text-slate-700`;
}

function statusClass(status: ImportResult["status"]) {
  return status === "success"
    ? "mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
    : "mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800";
}

function resultClass(status: SaveResult["status"] | StatusActionResult["status"]) {
  return status === "success"
    ? "mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
    : "mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800";
}

function IconBase({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function TargetIcon() {
  return (
    <IconBase>
      <path d="M12 3v3" />
      <path d="M12 18v3" />
      <path d="M3 12h3" />
      <path d="M18 12h3" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </IconBase>
  );
}

function EuroIcon() {
  return (
    <IconBase>
      <path d="M18 5.5A7 7 0 1 0 18 18.5" />
      <path d="M5 10h9" />
      <path d="M5 14h8" />
    </IconBase>
  );
}

function ChartIcon() {
  return (
    <IconBase>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 16v-5" />
      <path d="M12 16V8" />
      <path d="M16 16v-3" />
    </IconBase>
  );
}

function RebateIcon() {
  return (
    <IconBase>
      <path d="M20 12V7a2 2 0 0 0-2-2h-5" />
      <path d="M4 12v5a2 2 0 0 0 2 2h5" />
      <path d="m15 3-2 2 2 2" />
      <path d="m9 21 2-2-2-2" />
      <path d="M9 9h.01" />
      <path d="M15 15h.01" />
      <path d="m9 15 6-6" />
    </IconBase>
  );
}

function PlusIcon() {
  return (
    <IconBase>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </IconBase>
  );
}

function DownloadIcon() {
  return (
    <IconBase>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </IconBase>
  );
}

function UploadIcon() {
  return (
    <IconBase>
      <path d="M12 21V9" />
      <path d="m7 14 5-5 5 5" />
      <path d="M5 3h14" />
    </IconBase>
  );
}

function SaveIcon() {
  return (
    <IconBase>
      <path d="M5 3h12l2 2v16H5z" />
      <path d="M8 3v6h8" />
      <path d="M8 17h8" />
    </IconBase>
  );
}

function SendIcon() {
  return (
    <IconBase>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </IconBase>
  );
}

function CheckIcon() {
  return (
    <IconBase>
      <path d="m20 6-11 11-5-5" />
    </IconBase>
  );
}
