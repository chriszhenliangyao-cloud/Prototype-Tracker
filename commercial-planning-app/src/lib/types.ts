import type { SettlementMode, WarningLevel } from "./calculations/valueChain";

export type RecordStatus = "ACTIVE" | "INACTIVE";
export type ProductLifecycleStatus = "LAUNCHED" | "UNLAUNCHED" | "EOL";
export type UserRole =
  | "OWNER"
  | "GTM_LEADER"
  | "GM"
  | "ADMIN"
  | "FINANCE"
  | "SALES_MANAGER"
  | "KA_OWNER"
  | "VIEWER";
export type ScenarioType = "NORMAL" | "PROMOTION";
export type ScenarioStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "ARCHIVED";
export type MasterDataArchiveDriveStatus =
  | "NOT_CONFIGURED"
  | "UPLOADED"
  | "FAILED";
export type PromotionPlanArchiveDriveStatus = MasterDataArchiveDriveStatus;
export type PromotionPlanStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "FIRST_APPROVED"
  | "APPROVED"
  | "REJECTED";
export type PromotionPlanApprovalRole =
  | "NONE"
  | "FIRST_APPROVER"
  | "FINAL_APPROVER";
export type PromotionPlanEmailNotificationStatus =
  | "SENT"
  | "FAILED"
  | "PENDING"
  | "NOT_CONFIGURED";

export type CountryOption = {
  id: string;
  name: string;
  code: string;
  vatRate: number;
  currency: string;
  status: RecordStatus;
  effectiveDate: string;
};

export type CurrencyExchangeRateOption = {
  id: string;
  currency: string;
  exchangeRateToEur: number;
  effectiveDate: string;
  status: RecordStatus;
};

export type ProductOption = {
  id: string;
  sku: string;
  name: string;
  category: string;
  capacity: string | null;
  lifecycleStatus: ProductLifecycleStatus;
  launchedAt?: string | null;
  plannedLaunchAt?: string | null;
  status: RecordStatus;
};

export type BomCostOption = {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  bomCost: number;
  bomCostRmb?: number | null;
  currency: string;
  effectiveDate: string;
  status: RecordStatus;
};

export type LogisticsCostOption = {
  id: string;
  countryId: string;
  countryCode: string;
  category: string;
  productSize: string;
  logisticsCost: number;
  currency: string;
  effectiveDate: string;
  status: RecordStatus;
};

export type ProductCountryRrpOption = {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  countryId: string;
  countryCode: string;
  rrpLocal: number;
  rrpEur: number;
  currency: string;
  effectiveDate: string;
  status: RecordStatus;
};

export type OperationalMarginOption = {
  id: string;
  countryId: string;
  countryCode: string;
  retailerName: string;
  fdName: string;
  incoterms: string;
  category: string;
  kaBuyingMargin: number;
  kaFrontMargin: number;
  kaBackMargin: number;
  fdMargin: number;
  effectiveDate: string;
  status: RecordStatus;
};

export type ChannelMarginOption = {
  id: string;
  countryId: string;
  countryCode: string;
  channelName: string;
  kaName: string;
  category: string;
  normalFrontMargin: number;
  normalBackMargin: number;
  promoFrontMargin: number;
  promoBackMargin: number;
  effectiveDate: string;
  status: RecordStatus;
};

export type FdMarginOption = {
  id: string;
  countryId: string;
  countryCode: string;
  fdName: string;
  channelName: string;
  category: string;
  normalFdMargin: number;
  promoFdMargin: number;
  effectiveDate: string;
  status: RecordStatus;
};

export type ReferenceData = {
  countries: CountryOption[];
  exchangeRates?: CurrencyExchangeRateOption[];
  products: ProductOption[];
  bomCosts: BomCostOption[];
  logisticsCosts: LogisticsCostOption[];
  productCountryRrps: ProductCountryRrpOption[];
  operationalMargins: OperationalMarginOption[];
  channelMargins: ChannelMarginOption[];
  fdMargins: FdMarginOption[];
};

export type UserCountryAccessOption = {
  id: string;
  email: string;
  label: string | null;
  countryCode: string;
  role: UserRole;
  approvalRole: PromotionPlanApprovalRole;
  receivesPromotionPlanEmail: boolean;
  status: RecordStatus;
  createdByEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PromotionPlanEmailRecipientOption = {
  id: string;
  email: string;
  label: string | null;
  countryCode: string;
  status: RecordStatus;
  createdByEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MasterDataArchiveOption = {
  id: string;
  source: string;
  sourceReference: string | null;
  title: string;
  message: string;
  workbookFileName: string;
  driveStatus: MasterDataArchiveDriveStatus;
  driveFileId: string | null;
  driveUrl: string | null;
  createdByEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OtherApprovalAttachmentOption = {
  id: string;
  requestId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedByEmail: string | null;
  createdAt: string;
};

export type OtherApprovalRequestAuditOption = {
  id: string;
  requestId: string;
  event: string;
  revision: number;
  note: string | null;
  changedFields: string[];
  previousValues: Record<string, string> | null;
  nextValues: Record<string, string> | null;
  actorEmail: string | null;
  createdAt: string;
};

export type OtherApprovalWorkflowState =
  | "ACTIVE"
  | "RETURNED_FOR_REVISION"
  | "WITHDRAWN"
  | "CANCELLED_DUPLICATE"
  | "REJECTED_CLOSED";

export type OtherApprovalRequestOption = {
  id: string;
  title: string;
  countryCode: string;
  channelName: string;
  feeType: string;
  description: string;
  tableData: string;
  status: PromotionPlanStatus;
  workflowState: OtherApprovalWorkflowState;
  duplicateOfRequestId: string | null;
  submittedByEmail: string | null;
  firstApprovedByEmail: string | null;
  approvedByEmail: string | null;
  rejectedByEmail: string | null;
  submittedAt: string | null;
  firstApprovedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  notes: string | null;
  createdByEmail: string | null;
  updatedByEmail: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: OtherApprovalAttachmentOption[];
  revision: number;
  audits: OtherApprovalRequestAuditOption[];
};

export type PromotionPlanEntryOption = {
  id: string;
  planYear: number;
  planMonth: number;
  countryCode: string;
  retailerName: string;
  promotionName: string | null;
  fdName: string;
  incoterms: string;
  category: string;
  productSku: string;
  productName: string | null;
  promoRrpLocal: number | null;
  promoRrpEur: number | null;
  promoFrontMargin: number | null;
  dealType: PromotionPlanDealType;
  promoFdMargin: number | null;
  dealNote: string | null;
  promoVolume: number | null;
  promoStartDate: string | null;
  promoEndDate: string | null;
  snapshotCurrency: string | null;
  snapshotLifecycleStatus: ProductLifecycleStatus | null;
  snapshotRrpLocal: number | null;
  snapshotRrpEur: number | null;
  snapshotVatRate: number | null;
  snapshotBaseFrontMargin: number | null;
  snapshotKaBuyingMargin: number | null;
  snapshotKaBackMargin: number | null;
  snapshotFdMargin: number | null;
  snapshotTransportCost: number | null;
  snapshotBomCost: number | null;
  createdByEmail: string | null;
  updatedByEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BusinessPlanChannelProductOverrideOption = {
  id: string;
  channelProfileId: string;
  productSku: string;
  rrpLocal: number | null;
  rrpEur: number | null;
  currency: string | null;
  kaBuyingMargin: number | null;
  kaFrontMargin: number | null;
  kaBackMargin: number | null;
  fdMargin: number | null;
  bomCost: number | null;
  logisticsCost: number | null;
  createdByEmail: string | null;
  updatedByEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BusinessPlanChannelProfileOption = {
  id: string;
  planYear: number;
  countryCode: string;
  retailerName: string;
  fdName: string;
  incoterms: string;
  kaBuyingMargin: number;
  kaFrontMargin: number;
  kaBackMargin: number;
  fdMargin: number;
  productOverrides: BusinessPlanChannelProductOverrideOption[];
  createdByEmail: string | null;
  updatedByEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PromotionPlanDealType = "NORMAL" | "B2B_DEAL" | "EOL_DEAL";

export type PromotionPlanMonthStatusOption = {
  id: string;
  planYear: number;
  planMonth: number;
  countryCode: string;
  status: PromotionPlanStatus;
  submittedByEmail: string | null;
  firstApprovedByEmail: string | null;
  approvedByEmail: string | null;
  rejectedByEmail: string | null;
  submittedAt: string | null;
  firstApprovedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PromotionPlanApprovalQueueItem = {
  id: string;
  planYear: number;
  planMonth: number;
  countryCode: string;
  status: Extract<PromotionPlanStatus, "SUBMITTED" | "FIRST_APPROVED">;
  submittedByEmail: string | null;
  submittedAt: string | null;
  entryCount: number;
  stage: "first" | "final";
  canApprove: boolean;
  canReturnForRevision: boolean;
  updatedAt: string;
};

export type BusinessPlanEntryOption = {
  id: string;
  planYear: number;
  planMonth: number;
  countryCode: string;
  retailerName: string;
  fdName: string;
  incoterms: string;
  category: string;
  productSku: string;
  productName: string | null;
  channelProfileId?: string | null;
  promoPriceLocal: number | null;
  promoDiscountPercent: number;
  siUnits: number;
  soUnits: number;
  source?: "MASTER_DATA" | "BP_ASSUMPTION";
  snapshotCurrency?: string | null;
  snapshotRrpLocal?: number | null;
  snapshotRrpEur?: number | null;
  snapshotKaBuyingMargin?: number | null;
  snapshotKaFrontMargin?: number | null;
  snapshotKaBackMargin?: number | null;
  snapshotFdMargin?: number | null;
  snapshotBomCost?: number | null;
  snapshotLogisticsCost?: number | null;
  createdByEmail: string | null;
  updatedByEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BusinessPlanActualEntryOption = {
  id: string;
  planYear: number;
  planMonth: number;
  countryCode: string;
  customerName: string;
  poNumber: string;
  poDate: string;
  productModel: string | null;
  productName: string | null;
  sourceLineKey: string;
  siUnits: number;
  siValueEur: number;
  sourceFileName: string | null;
  importedByEmail: string | null;
  importedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type BusinessPlanYearStatusOption = {
  id: string;
  planYear: number;
  countryCode: string;
  status: PromotionPlanStatus;
  submittedByEmail: string | null;
  firstApprovedByEmail: string | null;
  approvedByEmail: string | null;
  rejectedByEmail: string | null;
  submittedAt: string | null;
  firstApprovedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BusinessPlanApprovalQueueItem = {
  id: string;
  planYear: number;
  countryCode: string;
  status: Extract<PromotionPlanStatus, "SUBMITTED" | "FIRST_APPROVED">;
  submittedByEmail: string | null;
  submittedAt: string | null;
  entryCount: number;
  stage: "first" | "final";
  updatedAt: string;
};

export type PromotionPlanArchiveOption = {
  id: string;
  planYear: number | null;
  planMonth: number | null;
  source: string;
  sourceReference: string | null;
  title: string;
  message: string;
  workbookFileName: string;
  driveStatus: PromotionPlanArchiveDriveStatus;
  driveFileId: string | null;
  driveUrl: string | null;
  createdByEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PromotionPlanEmailNotificationOption = {
  id: string;
  archiveId: string | null;
  planYear: number;
  planMonth: number;
  countryCodes: string[];
  toEmails: string[];
  ccEmails: string[];
  status: PromotionPlanEmailNotificationStatus;
  provider: string;
  attemptCount: number;
  lastAttemptAt: string | null;
  messageId: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  createdByEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ScenarioComparisonRow = {
  id: string;
  name: string;
  type: ScenarioType;
  country: string;
  countryCode: string;
  currency: string;
  sku: string;
  productName: string;
  channel: string;
  kaName: string;
  fdName: string;
  status: ScenarioStatus;
  settlementMode: SettlementMode | null;
  normalRrp: number | null;
  promoRrp: number | null;
  rebatePerUnit: number | null;
  totalRebate: number | null;
  gp: number | null;
  gpPercent: number | null;
  np: number | null;
  npPercent: number | null;
  warningLevel: WarningLevel;
  createdAt: string;
};

export type DashboardMetrics = {
  averageGpPercent: number;
  averageNpPercent: number;
  totalRebate: number;
  lowGpScenarios: number;
  lowNpPromotionScenarios: number;
  pendingApprovalScenarios: number;
  scenarioCount: number;
};
