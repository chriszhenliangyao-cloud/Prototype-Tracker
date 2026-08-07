"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  buildPromotionRowsFromBaseRows,
  normalRowMatchesFilters,
  type CalculatorFilters,
  type NormalTableRow,
  type PromotionInputsByRow
} from "@/lib/calculatorRows";
import {
  synchronizeProductIdentityFilters,
  type CalculatorFilterField
} from "@/lib/calculatorFilterOptions";
import {
  formatEuropeanDate,
  formatEuropeanDateTime,
  formatMoney,
  formatPercent
} from "@/lib/format";
import {
  buildPromotionPlanBaseRows,
  buildPromotionPlanEntryBaseRows,
  getPromotionPlanPreLaunchConfigurationIssues,
  entriesToPromotionInputs,
  promotionPlanAutosaveBaseline,
  promotionPlanEntryIdFromRowKey,
  promotionPlanEntryRowKey,
  promotionPlanBusinessKeyForEntry,
  promotionPlanBusinessKeyForRow,
  promotionPlanMonthKey
} from "@/lib/promotionPlanShared";
import {
  defaultPromotionPlanPeriod,
  normalizePromotionPlanPeriod,
  parsePromotionDateInput
} from "@/lib/promotionPlanDates";
import {
  findPromotionPlanPeriodOverlap,
  promotionPlanPeriodOverlapMessage
} from "@/lib/promotionPlanPeriods";
import {
  getPromotionPlanEditState,
  hasPromotionCountryAccess,
  isPromotionPlanDeadlineLocked
} from "@/lib/promotionPlanAccess";
import {
  canBypassPromotionPlanLocks,
  canManagePromotionPlanApprovalHistory,
  canViewAllCountries
} from "@/lib/auth/roles";
import type { NewLaunchedProductReview } from "@/lib/promotionPlanNewLaunch";
import type {
  PromotionPlanApprovalQueueItem,
  PromotionPlanArchiveOption,
  PromotionPlanEmailNotificationOption,
  PromotionPlanEntryOption,
  PromotionPlanMonthStatusOption,
  PromotionPlanStatus,
  ReferenceData,
  UserRole
} from "@/lib/types";
import { EuropeanDateInput } from "./EuropeanDateInput";
import { usePersistentState } from "./usePersistentState";
import { PromotionMapDialog } from "./PromotionMapDialog";
import { PromotionWideTable } from "./WideCalculatorTable";
import { WideTableFilters } from "./WideTableFilters";
import { AutosaveStatus } from "./AutosaveStatus";
import { useAutosaveDraft } from "./useAutosaveDraft";

type PromotionInputField =
  | "promoRrpLocal"
  | "promoVolume"
  | "promoFrontMargin"
  | "dealType"
  | "promoFdMargin"
  | "promotionName"
  | "dealNote"
  | "promoStartDate"
  | "promoEndDate";

type ApiArchive = {
  id: string;
  driveStatus?: string;
  driveUrl?: string | null;
};

type ApiEmailNotification = {
  status: "SENT" | "FAILED" | "PENDING" | "NOT_CONFIGURED";
  toEmails?: string[];
  ccEmails?: string[];
  errorMessage?: string | null;
};

type ApiResult = {
  status?: string;
  message?: string;
  saved?: number;
  deleted?: number;
  imported?: number;
  copied?: number;
  skipped?: number;
  updated?: number;
  replaced?: number;
  monthKeys?: string[];
  errors?: Array<{ sheetName?: string; rowNumber?: number; message: string }>;
  archive?: ApiArchive | null;
  emailNotification?: ApiEmailNotification | null;
  newLaunchedProducts?: NewLaunchedProductReview[];
};

function FilePicker({
  inputRef,
  label,
  fileName,
  disabled,
  onFileNameChange
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  label: string;
  fileName: string;
  disabled: boolean;
  onFileNameChange: (fileName: string) => void;
}) {
  return (
    <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      <span>{label}</span>
      <span
        className={`flex h-8 min-w-0 items-center gap-2 rounded-md border border-slate-300 bg-white px-2 text-[11px] normal-case text-slate-700 ${
          disabled
            ? "cursor-not-allowed bg-slate-100 text-slate-400"
            : "cursor-pointer hover:bg-slate-50"
        }`}
      >
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept=".xlsx"
          disabled={disabled}
          onChange={(event) =>
            onFileNameChange(event.target.files?.[0]?.name ?? "")
          }
        />
        <span className="shrink-0 rounded bg-slate-100 px-2 py-1 font-semibold text-slate-700">
          Choose file
        </span>
        <span className="min-w-0 truncate font-medium text-slate-500">
          {fileName || "No file selected"}
        </span>
      </span>
    </label>
  );
}

export function PromotionCalculator({
  data,
  planEntries,
  monthStatuses,
  approvalQueue,
  selectedYear,
  selectedMonth,
  canSavePlan,
  canDownloadPlanHistory,
  canApprovePlan,
  canFirstApprovePlan,
  canFinalApprovePlan,
  role,
  accessibleCountryCodes,
  reviewCountryCode,
  newLaunchedProducts,
  recentApprovalArchives,
  recentEmailNotifications,
  userEmail
}: {
  data: ReferenceData;
  planEntries: PromotionPlanEntryOption[];
  monthStatuses: PromotionPlanMonthStatusOption[];
  approvalQueue: PromotionPlanApprovalQueueItem[];
  recentApprovalArchives: PromotionPlanArchiveOption[];
  recentEmailNotifications: PromotionPlanEmailNotificationOption[];
  newLaunchedProducts: NewLaunchedProductReview[];
  selectedYear: number;
  selectedMonth: number;
  canSavePlan: boolean;
  canDownloadPlanHistory: boolean;
  canApprovePlan: boolean;
  canFirstApprovePlan: boolean;
  canFinalApprovePlan: boolean;
  role: UserRole;
  userEmail: string | null;
  accessibleCountryCodes: string[];
  reviewCountryCode: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname() || "";
  const promotionHref = pathname.startsWith("/platform/")
    ? "/platform/collaboration/monthly-approvals"
    : "/promotion";
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const historicalFileInputRef = useRef<HTMLInputElement | null>(null);
  const month = useMemo(
    () => ({ year: selectedYear, month: selectedMonth }),
    [selectedMonth, selectedYear]
  );
  const monthKey = promotionPlanMonthKey(month);
  const [filters, setFilters] = usePersistentState<CalculatorFilters>(
    "promotion-plan-filters-v2",
    {}
  );
  const [status, setStatus] = useState<ApiResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isHistoricalUploading, setIsHistoricalUploading] = useState(false);
  const [selectedUploadFileName, setSelectedUploadFileName] = useState("");
  const [selectedHistoricalFileName, setSelectedHistoricalFileName] =
    useState("");
  const [isCopying, setIsCopying] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [exportMonthKeys, setExportMonthKeys] = useState<string[]>([monthKey]);
  const [copySourceMonthKey, setCopySourceMonthKey] = useState(
    previousMonthKey(month)
  );
  const defaultPeriod = useMemo(
    () => defaultPromotionPlanPeriod(month),
    [month]
  );
  const [bulkPromoStartDate, setBulkPromoStartDate] = useState(
    defaultPeriod.startDate
  );
  const [bulkPromoEndDate, setBulkPromoEndDate] = useState(defaultPeriod.endDate);
  const [bulkPeriodTarget, setBulkPeriodTarget] = useState("VISIBLE");
  const [isAddPanelOpen, setIsAddPanelOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isPromotionMapOpen, setIsPromotionMapOpen] = useState(false);
  const [candidateView, setCandidateView] = useState<
    "all" | "newLaunched" | "preLaunch"
  >("all");
  const [selectedCandidateKeys, setSelectedCandidateKeys] = useState<string[]>([]);
  const [isDeliveryDialogOpen, setIsDeliveryDialogOpen] = useState(false);
  const [retryingEmailId, setRetryingEmailId] = useState<string | null>(null);
  const [retryingArchiveId, setRetryingArchiveId] = useState<string | null>(
    null
  );
  const [historyAdminActionKey, setHistoryAdminActionKey] = useState<
    string | null
  >(null);
  const canSeeAllCountries = canViewAllCountries(role);
  const canManagePromotionBackfill = canBypassPromotionPlanLocks(role);
  const canManageApprovalHistory =
    canManagePromotionPlanApprovalHistory(role);
  const statusByCountry = useMemo(
    () =>
      new Map(
        monthStatuses.map((monthStatus) => [
          monthStatus.countryCode,
          monthStatus.status
        ])
      ),
    [monthStatuses]
  );
  const returnNoteByCountry = useMemo(
    () =>
      new Map(
        monthStatuses
          .filter(
            (monthStatus) =>
              monthStatus.status === "REJECTED" && Boolean(monthStatus.notes?.trim())
          )
          .map((monthStatus) => [
            monthStatus.countryCode,
            monthStatus.notes?.trim() ?? ""
          ])
      ),
    [monthStatuses]
  );
  const reviewCountryCodeInScope = useMemo(
    () =>
      reviewCountryCode &&
      data.countries.some((country) => country.code === reviewCountryCode)
        ? reviewCountryCode
        : null,
    [data.countries, reviewCountryCode]
  );
  const isDeadlineLocked = useMemo(
    () =>
      isPromotionPlanDeadlineLocked({
        planYear: selectedYear,
        planMonth: selectedMonth
      }),
    [selectedMonth, selectedYear]
  );
  const lockedCountryCodes = useMemo(
    () =>
      data.countries
        .filter(
          (country) =>
            isDeadlineLocked ||
            statusByCountry.get(country.code) === "SUBMITTED" ||
            statusByCountry.get(country.code) === "FIRST_APPROVED" ||
            statusByCountry.get(country.code) === "APPROVED"
        )
        .map((country) => country.code),
    [data.countries, isDeadlineLocked, statusByCountry]
  );
  const baseRows = useMemo(
    () =>
      buildPromotionPlanBaseRows({
        data,
        entries: planEntries,
        targetMonth: { year: selectedYear, month: selectedMonth },
        lockedCountryCodes
      }),
    [data, lockedCountryCodes, planEntries, selectedMonth, selectedYear]
  );
  const initialSavedEntryBaseRows = useMemo(
    () =>
      buildPromotionPlanEntryBaseRows({
        data,
        entries: planEntries,
        lockedCountryCodes
      }),
    [data, lockedCountryCodes, planEntries]
  );
  const initialInputsByRow = useMemo(
    () =>
      withDefaultPromotionPeriod(
        entriesToPromotionInputs(initialSavedEntryBaseRows, planEntries),
        initialSavedEntryBaseRows,
        selectedYear,
        selectedMonth
      ),
    [initialSavedEntryBaseRows, planEntries, selectedMonth, selectedYear]
  );
  const [draftEntries, setDraftEntries] = useState<PromotionPlanEntryOption[]>(
    planEntries
  );
  const [deletedEntryIds, setDeletedEntryIds] = useState<string[]>([]);
  const plannedBusinessKeySet = useMemo(
    () => new Set(draftEntries.map((entry) => promotionPlanBusinessKeyForEntry(entry))),
    [draftEntries]
  );
  const baseRowsByBusinessKey = useMemo(
    () =>
      new Map(
        baseRows.map((row) => [promotionPlanBusinessKeyForRow(row), row])
      ),
    [baseRows]
  );
  const savedEntryBaseRows = useMemo(
    () =>
      buildPromotionPlanEntryBaseRows({
        data,
        entries: draftEntries,
        lockedCountryCodes
      }),
    [data, draftEntries, lockedCountryCodes]
  );
  const formalBaseRows = savedEntryBaseRows;
  const [inputsByRow, setInputsByRow] =
    useState<PromotionInputsByRow>(initialInputsByRow);
  const allRows = useMemo(
    () => buildPromotionRowsFromBaseRows(formalBaseRows, inputsByRow),
    [formalBaseRows, inputsByRow]
  );
  const rows = useMemo(
    () =>
      buildPromotionRowsFromBaseRows(
        formalBaseRows.filter((row) => normalRowMatchesFilters(row, filters)),
        inputsByRow
      ),
    [filters, formalBaseRows, inputsByRow]
  );
  const candidateRows = useMemo(
    () =>
      baseRows.filter((row) => {
        const businessKey = promotionPlanBusinessKeyForRow(row);
        return (
          !plannedBusinessKeySet.has(businessKey) &&
          isCountryEditable(row.countryCode)
        );
      }),
    [baseRows, plannedBusinessKeySet, statusByCountry]
  );
  const includedProductSkus = useMemo(
    () => new Set(formalBaseRows.map((row) => normalizeSku(row.model))),
    [formalBaseRows]
  );
  const newLaunchedMissingSkus = useMemo(
    () =>
      new Set(
        newLaunchedProducts
          .filter(
            (product) =>
              product.status === "MISSING" &&
              !includedProductSkus.has(normalizeSku(product.sku))
          )
          .map((product) => normalizeSku(product.sku))
      ),
    [includedProductSkus, newLaunchedProducts]
  );
  const newLaunchedNoDataProducts = useMemo(
    () =>
      newLaunchedProducts.filter(
        (product) => product.status === "NO_ACTIVE_PLAN_DATA"
      ),
    [newLaunchedProducts]
  );
  const preLaunchCandidateCount = useMemo(
    () =>
      candidateRows.filter(
        (row) => row.productLifecycleStatus === "UNLAUNCHED"
      ).length,
    [candidateRows]
  );
  const preLaunchConfigurationIssues = useMemo(
    () =>
      getPromotionPlanPreLaunchConfigurationIssues({
        data,
        targetMonth: { year: selectedYear, month: selectedMonth }
      }),
    [data, selectedMonth, selectedYear]
  );
  const visibleCandidateRows = useMemo(
    () =>
      candidateView === "newLaunched"
        ? candidateRows.filter((row) =>
            newLaunchedMissingSkus.has(normalizeSku(row.model))
          )
        : candidateView === "preLaunch"
          ? candidateRows.filter(
              (row) => row.productLifecycleStatus === "UNLAUNCHED"
            )
          : candidateRows,
    [candidateRows, candidateView, newLaunchedMissingSkus]
  );
  const periodTargetOptions = useMemo(() => {
    const seenTargets = new Set<string>();
    return rows.flatMap((row) => {
      const value = periodTargetKey(row.countryCode, row.channelName);
      if (seenTargets.has(value)) {
        return [];
      }
      seenTargets.add(value);
      return [
        {
          value,
          label: `${row.countryCode} · ${row.channelName}`
        }
      ];
    });
  }, [rows]);
  const visibleCountryCodes = useMemo(
    () => [...new Set(rows.map((row) => row.countryCode))].sort(),
    [rows]
  );
  const actionCountryCodes =
    reviewCountryCodeInScope
      ? [reviewCountryCodeInScope]
      : visibleCountryCodes.length > 0
      ? visibleCountryCodes
      : data.countries.map((country) => country.code);
  const editableCountryCodes = data.countries
    .filter((country) => isCountryEditable(country.code))
    .map((country) => country.code);
  const canEditAnyVisibleCountry =
    canSavePlan &&
    actionCountryCodes.some((countryCode) => isCountryEditable(countryCode));
  // Autosave belongs to the server version currently displayed. This prevents
  // an older personal draft from masking a newer shared country-month upload.
  const autosaveCountryCodes = useMemo(() => {
    if (reviewCountryCodeInScope) return [reviewCountryCodeInScope];
    const countriesWithEntries = [...new Set(planEntries.map((entry) => entry.countryCode))]
      .filter((countryCode) => data.countries.some((country) => country.code === countryCode))
      .sort();
    return countriesWithEntries.length > 0
      ? countriesWithEntries
      : data.countries.map((country) => country.code).sort();
  }, [data.countries, planEntries, reviewCountryCodeInScope]);
  const autosaveBaseline = useMemo(
    () =>
      promotionPlanAutosaveBaseline(
        planEntries,
        monthStatuses,
        autosaveCountryCodes
      ),
    [autosaveCountryCodes, monthStatuses, planEntries]
  );
  const autosaveScope = `${selectedYear}:${String(selectedMonth).padStart(2, "0")}:${
    autosaveCountryCodes.join(",") || "NONE"
  }:${autosaveBaseline}`;
  const autosave = useAutosaveDraft({
    workspace: "PROMOTION_PLAN",
    scope: autosaveScope,
    userEmail,
    enabled: canEditAnyVisibleCountry,
    value: {
      draftEntries,
      deletedEntryIds,
      inputsByRow
    },
    onRestore: (snapshot) => {
      if (Array.isArray(snapshot.draftEntries)) {
        setDraftEntries(
          snapshot.draftEntries.filter(
            (item): item is PromotionPlanEntryOption =>
              typeof item === "object" &&
              item !== null &&
              typeof (item as PromotionPlanEntryOption).id === "string" &&
              typeof (item as PromotionPlanEntryOption).countryCode === "string" &&
              typeof (item as PromotionPlanEntryOption).productSku === "string"
          )
        );
      }
      if (Array.isArray(snapshot.deletedEntryIds)) {
        setDeletedEntryIds(
          snapshot.deletedEntryIds.filter(
            (item): item is string => typeof item === "string"
          )
        );
      }
      if (snapshot.inputsByRow && typeof snapshot.inputsByRow === "object") {
        setInputsByRow(snapshot.inputsByRow as PromotionInputsByRow);
      }
    }
  });
  const completeRows = rows.filter((row) => row.promotionCalculation);
  const averageRebatePerUnit =
    completeRows.length === 0
      ? 0
      : completeRows.reduce(
          (sum, row) => sum + (row.promotionCalculation?.rebatePerUnit ?? 0),
          0
        ) / completeRows.length;
  const averageNpPercent =
    completeRows.length === 0
      ? 0
      : completeRows.reduce(
          (sum, row) => sum + (row.promotionCalculation?.npPercent ?? 0),
          0
        ) / completeRows.length;

  useEffect(() => {
    setInputsByRow(initialInputsByRow);
    setDraftEntries(planEntries);
    setDeletedEntryIds([]);
    setSelectedCandidateKeys([]);
    setIsAddPanelOpen(false);
    setCandidateView("all");
    setStatus(null);
  }, [initialInputsByRow, planEntries]);

  useEffect(() => {
    setExportMonthKeys([monthKey]);
    setCopySourceMonthKey(previousMonthKey(month));
    setBulkPromoStartDate(defaultPeriod.startDate);
    setBulkPromoEndDate(defaultPeriod.endDate);
    setBulkPeriodTarget("VISIBLE");
  }, [defaultPeriod.endDate, defaultPeriod.startDate, month, monthKey]);

  useEffect(() => {
    if (reviewCountryCodeInScope) {
      setFilters({ countryCode: reviewCountryCodeInScope });
      setIsAddPanelOpen(false);
      setCandidateView("all");
    }
  }, [reviewCountryCodeInScope, setFilters]);

  useEffect(() => {
    if (
      bulkPeriodTarget !== "VISIBLE" &&
      !periodTargetOptions.some((item) => item.value === bulkPeriodTarget)
    ) {
      setBulkPeriodTarget("VISIBLE");
    }
  }, [bulkPeriodTarget, periodTargetOptions]);

  useEffect(() => {
    const availableCandidateKeys = new Set(
      candidateRows.map((row) => promotionPlanBusinessKeyForRow(row))
    );
    setSelectedCandidateKeys((current) =>
      current.filter((key) => availableCandidateKeys.has(key))
    );
  }, [candidateRows]);

  function updateInput(
    key: string,
    field: PromotionInputField,
    value: string
  ) {
    setInputsByRow((current) => {
      const nextInput = {
        ...current[key],
        [field]: value
      };

      if (field === "promoRrpLocal") {
        delete nextInput.promoRrpEur;
      }

      return {
        ...current,
        [key]: nextInput
      };
    });
  }

  function navigateToMonth(year: number, planMonth: number, countryCode?: string) {
    const params = new URLSearchParams({
      year: String(year),
      month: String(planMonth)
    });
    if (countryCode) {
      params.set("country", countryCode);
    }
    router.push(`${promotionHref}?${params.toString()}`);
  }

  async function savePlan() {
    if (
      !canEditAnyVisibleCountry ||
      isSaving ||
      (allRows.length === 0 && deletedEntryIds.length === 0)
    ) {
      return;
    }

    const invalidRow = allRows.find(
      (row) =>
        isCountryEditable(row.countryCode) &&
        promotionPeriodError(row.promoStartDate, row.promoEndDate)
    );
    if (invalidRow) {
      setStatus({
        status: "error",
        message: `${invalidRow.countryCode} ${invalidRow.model}: ${promotionPeriodError(
          invalidRow.promoStartDate,
          invalidRow.promoEndDate
        )}`
      });
      return;
    }

    const overlap = findPromotionPlanPeriodOverlap(
      allRows
        .filter((row) => isCountryEditable(row.countryCode))
        .map((row) => ({
          scopeKey: promotionPlanBusinessKeyForRow(row),
          countryCode: row.countryCode,
          retailerName: row.retailerName,
          fdName: row.fdName,
          productSku: row.model,
          promotionName: row.promotionName,
          promoStartDate: parsePromotionDateInput(row.promoStartDate),
          promoEndDate: parsePromotionDateInput(row.promoEndDate)
        }))
    );
    if (overlap) {
      setStatus({
        status: "error",
        message: `Promotion periods cannot overlap. ${promotionPlanPeriodOverlapMessage(overlap)}`
      });
      return;
    }

    setIsSaving(true);
    setStatus(null);
    try {
      const response = await fetch("/api/promotion-plan/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planYear: selectedYear,
          planMonth: selectedMonth,
          deleteEntryIds: deletedEntryIds,
          rows: allRows.map((row) => ({
            key: promotionPlanBusinessKeyForRow(row),
            entryId: promotionPlanEntryIdFromRowKey(row.key),
            promoRrpLocal: row.promoRrpLocal,
            promoRrpEur: row.promoRrpEur,
            promoFrontMargin: row.promoFrontMargin,
            dealType: row.dealType,
            promoFdMargin: row.promoFdMargin,
            promotionName: row.promotionName,
            dealNote: row.dealNote,
            promoVolume: row.promoVolume,
            promoStartDate: row.promoStartDate,
            promoEndDate: row.promoEndDate
          }))
        })
      });
      const result = (await response.json()) as ApiResult;
      setStatus(result);
      if (response.ok) {
        setDeletedEntryIds([]);
        void autosave.clearAutosaveDraft();
        router.refresh();
      }
    } catch {
      setStatus({ status: "error", message: "Save failed. Please try again." });
    } finally {
      setIsSaving(false);
    }
  }

  async function uploadWorkbook() {
    if (!canEditAnyVisibleCountry || isUploading) {
      return;
    }

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setStatus({ status: "error", message: "Choose an Excel workbook first." });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("targetYear", String(selectedYear));
    formData.append("targetMonth", String(selectedMonth));
    setIsUploading(true);
    setStatus(null);
    try {
      const response = await fetch("/api/promotion-plan/import", {
        method: "POST",
        body: formData
      });
      const result = (await response.json()) as ApiResult;
      setStatus(result);
      if (response.ok) {
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        setSelectedUploadFileName("");
        void autosave.clearAutosaveDraft();
        router.refresh();
      }
    } catch {
      setStatus({ status: "error", message: "Upload failed. Please try again." });
    } finally {
      setIsUploading(false);
    }
  }

  async function uploadHistoricalWorkbook() {
    if (!canManagePromotionBackfill || isHistoricalUploading) {
      return;
    }

    const file = historicalFileInputRef.current?.files?.[0];
    if (!file) {
      setStatus({
        status: "error",
        message: "Choose a historical Promotion Plan workbook first."
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setIsHistoricalUploading(true);
    setStatus(null);
    try {
      const response = await fetch("/api/promotion-plan/historical-import", {
        method: "POST",
        body: formData
      });
      const result = (await response.json()) as ApiResult;
      setStatus(result);
      if (response.ok) {
        if (historicalFileInputRef.current) {
          historicalFileInputRef.current.value = "";
        }
        setSelectedHistoricalFileName("");
        void autosave.clearAutosaveDraft();
        router.refresh();
      }
    } catch {
      setStatus({
        status: "error",
        message: "Historical import failed. Please try again."
      });
    } finally {
      setIsHistoricalUploading(false);
    }
  }

  async function updatePlanStatus(
    action: "submit" | "approve" | "reject",
    target?: {
      planYear: number;
      planMonth: number;
      countryCodes: string[];
    }
  ) {
    if (isUpdatingStatus) {
      return;
    }

    const targetYear = target?.planYear ?? selectedYear;
    const targetMonth = target?.planMonth ?? selectedMonth;
    const targetCountryCodes = target?.countryCodes ?? actionCountryCodes;
    const revisionNote =
      action === "reject"
        ? window.prompt(
            "Return this plan for revision. Describe the required changes:"
          )
        : null;

    if (action === "reject" && !revisionNote?.trim()) {
      setStatus({
        status: "error",
        message: "A return reason is required before sending a plan back for revision."
      });
      return;
    }

    setIsUpdatingStatus(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/promotion-plan/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planYear: targetYear,
          planMonth: targetMonth,
          countryCodes: targetCountryCodes,
          notes: revisionNote?.trim() ?? null
        })
      });
      const result = (await response.json()) as ApiResult;
      setStatus(result);
      if (response.ok) {
        if (action === "submit" && !target) {
          void autosave.clearAutosaveDraft();
        }
        router.refresh();
      }
    } catch {
      setStatus({
        status: "error",
        message: "Status update failed. Please try again."
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function retryApprovalEmail(notificationId: string) {
    if (retryingEmailId) {
      return;
    }

    setRetryingEmailId(notificationId);
    setStatus(null);
    try {
      const response = await fetch(
        `/api/promotion-plan/email-notifications/${notificationId}/retry`,
        { method: "POST" }
      );
      const result = (await response.json()) as ApiResult;
      setStatus(result);
      if (response.ok) {
        void autosave.clearAutosaveDraft();
        router.refresh();
      }
    } catch {
      setStatus({
        status: "error",
        message: "Approval email retry failed. Please try again."
      });
    } finally {
      setRetryingEmailId(null);
    }
  }

  async function retryArchiveDelivery(archiveId: string) {
    if (retryingArchiveId) {
      return;
    }

    setRetryingArchiveId(archiveId);
    setStatus(null);
    try {
      const response = await fetch(
        `/api/promotion-plan/archives/${archiveId}/retry-drive`,
        { method: "POST" }
      );
      const result = (await response.json()) as ApiResult;
      setStatus(result);
      if (response.ok) {
        router.refresh();
      }
    } catch {
      setStatus({
        status: "error",
        message: "Archive retry failed. Please try again."
      });
    } finally {
      setRetryingArchiveId(null);
    }
  }

  async function manageApprovalHistory({
    action,
    countryCodes,
    notificationId,
    planMonth,
    planYear,
    targetStatus
  }: {
    action: "set-status" | "delete-status";
    countryCodes: string[];
    notificationId: string;
    planMonth: number;
    planYear: number;
    targetStatus?: PromotionPlanStatus;
  }) {
    if (!canManageApprovalHistory || historyAdminActionKey) {
      return;
    }

    const confirmationPhrase =
      action === "delete-status" ? "DELETE APPROVAL" : "CHANGE APPROVAL";
    const confirmation = window.prompt(
      action === "delete-status"
        ? `Owner warning: this deletes the approval record for ${planYear}-${String(
            planMonth
          ).padStart(2, "0")} ${countryCodes.join(
            ", "
          )}. Saved plan rows, delivery records, and orphan archived workbooks will be cleared so the month can be re-imported. Type ${confirmationPhrase} to confirm.`
        : `Owner warning: this changes historical approval status to ${targetStatus}. No approval email will be sent. Type ${confirmationPhrase} to confirm.`
    );

    if (confirmation !== confirmationPhrase) {
      setStatus({
        status: "error",
        message: `Operation cancelled. Exact confirmation required: ${confirmationPhrase}.`
      });
      return;
    }

    const actionKey = `${notificationId}:${action}`;
    setHistoryAdminActionKey(actionKey);
    setStatus(null);
    try {
      const response = await fetch("/api/promotion-plan/admin-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          confirmation,
          countryCodes,
          notificationId,
          planMonth,
          planYear,
          targetStatus
        })
      });
      const result = (await response.json()) as ApiResult;
      setStatus(result);
      if (response.ok) {
        router.refresh();
      }
    } catch {
      setStatus({
        status: "error",
        message: "Owner approval history update failed. Please try again."
      });
    } finally {
      setHistoryAdminActionKey(null);
    }
  }

  function openApprovalReview(item: PromotionPlanApprovalQueueItem) {
    setFilters({ countryCode: item.countryCode });
    navigateToMonth(item.planYear, item.planMonth, item.countryCode);
  }

  async function copyPreviousPlan() {
    if (!canEditAnyVisibleCountry || isCopying) {
      return;
    }

    const sourceMonth = monthFromKey(copySourceMonthKey);
    if (!sourceMonth) {
      setStatus({ status: "error", message: "Choose a valid source month." });
      return;
    }

    setIsCopying(true);
    setStatus(null);
    try {
      const response = await fetch("/api/promotion-plan/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceYear: sourceMonth.year,
          sourceMonth: sourceMonth.month,
          targetYear: selectedYear,
          targetMonth: selectedMonth,
          countryCodes: actionCountryCodes
        })
      });
      const result = (await response.json()) as ApiResult;
      setStatus(result);
      if (response.ok) {
        router.refresh();
      }
    } catch {
      setStatus({ status: "error", message: "Copy failed. Please try again." });
    } finally {
      setIsCopying(false);
    }
  }

  function isCountryEditable(countryCode: string) {
    return getPromotionPlanEditState({
      role,
      hasCountryAccess: hasPromotionCountryAccess(
        role,
        countryCode,
        accessibleCountryCodes
      ),
      planYear: selectedYear,
      planMonth: selectedMonth,
      status: statusByCountry.get(countryCode) ?? "DRAFT"
    }).editable;
  }

  function applyBulkPromoPeriod() {
    const error = promotionPeriodError(bulkPromoStartDate, bulkPromoEndDate);
    if (error) {
      setStatus({ status: "error", message: error });
      return;
    }
    const startDate = parsePromotionDateInput(bulkPromoStartDate) ?? bulkPromoStartDate;
    const endDate = parsePromotionDateInput(bulkPromoEndDate) ?? bulkPromoEndDate;

    const matchedRows = rows.filter(
      (row) =>
        isCountryEditable(row.countryCode) &&
        (bulkPeriodTarget === "VISIBLE" ||
          periodTargetKey(row.countryCode, row.channelName) === bulkPeriodTarget)
    );
    if (matchedRows.length === 0) {
      setStatus({
        status: "error",
        message: "No editable rows match this period target."
      });
      return;
    }

    setInputsByRow((current) => {
      const next = { ...current };
      for (const row of matchedRows) {
        next[row.key] = {
          ...next[row.key],
          promoStartDate: startDate,
          promoEndDate: endDate
        };
      }
      return next;
    });
    setStatus({
      status: "success",
      message: `Applied promo period to ${matchedRows.length} visible row(s).`
    });
  }

  function toggleCandidateSelection(key: string, checked: boolean) {
    setSelectedCandidateKeys((current) => {
      const currentSet = new Set(current);
      if (checked) {
        currentSet.add(key);
      } else {
        currentSet.delete(key);
      }
      return [...currentSet];
    });
  }

  function addSelectedPromotionRows() {
    addPromotionRows(selectedCandidateKeys);
  }

  function addAllVisiblePromotionRows(keys: string[]) {
    addPromotionRows(keys);
  }

  function addPromotionRows(keys: string[]) {
    const rowsToAdd = keys
      .map((key) => baseRowsByBusinessKey.get(key))
      .filter((row): row is NonNullable<typeof row> => row !== undefined)
      .filter((row) => !plannedBusinessKeySet.has(promotionPlanBusinessKeyForRow(row)));

    if (rowsToAdd.length === 0) {
      setStatus({
        status: "error",
        message: "No new promotion rows were selected."
      });
      return;
    }

    const entriesToAdd = rowsToAdd.map((row, index) =>
      createPromotionPlanDraftEntry({
        row,
        planYear: selectedYear,
        planMonth: selectedMonth,
        sequence: index
      })
    );
    setDraftEntries((current) => [...current, ...entriesToAdd]);
    setInputsByRow((current) => {
      const next = { ...current };
      for (const entry of entriesToAdd) {
        const key = promotionPlanEntryRowKey(entry);
        next[key] = {
          promoStartDate: defaultPeriod.startDate,
          promoEndDate: defaultPeriod.endDate
        };
      }
      return next;
    });
    setSelectedCandidateKeys([]);
    setIsAddPanelOpen(false);
    setStatus({
      status: "success",
      message: `Added ${rowsToAdd.length} promotion row(s). Save month to persist.`
    });
  }

  function addPromotionPeriod(row: ReturnType<typeof buildPromotionRowsFromBaseRows>[number]) {
    const entryId = promotionPlanEntryIdFromRowKey(row.key);
    const sourceEntry = entryId
      ? draftEntries.find((entry) => entry.id === entryId)
      : undefined;
    if (!sourceEntry) {
      setStatus({
        status: "error",
        message: "This promotion row is no longer available. Refresh the page and try again."
      });
      return;
    }

    const copy = {
      ...sourceEntry,
      id: createPromotionPlanDraftId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setDraftEntries((current) => [...current, copy]);
    setInputsByRow((current) => ({
      ...current,
      [promotionPlanEntryRowKey(copy)]: {
        ...current[row.key],
        promoStartDate: "",
        promoEndDate: ""
      }
    }));
    setStatus({
      status: "success",
      message: "Added another promotion period. Set its dates and price before saving."
    });
  }

  function removePromotionRow(row: ReturnType<typeof buildPromotionRowsFromBaseRows>[number]) {
    const entryId = promotionPlanEntryIdFromRowKey(row.key);
    if (!entryId) {
      return;
    }
    setDraftEntries((current) => current.filter((entry) => entry.id !== entryId));
    setInputsByRow((current) => {
      const next = { ...current };
      delete next[row.key];
      return next;
    });
    if (!isPromotionPlanDraftEntryId(entryId)) {
      setDeletedEntryIds((current) =>
        current.includes(entryId) ? current : [...current, entryId]
      );
    }
    setStatus({
      status: "success",
      message: `${row.countryCode} ${row.channelName} ${row.model} promotion period removed. Save month to persist.`
    });
  }

  function exportHref() {
    const params = new URLSearchParams({
      year: String(selectedYear),
      month: String(selectedMonth),
      months: exportMonthKeys.join(","),
      // Exports are offline editing files, so retain the complete selected-country
      // history rather than narrowing the workbook with the current table filters.
      filters: JSON.stringify({ countryCode: filters.countryCode })
    });
    return `/api/promotion-plan/export?${params.toString()}`;
  }

  function copyTemplateHref() {
    const params = new URLSearchParams({
      source: copySourceMonthKey,
      target: monthKey,
      filters: JSON.stringify({ countryCode: filters.countryCode })
    });
    return `/api/promotion-plan/copy-template?${params.toString()}`;
  }

  function updatePromotionFilters(
    nextFilters: CalculatorFilters,
    changedField?: CalculatorFilterField
  ) {
    if (changedField === "model" || changedField === "productName") {
      setFilters(
        synchronizeProductIdentityFilters(baseRows, nextFilters, changedField)
      );
      return;
    }

    setFilters(nextFilters);
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Monthly Promotion Plan
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Submit and record monthly product-channel promotion plans with
              editable RRPP, promo front margin, promo rebate, margin rebate,
              NP, and NP%.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <Metric
              label="Visible rows"
              value={`${completeRows.length} / ${rows.length}`}
            />
            <Metric
              label="Avg NP%"
              value={completeRows.length === 0 ? "-" : formatPercent(averageNpPercent)}
            />
            <Metric
              label="Avg Rebate"
              value={
                completeRows.length === 0
                  ? "-"
                  : formatMoney(averageRebatePerUnit, "EUR")
              }
            />
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
      </section>

      <WideTableFilters
        rows={baseRows}
        filters={filters}
        onChange={updatePromotionFilters}
        synchronizeProductIdentity
      />

      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-2 sm:grid-cols-[104px_142px_108px]">
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span>Year</span>
                <select
                  className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-950 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                  value={selectedYear}
                  onChange={(event) =>
                    navigateToMonth(Number(event.target.value), selectedMonth)
                  }
                >
                  {yearOptions(selectedYear).map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span>Month</span>
                <select
                  className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-950 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                  value={selectedMonth}
                  onChange={(event) =>
                    navigateToMonth(selectedYear, Number(event.target.value))
                  }
                >
                  {MONTHS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span>Plan month</span>
                <div className="flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold normal-case text-slate-700">
                  {monthKey}
                </div>
              </div>
            </div>
            <div className="min-w-[260px] flex-1">
              <MonthStatusSummary
                countryCodes={actionCountryCodes}
                editableCountryCodes={editableCountryCodes}
                returnNoteByCountry={returnNoteByCountry}
                statusByCountry={statusByCountry}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                role={role}
                accessibleCountryCodes={accessibleCountryCodes}
              />
            </div>
          </div>
        </div>

        {canDownloadPlanHistory ? (
        <div className="rounded-md border border-slate-200 bg-slate-50/70 p-2.5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[13px] font-semibold text-slate-950">
              Copy & period tools
            </h3>
            <span className="text-[11px] font-semibold text-slate-500">
              Sheet name sets plan month; promo periods may cross months
            </span>
          </div>
          <div className="grid items-start gap-3 xl:grid-cols-[minmax(520px,0.9fr)_minmax(520px,0.95fr)]">
            <div className="grid gap-2">
              <div className="grid items-start gap-3 sm:grid-cols-[240px_250px]">
                <div className="grid gap-1.5">
                  <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <span>Copy from</span>
                    <select
                      className="h-8 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold normal-case text-slate-950 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                      value={copySourceMonthKey}
                      onChange={(event) => setCopySourceMonthKey(event.target.value)}
                    >
                      {copySourceMonthOptions(selectedYear, selectedMonth).map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <a
                    className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    href={copyTemplateHref()}
                  >
                    Download copy template
                  </a>
                  <p className="text-[11px] font-medium leading-4 text-slate-500">
                    Includes complete selected-country history even when the target
                    month is locked; promotion dates can continue into later months.
                    Upload remains locked until the month is editable.
                  </p>
                </div>

                <div className="grid gap-1.5">
                  <FilePicker
                    inputRef={fileInputRef}
                    label="Upload Excel"
                    fileName={selectedUploadFileName}
                    disabled={!canEditAnyVisibleCountry || isUploading}
                    onFileNameChange={setSelectedUploadFileName}
                  />
                  <button
                    className="h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    type="button"
                    disabled={!canEditAnyVisibleCountry || isUploading}
                    onClick={uploadWorkbook}
                  >
                    {isUploading ? "Uploading..." : "Upload Excel"}
                  </button>
                </div>
              </div>

              <div className="flex">
                <button
                  className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  type="button"
                  disabled={!canEditAnyVisibleCountry || isCopying}
                  onClick={copyPreviousPlan}
                >
                  {isCopying ? "Copying..." : "Copy into month"}
                </button>
              </div>
            </div>

            <div className="w-full max-w-[620px] justify-self-start rounded-md border border-amber-100 bg-amber-50/70 px-2 pb-2 pt-1">
              <div className="grid items-start gap-2 sm:grid-cols-3">
                <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <span>Bulk start</span>
                  <EuropeanDateInput
                    label="Bulk start"
                    className="h-8 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold normal-case text-slate-950 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                    value={bulkPromoStartDate}
                    disabled={!canEditAnyVisibleCountry}
                    onChange={setBulkPromoStartDate}
                  />
                </label>
                <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <span>Bulk end</span>
                  <EuropeanDateInput
                    label="Bulk end"
                    className="h-8 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold normal-case text-slate-950 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                    value={bulkPromoEndDate}
                    disabled={!canEditAnyVisibleCountry}
                    onChange={setBulkPromoEndDate}
                  />
                </label>
                <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <span>Apply to</span>
                  <select
                    className="h-8 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold normal-case text-slate-950 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                    value={bulkPeriodTarget}
                    disabled={!canEditAnyVisibleCountry}
                    onChange={(event) => setBulkPeriodTarget(event.target.value)}
                  >
                    <option value="VISIBLE">All visible rows</option>
                    {periodTargetOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-10 flex">
                <button
                  className="h-8 w-[146px] rounded-md bg-slate-950 px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  type="button"
                  disabled={!canEditAnyVisibleCountry}
                  onClick={applyBulkPromoPeriod}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
        ) : null}

        {canManagePromotionBackfill ? (
          <div className="rounded-md border border-indigo-100 bg-indigo-50/60 p-2.5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[13px] font-semibold text-slate-950">
                Historical import
              </h3>
              <span className="text-[11px] font-semibold text-indigo-700">
                Manager only · replaces existing country-month rows
              </span>
            </div>
            <div className="grid gap-2 md:grid-cols-[minmax(260px,420px)_160px_1fr] md:items-end">
              <FilePicker
                inputRef={historicalFileInputRef}
                label="Historical workbook"
                fileName={selectedHistoricalFileName}
                disabled={isHistoricalUploading}
                onFileNameChange={setSelectedHistoricalFileName}
              />
              <button
                className="h-8 rounded-md bg-slate-950 px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                type="button"
                disabled={isHistoricalUploading}
                onClick={uploadHistoricalWorkbook}
              >
                {isHistoricalUploading ? "Importing..." : "Import history"}
              </button>
              <p className="text-[11px] font-semibold leading-5 text-slate-500">
                Use the generated historical import workbook template with month
                sheets like 2026-05. An Import Notes sheet is also supported.
                This bypasses normal lock checks for manager backfill only;
                existing rows for uploaded country-months are replaced, and no
                approval email is sent.
              </p>
            </div>
          </div>
        ) : null}

        {isAddPanelOpen ? (
          <AddPromotionRowsPanel
            rows={visibleCandidateRows}
            totalCandidateCount={candidateRows.length}
            candidateView={candidateView}
            newLaunchedCount={newLaunchedMissingSkus.size}
            preLaunchCount={preLaunchCandidateCount}
            preLaunchConfigurationIssues={preLaunchConfigurationIssues}
            selectedKeys={selectedCandidateKeys}
            canEdit={canEditAnyVisibleCountry}
            onCandidateViewChange={(view) => {
              setCandidateView(view);
              setSelectedCandidateKeys([]);
            }}
            onToggle={toggleCandidateSelection}
            onAddSelected={addSelectedPromotionRows}
            onAddAllVisible={addAllVisiblePromotionRows}
          />
        ) : null}

        {status ? (
          <StatusNotice status={status} showArchiveLinks={canSeeAllCountries} />
        ) : null}
        {!canSavePlan ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
            Your role can download country history, view, and export Promotion Plan
            data, but cannot save or upload changes.
          </div>
        ) : !canEditAnyVisibleCountry ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
            The selected month/country range is locked or not assigned to your
            account.
          </div>
        ) : null}
      </section>

      <NewLaunchedProductsNotice
        missingProducts={newLaunchedProducts.filter(
          (product) =>
            product.status === "MISSING" &&
            !includedProductSkus.has(normalizeSku(product.sku))
        )}
        noDataProducts={newLaunchedNoDataProducts}
        onReview={() => {
          setCandidateView("newLaunched");
          setIsAddPanelOpen(true);
        }}
      />

      <PromotionWideTable
        rows={rows}
        emptyMessage={
          allRows.length === 0
            ? "No promotion rows in this month yet. Add rows or upload Excel."
            : "No promotion rows match the current filters."
        }
        isRowReadOnly={(row) => !isCountryEditable(row.countryCode)}
        onPromoInputChange={updateInput}
        onAddPromotionPeriod={addPromotionPeriod}
        onRemovePromotionRow={removePromotionRow}
        toolbarActions={
          <>
            <button
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              type="button"
              disabled={!canEditAnyVisibleCountry}
              onClick={() => setIsAddPanelOpen((current) => !current)}
            >
              {isAddPanelOpen ? "Close add rows" : "Add promotion rows"}
            </button>
            <button
              className="rounded-md border border-slate-400 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
              type="button"
              disabled={
                !canEditAnyVisibleCountry ||
                isUpdatingStatus ||
                allRows.length === 0
              }
              onClick={() => updatePlanStatus("submit")}
            >
              {isUpdatingStatus
                ? "Updating..."
                : actionCountryCodes.some(
                      (countryCode) => statusByCountry.get(countryCode) === "REJECTED"
                    )
                  ? "Resubmit"
                  : "Submit"}
            </button>
            <button
              className="rounded-md bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              type="button"
              disabled={
                !canEditAnyVisibleCountry ||
                isSaving ||
                (allRows.length === 0 && deletedEntryIds.length === 0)
              }
              onClick={savePlan}
            >
              {isSaving ? "Saving..." : "Save month"}
            </button>
            <button
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              type="button"
              onClick={() => setIsExportDialogOpen(true)}
            >
              Export Excel
            </button>
            <button
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              type="button"
              disabled={allRows.length === 0}
              onClick={() => setIsPromotionMapOpen(true)}
            >
              Promotion map
            </button>
          </>
        }
      />
      {isExportDialogOpen ? (
        <ExportMonthDialog
          exportHref={exportHref()}
          exportMonthKeys={exportMonthKeys}
          monthOptions={yearMonthOptions(selectedYear, selectedMonth)}
          onClose={() => setIsExportDialogOpen(false)}
          onExportMonthKeysChange={setExportMonthKeys}
        />
      ) : null}
      {isPromotionMapOpen ? (
        <PromotionMapDialog
          allRows={allRows}
          filteredRows={rows}
          month={month}
          monthKey={monthKey}
          onClose={() => setIsPromotionMapOpen(false)}
        />
      ) : null}
      {isDeliveryDialogOpen ? (
        <ApprovalDeliveryStatusDialog
          archives={recentApprovalArchives}
          notifications={recentEmailNotifications}
          retryingArchiveId={retryingArchiveId}
          retryingEmailId={retryingEmailId}
          historyAdminActionKey={historyAdminActionKey}
          showArchiveLinks={canSeeAllCountries}
          showRetryActions={canApprovePlan || canManagePromotionBackfill}
          showHistoryAdminActions={canManageApprovalHistory}
          onClose={() => setIsDeliveryDialogOpen(false)}
          onManageApprovalHistory={manageApprovalHistory}
          onRetryArchive={retryArchiveDelivery}
          onRetryEmail={retryApprovalEmail}
        />
      ) : null}
    </div>
  );
}

function ApprovalQueuePanel({
  items,
  notifications,
  isUpdating,
  onOpenReview,
  onOpenDeliveryStatus,
  onApprove,
  onReject
}: {
  items: PromotionPlanApprovalQueueItem[];
  notifications: PromotionPlanEmailNotificationOption[];
  isUpdating: boolean;
  onOpenReview: (item: PromotionPlanApprovalQueueItem) => void;
  onOpenDeliveryStatus: () => void;
  onApprove: (item: PromotionPlanApprovalQueueItem) => void;
  onReject: (item: PromotionPlanApprovalQueueItem) => void;
}) {
  const firstStageCount = items.filter((item) => item.stage === "first").length;
  const finalStageCount = items.filter((item) => item.stage === "final").length;
  const recentNotificationCount = notifications.slice(0, 5).length;
  const failedNotificationCount = notifications.filter(
    (notification) => notification.status === "FAILED"
  ).length;

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-950">
            Approval queue
          </h3>
          <span className="rounded-full bg-slate-950 px-2 py-0.5 text-[11px] font-semibold text-white">
            {items.length} pending
          </span>
          {firstStageCount > 0 ? (
            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-amber-800">
              {firstStageCount} first
            </span>
          ) : null}
          {finalStageCount > 0 ? (
            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
              {finalStageCount} final
            </span>
          ) : null}
        </div>
        <button
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-amber-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-amber-50"
          type="button"
          onClick={onOpenDeliveryStatus}
        >
          Delivery status
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
            {recentNotificationCount} recent
            {failedNotificationCount > 0 ? ` · ${failedNotificationCount} failed` : ""}
          </span>
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-amber-200 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-500">
          No plans are waiting for your approval.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-amber-200 bg-white">
          <div className="min-w-[840px]">
            <div className="grid grid-cols-[96px_72px_130px_1fr_96px_220px] items-center gap-2 border-b border-amber-100 bg-amber-100/70 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              <span>Month</span>
              <span>Country</span>
              <span>Stage</span>
              <span>Submitted by</span>
              <span>Rows</span>
              <span className="text-right">Actions</span>
            </div>
            {items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[96px_72px_130px_1fr_96px_220px] items-center gap-2 border-b border-slate-100 px-3 py-2 text-xs last:border-b-0"
              >
                <span className="font-semibold text-slate-950">
                  {approvalQueueMonthLabel(item)}
                </span>
                <span className="font-semibold text-slate-700">
                  {item.countryCode}
                </span>
                <span
                  className={`w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    item.stage === "final"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-800"
                  }`}
                >
                  {approvalStageLabel(item.stage)}
                </span>
                <span className="min-w-0 text-slate-600">
                  <span className="block truncate font-semibold text-slate-800">
                    {item.submittedByEmail ?? "Unknown submitter"}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {formatSubmittedAt(item.submittedAt)}
                  </span>
                </span>
                <span className="font-semibold text-slate-700">
                  {item.entryCount}
                </span>
                <div className="flex justify-end gap-1.5">
                  <button
                    className="h-7 rounded-md border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                    type="button"
                    onClick={() => onOpenReview(item)}
                  >
                    Open review
                  </button>
                  {item.canApprove ? (
                    <>
                      <button
                        className="h-7 rounded-md border border-emerald-200 bg-white px-2 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                        type="button"
                        disabled={isUpdating}
                        onClick={() => onApprove(item)}
                      >
                        {item.stage === "final" ? "Final approve" : "First approve"}
                      </button>
                      <button
                        className="h-7 rounded-md border border-rose-200 bg-white px-2 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                        type="button"
                        disabled={isUpdating || !item.canReturnForRevision}
                        onClick={() => onReject(item)}
                      >
                        Return for revision
                      </button>
                    </>
                  ) : (
                    <span className="inline-flex h-7 items-center rounded-md bg-slate-100 px-2 text-[11px] font-semibold text-slate-500">
                      {item.stage === "first"
                        ? "Preview · awaiting first approval"
                        : "Preview · awaiting final approval"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ApprovalDeliveryStatusDialog({
  archives,
  historyAdminActionKey,
  notifications,
  retryingArchiveId,
  retryingEmailId,
  showArchiveLinks,
  showHistoryAdminActions,
  showRetryActions,
  onClose,
  onManageApprovalHistory,
  onRetryArchive,
  onRetryEmail
}: {
  archives: PromotionPlanArchiveOption[];
  historyAdminActionKey: string | null;
  notifications: PromotionPlanEmailNotificationOption[];
  retryingArchiveId: string | null;
  retryingEmailId: string | null;
  showArchiveLinks: boolean;
  showHistoryAdminActions: boolean;
  showRetryActions: boolean;
  onClose: () => void;
  onManageApprovalHistory: (payload: {
    action: "set-status" | "delete-status";
    countryCodes: string[];
    notificationId: string;
    planMonth: number;
    planYear: number;
    targetStatus?: PromotionPlanStatus;
  }) => void;
  onRetryArchive: (archiveId: string) => void;
  onRetryEmail: (notificationId: string) => void;
}) {
  const archiveById = new Map(archives.map((archive) => [archive.id, archive]));
  const visibleNotifications = showHistoryAdminActions
    ? notifications
    : notifications.slice(0, 5);
  const [targetStatusByNotificationId, setTargetStatusByNotificationId] =
    useState<Record<string, PromotionPlanStatus>>({});

  return (
    <div className="fixed inset-0 z-[500] grid place-items-center bg-slate-950/30 px-4 py-6">
      <section className="max-h-[86vh] w-full max-w-6xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-950">
              Approval delivery status
            </h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {showHistoryAdminActions
                ? `${visibleNotifications.length} records`
                : `${visibleNotifications.length} recent`}
            </span>
          </div>
          <button
            className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            type="button"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="max-h-[calc(86vh-58px)] overflow-auto p-4">
          {visibleNotifications.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
              No final approval email records yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-slate-200">
              <div className="min-w-[980px]">
                <div className="grid grid-cols-[88px_112px_1.05fr_1.1fr_132px] items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <span>Month</span>
                  <span>Countries</span>
                  <span>Archive</span>
                  <span>Email</span>
                  <span>Updated</span>
                </div>
                {visibleNotifications.map((notification) => {
                  const archive = notification.archiveId
                    ? archiveById.get(notification.archiveId) ?? null
                    : null;
                  const isBusinessPlanDelivery =
                    notification.planMonth === 0 ||
                    archive?.source.startsWith("BUSINESS_PLAN");
                  const canRetryArchive =
                    showRetryActions && archive?.driveStatus === "FAILED";
                  const canRetryEmail =
                    showRetryActions &&
                    ["FAILED", "PENDING", "NOT_CONFIGURED"].includes(
                      notification.status
                    );
                  return (
                    <div
                      key={notification.id}
                      className="grid grid-cols-[88px_112px_1.05fr_1.1fr_132px] items-start gap-2 border-b border-slate-100 px-3 py-2 text-xs last:border-b-0"
                    >
                      <span className="font-semibold text-slate-950">
                        {deliveryPeriodLabel(notification, archive)}
                      </span>
                      <span className="font-semibold text-slate-700">
                        {notification.countryCodes.join(", ") || "-"}
                      </span>
                      <div className="min-w-0 text-slate-600">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${archiveStatusClass(
                            archive?.driveStatus
                          )}`}
                        >
                          {archive ? archiveStatusLabel(archive.driveStatus) : "No archive"}
                        </span>
                        {canRetryArchive && archive ? (
                          <button
                            className="ml-2 h-6 rounded-md border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                            type="button"
                            disabled={retryingArchiveId === archive.id}
                            onClick={() => onRetryArchive(archive.id)}
                          >
                            {retryingArchiveId === archive.id
                              ? "Retrying..."
                              : "Retry archive"}
                          </button>
                        ) : null}
                        <div className="mt-1 truncate font-semibold text-slate-800">
                          {archive?.workbookFileName ?? "Archive was not created"}
                        </div>
                        {showArchiveLinks && archive ? (
                          <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-semibold">
                            <a
                              className="text-slate-700 underline"
                              href={`/api/promotion-plan/archives/${archive.id}/download`}
                            >
                              Download archive
                            </a>
                            {archive.driveUrl ? (
                              <a
                                className="text-slate-700 underline"
                                href={archive.driveUrl}
                                rel="noreferrer"
                                target="_blank"
                              >
                                Open Drive
                              </a>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      <div className="min-w-0 text-slate-600">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${emailStatusClass(
                              notification.status
                            )}`}
                          >
                            {emailNotificationLabel(notification.status)}
                          </span>
                          {canRetryEmail ? (
                            <button
                              className="h-6 rounded-md border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                              type="button"
                              disabled={retryingEmailId === notification.id}
                              onClick={() => onRetryEmail(notification.id)}
                            >
                              {retryingEmailId === notification.id
                                ? "Retrying..."
                                : "Retry email"}
                            </button>
                          ) : null}
                        </div>
                        <div className="mt-1 truncate text-slate-700">
                          To: {notification.toEmails.join(", ") || "-"}
                        </div>
                        {notification.ccEmails.length > 0 ? (
                          <div className="mt-1 truncate text-slate-500">
                            Cc: {notification.ccEmails.join(", ")}
                          </div>
                        ) : null}
                        {notification.messageId ? (
                          <div className="mt-1 truncate text-slate-500">
                            SES: {notification.messageId}
                          </div>
                        ) : null}
                        {notification.errorMessage ? (
                          <div className="mt-1 font-semibold text-rose-700">
                            {notification.errorMessage}
                          </div>
                        ) : null}
                        {showHistoryAdminActions && !isBusinessPlanDelivery ? (
                          <ApprovalHistoryControls
                            actionKey={historyAdminActionKey}
                            countryCodes={notification.countryCodes}
                            notificationId={notification.id}
                            planMonth={notification.planMonth}
                            planYear={notification.planYear}
                            targetStatus={
                              targetStatusByNotificationId[notification.id] ??
                              "SUBMITTED"
                            }
                            onChangeTargetStatus={(targetStatus) =>
                              setTargetStatusByNotificationId((current) => ({
                                ...current,
                                [notification.id]: targetStatus
                              }))
                            }
                            onManageApprovalHistory={onManageApprovalHistory}
                          />
                        ) : null}
                      </div>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {formatSubmittedAt(
                          notification.lastAttemptAt ??
                            notification.sentAt ??
                            notification.createdAt
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ApprovalHistoryControls({
  actionKey,
  countryCodes,
  notificationId,
  planMonth,
  planYear,
  targetStatus,
  onChangeTargetStatus,
  onManageApprovalHistory
}: {
  actionKey: string | null;
  countryCodes: string[];
  notificationId: string;
  planMonth: number;
  planYear: number;
  targetStatus: PromotionPlanStatus;
  onChangeTargetStatus: (status: PromotionPlanStatus) => void;
  onManageApprovalHistory: (payload: {
    action: "set-status" | "delete-status";
    countryCodes: string[];
    notificationId: string;
    planMonth: number;
    planYear: number;
    targetStatus?: PromotionPlanStatus;
  }) => void;
}) {
  const changeActionKey = `${notificationId}:set-status`;
  const deleteActionKey = `${notificationId}:delete-status`;
  const isChanging = actionKey === changeActionKey;
  const isDeleting = actionKey === deleteActionKey;
  const isBusy = actionKey !== null;

  return (
    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50/70 p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-900">
          Owner controls
        </span>
        <span className="text-[11px] font-medium text-amber-900/80">
          Type exact confirmation phrase before saving.
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          className="h-7 rounded-md border border-amber-200 bg-white px-2 text-[11px] font-semibold text-slate-800 outline-none focus:border-amber-500"
          value={targetStatus}
          onChange={(event) =>
            onChangeTargetStatus(event.currentTarget.value as PromotionPlanStatus)
          }
        >
          <option value="DRAFT">Draft</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="FIRST_APPROVED">First approved</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <button
          className="h-7 rounded-md border border-amber-300 bg-white px-2 text-[11px] font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          type="button"
          disabled={isBusy}
          onClick={() =>
            onManageApprovalHistory({
              action: "set-status",
              countryCodes,
              notificationId,
              planMonth,
              planYear,
              targetStatus
            })
          }
        >
          {isChanging ? "Changing..." : "Change status"}
        </button>
        <button
          className="h-7 rounded-md border border-rose-200 bg-white px-2 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          type="button"
          disabled={isBusy}
          onClick={() =>
            onManageApprovalHistory({
              action: "delete-status",
              countryCodes,
              notificationId,
              planMonth,
              planYear
            })
          }
        >
          {isDeleting ? "Deleting..." : "Delete status"}
        </button>
      </div>
      <div className="mt-1 text-[11px] font-medium text-amber-900/80">
        Delete clears saved plan rows, delivery records, and orphan archived workbooks for re-import.
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-28 rounded-md border border-slate-200 bg-white px-3 py-2">
      <div className="text-xs font-semibold uppercase text-slate-500">
        {label}
      </div>
      <div className="text-base font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function ExportMonthDialog({
  exportHref,
  exportMonthKeys,
  monthOptions,
  onClose,
  onExportMonthKeysChange
}: {
  exportHref: string;
  exportMonthKeys: string[];
  monthOptions: Array<{ value: string; label: string }>;
  onClose: () => void;
  onExportMonthKeysChange: (monthKeys: string[]) => void;
}) {
  const hasSelection = exportMonthKeys.length > 0;

  return (
    <div
      className="fixed inset-0 z-[500] grid place-items-center bg-slate-950/35 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Export promotion plan Excel"
    >
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-950">
              Export promotion plan
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Select one or more months. Each month exports complete saved history
              for the selected country scope as a separate editable sheet.
            </p>
          </div>
          <button
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            type="button"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Export months</span>
          <select
            className="h-44 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold normal-case text-slate-950 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            multiple
            value={exportMonthKeys}
            onChange={(event) =>
              onExportMonthKeysChange(
                Array.from(event.currentTarget.selectedOptions).map(
                  (option) => option.value
                )
              )
            }
          >
            {monthOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-500">
            {hasSelection
              ? `${exportMonthKeys.length} month(s) selected`
              : "Choose at least one month"}
          </span>
          <div className="flex items-center gap-2">
            <button
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>
            <a
              className={`rounded-md px-3 py-2 text-sm font-semibold ${
                hasSelection
                  ? "bg-slate-950 text-white hover:bg-slate-800"
                  : "pointer-events-none bg-slate-200 text-slate-500"
              }`}
              href={hasSelection ? exportHref : "#"}
              onClick={(event) => {
                if (!hasSelection) {
                  event.preventDefault();
                  return;
                }
                onClose();
              }}
            >
              Export Excel
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewLaunchedProductsNotice({
  missingProducts,
  noDataProducts,
  onReview
}: {
  missingProducts: NewLaunchedProductReview[];
  noDataProducts: NewLaunchedProductReview[];
  onReview: () => void;
}) {
  if (missingProducts.length === 0 && noDataProducts.length === 0) {
    return null;
  }

  const previewProducts = [...missingProducts, ...noDataProducts].slice(0, 4);

  return (
    <div
      className={`rounded-md border px-3 py-2 text-xs ${
        missingProducts.length > 0
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-slate-200 bg-slate-50 text-slate-700"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-semibold">
            New launched products this month:{" "}
            {missingProducts.length + noDataProducts.length}
          </div>
          <div className="mt-1 text-[11px] text-slate-600">
            {missingProducts.length > 0
              ? `${missingProducts.length} optional review item(s) are not included in this plan. Add them if needed; this completed plan can still be submitted.`
              : "No active RRP/channel data for the listed products yet."}
          </div>
        </div>
        {missingProducts.length > 0 ? (
          <button
            className="rounded border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
            type="button"
            onClick={onReview}
          >
            Review in add rows
          </button>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {previewProducts.map((product) => (
          <span
            className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200"
            key={product.sku}
          >
            {product.sku} · {formatShortDate(product.launchedAt)}
            {product.status === "NO_ACTIVE_PLAN_DATA"
              ? " · No active RRP/channel data"
              : ""}
          </span>
        ))}
        {missingProducts.length + noDataProducts.length > previewProducts.length ? (
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">
            +{missingProducts.length + noDataProducts.length - previewProducts.length}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function AddPromotionRowsPanel({
  rows,
  totalCandidateCount,
  candidateView,
  newLaunchedCount,
  preLaunchCount,
  preLaunchConfigurationIssues,
  selectedKeys,
  canEdit,
  onCandidateViewChange,
  onToggle,
  onAddSelected,
  onAddAllVisible
}: {
  rows: NormalTableRow[];
  totalCandidateCount: number;
  candidateView: "all" | "newLaunched" | "preLaunch";
  newLaunchedCount: number;
  preLaunchCount: number;
  preLaunchConfigurationIssues: Array<{
    model: string;
    productName: string;
    plannedLaunchAt: string;
    missingSetup: string;
  }>;
  selectedKeys: string[];
  canEdit: boolean;
  onCandidateViewChange: (view: "all" | "newLaunched" | "preLaunch") => void;
  onToggle: (key: string, checked: boolean) => void;
  onAddSelected: () => void;
  onAddAllVisible: (keys: string[]) => void;
}) {
  const [countryFilter, setCountryFilter] = useState("ALL");
  const [channelFilter, setChannelFilter] = useState("ALL");
  const [productFilter, setProductFilter] = useState("ALL");

  const countryOptions = useMemo(
    () => [...new Set(rows.map((row) => row.countryCode))].sort(),
    [rows]
  );
  const channelOptions = useMemo(
    () =>
      [
        ...new Set(
          rows
            .filter(
              (row) => countryFilter === "ALL" || row.countryCode === countryFilter
            )
            .map((row) => row.channelName)
        )
      ].sort(),
    [countryFilter, rows]
  );
  const productOptions = useMemo(() => {
    const options = new Map<string, { value: string; label: string }>();
    for (const row of rows) {
      if (countryFilter !== "ALL" && row.countryCode !== countryFilter) {
        continue;
      }
      if (channelFilter !== "ALL" && row.channelName !== channelFilter) {
        continue;
      }
      const value = row.model;
      if (!options.has(value)) {
        options.set(value, {
          value,
          label: `${row.productName} · ${row.model}`
        });
      }
    }
    return [...options.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [channelFilter, countryFilter, rows]);

  useEffect(() => {
    if (countryFilter !== "ALL" && !countryOptions.includes(countryFilter)) {
      setCountryFilter("ALL");
    }
  }, [countryFilter, countryOptions]);

  useEffect(() => {
    if (channelFilter !== "ALL" && !channelOptions.includes(channelFilter)) {
      setChannelFilter("ALL");
    }
  }, [channelFilter, channelOptions]);

  useEffect(() => {
    if (
      productFilter !== "ALL" &&
      !productOptions.some((option) => option.value === productFilter)
    ) {
      setProductFilter("ALL");
    }
  }, [productFilter, productOptions]);

  const filteredRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          (countryFilter === "ALL" || row.countryCode === countryFilter) &&
          (channelFilter === "ALL" || row.channelName === channelFilter) &&
          (productFilter === "ALL" || row.model === productFilter)
      ),
    [channelFilter, countryFilter, productFilter, rows]
  );
  const visibleKeys = useMemo(
    () => filteredRows.map((row) => promotionPlanBusinessKeyForRow(row)),
    [filteredRows]
  );
  const displayedRows = filteredRows.slice(0, 120);
  const selectedSet = new Set(selectedKeys);
  const hasPanelFilters =
    countryFilter !== "ALL" || channelFilter !== "ALL" || productFilter !== "ALL";

  return (
    <div className="grid gap-2 rounded-md border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-950">
            Add promotion rows
          </div>
          <div className="text-xs text-slate-500">
            Choose Country, Channel / Retailer, and Product / Model to add eligible
            rows. Rows already in this month are excluded.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
            <button
              className={`rounded px-2 py-1 text-[11px] font-semibold ${
                candidateView === "all"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
              type="button"
              onClick={() => onCandidateViewChange("all")}
            >
              All
            </button>
            <button
              className={`rounded px-2 py-1 text-[11px] font-semibold ${
                candidateView === "newLaunched"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
              type="button"
              onClick={() => onCandidateViewChange("newLaunched")}
            >
              New launched
            </button>
            <button
              className={`rounded px-2 py-1 text-[11px] font-semibold ${
                candidateView === "preLaunch"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
              type="button"
              onClick={() => onCandidateViewChange("preLaunch")}
            >
              Pre-launch
            </button>
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
            {selectedKeys.length} selected · {filteredRows.length} shown ·{" "}
            {totalCandidateCount} total · {newLaunchedCount} new · {preLaunchCount} pre-launch
          </span>
          <button
            className="rounded border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            type="button"
            disabled={!canEdit || selectedKeys.length === 0}
            onClick={onAddSelected}
          >
            Add selected
          </button>
          <button
            className="rounded bg-slate-950 px-2.5 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            type="button"
            disabled={!canEdit || visibleKeys.length === 0}
            onClick={() => onAddAllVisible(visibleKeys)}
          >
            Add all visible
          </button>
        </div>
      </div>
      {candidateView === "preLaunch" && preLaunchConfigurationIssues.length > 0 ? (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
          <span className="font-semibold">Pre-launch products needing setup:</span>{" "}
          {preLaunchConfigurationIssues
            .slice(0, 4)
            .map(
              (issue) =>
                `${issue.productName} (${issue.model}) - ${issue.missingSetup}`
            )
            .join("; ")}
          {preLaunchConfigurationIssues.length > 4
            ? `; +${preLaunchConfigurationIssues.length - 4} more`
            : ""}
        </div>
      ) : null}
      <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 md:grid-cols-[minmax(120px,180px)_minmax(160px,240px)_minmax(220px,1fr)_auto] md:items-end">
        <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Country
          <select
            className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold normal-case tracking-normal text-slate-900"
            value={countryFilter}
            onChange={(event) => setCountryFilter(event.target.value)}
          >
            <option value="ALL">All countries</option>
            {countryOptions.map((countryCode) => (
              <option key={countryCode} value={countryCode}>
                {countryCode}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Channel / Retailer
          <select
            className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold normal-case tracking-normal text-slate-900"
            value={channelFilter}
            onChange={(event) => setChannelFilter(event.target.value)}
          >
            <option value="ALL">All channels</option>
            {channelOptions.map((channelName) => (
              <option key={channelName} value={channelName}>
                {channelName}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Product / Model
          <select
            className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold normal-case tracking-normal text-slate-900"
            value={productFilter}
            onChange={(event) => setProductFilter(event.target.value)}
          >
            <option value="ALL">All products</option>
            {productOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="h-8 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
          type="button"
          disabled={!hasPanelFilters}
          onClick={() => {
            setCountryFilter("ALL");
            setChannelFilter("ALL");
            setProductFilter("ALL");
          }}
        >
          Clear
        </button>
      </div>
      {filteredRows.length === 0 ? (
        <div className="rounded border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
          No eligible product-channel candidates match the current filters.
        </div>
      ) : (
        <div className="max-h-80 overflow-auto rounded border border-slate-200">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-10 border-b border-slate-200 px-2 py-2">Add</th>
                <th className="border-b border-slate-200 px-2 py-2">Country</th>
                <th className="border-b border-slate-200 px-2 py-2">Channel / FD</th>
                <th className="border-b border-slate-200 px-2 py-2">Product</th>
                <th className="border-b border-slate-200 px-2 py-2 text-right">RRP</th>
                <th className="border-b border-slate-200 px-2 py-2">Planned launch</th>
              </tr>
            </thead>
            <tbody>
              {displayedRows.map((row) => {
                const businessKey = promotionPlanBusinessKeyForRow(row);
                return (
                  <tr key={businessKey} className="hover:bg-slate-50">
                    <td className="border-b border-slate-100 px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={selectedSet.has(businessKey)}
                        disabled={!canEdit}
                        onChange={(event) =>
                          onToggle(businessKey, event.target.checked)
                        }
                      />
                    </td>
                    <td className="border-b border-slate-100 px-2 py-2 font-semibold text-slate-900">
                      {row.countryCode}
                    </td>
                    <td className="border-b border-slate-100 px-2 py-2 text-slate-700">
                      <div className="font-semibold">{row.channelName}</div>
                      <div className="text-[10px] text-slate-500">
                        {row.fdName} · {row.incoterms}
                      </div>
                    </td>
                    <td className="border-b border-slate-100 px-2 py-2 text-slate-700">
                      <div className="font-semibold text-slate-900">
                        {row.productName}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {row.model} · {row.category}
                      </div>
                    </td>
                    <td className="border-b border-slate-100 px-2 py-2 text-right font-semibold text-slate-900">
                      {formatMoney(row.rrpLocal, row.currency)}
                    </td>
                    <td className="border-b border-slate-100 px-2 py-2 text-slate-700">
                      {row.productLifecycleStatus === "UNLAUNCHED" && row.plannedLaunchAt
                        ? formatEuropeanDate(row.plannedLaunchAt)
                        : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredRows.length > displayedRows.length ? (
            <div className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Showing first {displayedRows.length} candidates. Narrow filters to inspect more.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function MonthStatusSummary({
  countryCodes,
  editableCountryCodes,
  returnNoteByCountry,
  statusByCountry,
  selectedYear,
  selectedMonth,
  role,
  accessibleCountryCodes
}: {
  countryCodes: string[];
  editableCountryCodes: string[];
  returnNoteByCountry: Map<string, string>;
  statusByCountry: Map<string, PromotionPlanStatus>;
  selectedYear: number;
  selectedMonth: number;
  role: UserRole;
  accessibleCountryCodes: string[];
}) {
  const editableSet = new Set(editableCountryCodes);

  if (countryCodes.length === 0) {
    return (
      <div className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-500">
        No countries match the current filters.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1.5">
      {countryCodes.map((countryCode) => {
        const status = statusByCountry.get(countryCode) ?? "DRAFT";
        const editState = getPromotionPlanEditState({
          role,
          hasCountryAccess: hasPromotionCountryAccess(
            role,
            countryCode,
            accessibleCountryCodes
          ),
          planYear: selectedYear,
          planMonth: selectedMonth,
          status
        });
        const returnNote = returnNoteByCountry.get(countryCode);
        return (
          <div key={countryCode} className="flex flex-wrap items-center gap-1">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                editableSet.has(countryCode)
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {countryCode} · {status === "REJECTED" ? "RETURNED FOR REVISION" : status}
              {editState.reason ? ` · ${editState.reason}` : ""}
            </span>
            {status === "REJECTED" && returnNote ? (
              <span className="max-w-full break-words text-[11px] font-medium text-amber-800">
                Revision: {returnNote}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function StatusNotice({
  status,
  showArchiveLinks
}: {
  status: ApiResult;
  showArchiveLinks: boolean;
}) {
  const isError = status.status === "error";
  const archiveId = status.archive?.id;
  const driveUrl = status.archive?.driveUrl ?? null;

  return (
    <div
      className={`rounded-md border px-3 py-2 text-sm ${
        isError
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-800"
      }`}
    >
      <div className="font-semibold">{status.message ?? "Done."}</div>
      {status.monthKeys?.length ? (
        <div className="mt-1 text-xs">Months: {status.monthKeys.join(", ")}</div>
      ) : null}
      {status.errors?.length ? (
        <div className="mt-1 text-xs">
          {status.errors.slice(0, 3).map((error) => error.message).join(" | ")}
          {status.errors.length > 3 ? ` (+${status.errors.length - 3} more)` : ""}
        </div>
      ) : null}
      {status.emailNotification ? (
        <div className="mt-1 text-xs">
          Approval email:{" "}
          {emailNotificationLabel(status.emailNotification.status)}
          {status.emailNotification.errorMessage
            ? ` · ${status.emailNotification.errorMessage}`
            : ""}
        </div>
      ) : null}
      {showArchiveLinks && archiveId ? (
        <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
          <a
            className="underline"
            href={`/api/promotion-plan/archives/${archiveId}/download`}
          >
            Download archive
          </a>
          {driveUrl ? (
            <a
              className="underline"
              href={driveUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open Drive copy
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function emailNotificationLabel(status: ApiEmailNotification["status"]) {
  if (status === "SENT") {
    return "sent";
  }

  if (status === "FAILED") {
    return "failed";
  }

  if (status === "PENDING") {
    return "pending";
  }

  return "not configured";
}

function emailStatusClass(status: ApiEmailNotification["status"]) {
  if (status === "SENT") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "FAILED") {
    return "bg-rose-50 text-rose-700";
  }

  if (status === "PENDING") {
    return "bg-sky-50 text-sky-700";
  }

  return "bg-amber-50 text-amber-800";
}

function archiveStatusLabel(
  status: PromotionPlanArchiveOption["driveStatus"] | undefined
) {
  if (status === "UPLOADED") {
    return "Drive archived";
  }

  if (status === "FAILED") {
    return "Drive failed";
  }

  return "Drive not configured";
}

function archiveStatusClass(
  status: PromotionPlanArchiveOption["driveStatus"] | undefined
) {
  if (status === "UPLOADED") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "FAILED") {
    return "bg-rose-50 text-rose-700";
  }

  return "bg-amber-50 text-amber-800";
}

function yearOptions(selectedYear: number) {
  const currentYear = new Date().getFullYear();
  return Array.from(
    new Set([
      currentYear - 1,
      currentYear,
      currentYear + 1,
      currentYear + 2,
      selectedYear
    ])
  ).sort((left, right) => left - right);
}

function yearMonthOptions(selectedYear: number, selectedMonth: number) {
  const options = MONTHS.map((item) => ({
    value: promotionPlanMonthKey({ year: selectedYear, month: item.value }),
    label: `${selectedYear}-${String(item.value).padStart(2, "0")} · ${item.label}`
  }));
  const selectedKey = promotionPlanMonthKey({
    year: selectedYear,
    month: selectedMonth
  });
  return options.some((item) => item.value === selectedKey)
    ? options
    : [
        ...options,
        {
          value: selectedKey,
          label: selectedKey
        }
      ];
}

function previousMonthKey(month: { year: number; month: number }) {
  return promotionPlanMonthKey(
    month.month === 1
      ? { year: month.year - 1, month: 12 }
      : { year: month.year, month: month.month - 1 }
  );
}

function monthFromKey(value: string) {
  const match = value.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2])
  };
}

function copySourceMonthOptions(selectedYear: number, selectedMonth: number) {
  const selectedDate = new Date(Date.UTC(selectedYear, selectedMonth - 1, 1));
  return Array.from({ length: 18 }, (_item, index) => {
    const date = new Date(
      Date.UTC(
        selectedDate.getUTCFullYear(),
        selectedDate.getUTCMonth() - index - 1,
        1
      )
    );
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const monthKey = promotionPlanMonthKey({ year, month });
    const label = MONTHS.find((item) => item.value === month)?.label ?? monthKey;
    return {
      value: monthKey,
      label: `${monthKey} · ${label}`
    };
  });
}

function approvalQueueMonthLabel(item: PromotionPlanApprovalQueueItem) {
  return `${item.planYear}-${String(item.planMonth).padStart(2, "0")}`;
}

function deliveryPeriodLabel(
  notification: PromotionPlanEmailNotificationOption,
  archive: PromotionPlanArchiveOption | null
) {
  if (
    notification.planMonth === 0 ||
    archive?.source.startsWith("BUSINESS_PLAN")
  ) {
    return `${notification.planYear} BP`;
  }

  return promotionPlanMonthKey({
    year: notification.planYear,
    month: notification.planMonth
  });
}

function approvalStageLabel(stage: PromotionPlanApprovalQueueItem["stage"]) {
  return stage === "final" ? "Final approval" : "First approval";
}

function formatSubmittedAt(value: string | null) {
  if (!value) {
    return "No submit time";
  }

  return formatEuropeanDateTime(value);
}

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" }
];

function createPromotionPlanDraftEntry({
  row,
  planYear,
  planMonth,
  sequence
}: {
  row: NormalTableRow;
  planYear: number;
  planMonth: number;
  sequence: number;
}): PromotionPlanEntryOption {
  const timestamp = new Date().toISOString();
  return {
    id: `${createPromotionPlanDraftId()}-${sequence}`,
    planYear,
    planMonth,
    countryCode: row.countryCode,
    retailerName: row.retailerName,
    promotionName: null,
    fdName: row.fdName,
    incoterms: row.incoterms,
    category: row.category,
    productSku: row.model,
    productName: row.productName,
    promoRrpLocal: null,
    promoRrpEur: null,
    promoFrontMargin: null,
    dealType: "NORMAL",
    promoFdMargin: null,
    dealNote: null,
    promoVolume: null,
    promoStartDate: null,
    promoEndDate: null,
    snapshotCurrency: row.currency,
    snapshotLifecycleStatus: row.productLifecycleStatus,
    snapshotRrpLocal: row.rrpLocal,
    snapshotRrpEur: row.rrpEur,
    snapshotVatRate: row.vatRate,
    snapshotBaseFrontMargin: row.kaFrontMargin,
    snapshotKaBuyingMargin: row.kaBuyingMargin,
    snapshotKaBackMargin: row.kaBackMargin,
    snapshotFdMargin: row.fdMargin,
    snapshotTransportCost: row.logisticsCost,
    snapshotBomCost: row.bomCost,
    createdByEmail: null,
    updatedByEmail: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function createPromotionPlanDraftId() {
  return `draft-promotion-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isPromotionPlanDraftEntryId(entryId: string) {
  return entryId.startsWith("draft-promotion-");
}

function withDefaultPromotionPeriod(
  inputsByRow: PromotionInputsByRow,
  rows: Array<{ key: string }>,
  year: number,
  month: number
): PromotionInputsByRow {
  const defaults = defaultPromotionPlanPeriod({ year, month });
  const nextInputs: PromotionInputsByRow = {};

  for (const row of rows) {
    const current = inputsByRow[row.key] ?? {};
    const period = normalizePromotionPlanPeriod({
      month: { year, month },
      promoStartDate: current.promoStartDate,
      promoEndDate: current.promoEndDate,
      treatInvalidAsBlank: true
    });
    nextInputs[row.key] = {
      ...current,
      promoStartDate: "error" in period ? defaults.startDate : period.promoStartDate,
      promoEndDate: "error" in period ? defaults.endDate : period.promoEndDate
    };
  }

  return nextInputs;
}

function periodTargetKey(countryCode: string, channelName: string) {
  return `${countryCode.trim().toUpperCase()}|${channelName.trim().toLowerCase()}`;
}

function normalizeSku(value: string) {
  return value.trim().toUpperCase();
}

function formatShortDate(value: string) {
  return formatEuropeanDate(value);
}

function promotionPeriodError(startDate: string, endDate: string) {
  const parsedStartDate = parsePromotionDateInput(startDate);
  const parsedEndDate = parsePromotionDateInput(endDate);
  if (!parsedStartDate || !parsedEndDate) {
    return "Promo period dates must use DD/MM/YYYY.";
  }

  if (parsedEndDate < parsedStartDate) {
    return "Promo End Date cannot be earlier than Promo Start Date.";
  }

  return null;
}
