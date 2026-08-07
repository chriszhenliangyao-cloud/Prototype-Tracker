-- This migration is intentionally not applied during the isolated-copy phase.
-- It contains only the non-Settlement commercial-planning domain.
CREATE SCHEMA IF NOT EXISTS commercial_planning;
REVOKE ALL ON SCHEMA commercial_planning FROM PUBLIC, anon, authenticated;
SET search_path TO commercial_planning, public;

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'GTM_LEADER', 'GM', 'ADMIN', 'FINANCE', 'SALES_MANAGER', 'KA_OWNER', 'VIEWER');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ProductLifecycleStatus" AS ENUM ('LAUNCHED', 'UNLAUNCHED', 'EOL');

-- CreateEnum
CREATE TYPE "ScenarioType" AS ENUM ('NORMAL', 'PROMOTION');

-- CreateEnum
CREATE TYPE "SettlementMode" AS ENUM ('INVOICE_DISCOUNT', 'REBATE_CLAIM');

-- CreateEnum
CREATE TYPE "ScenarioStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WarningLevel" AS ENUM ('GOOD', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "PromotionPlanStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'FIRST_APPROVED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PromotionPlanApprovalRole" AS ENUM ('NONE', 'FIRST_APPROVER', 'FINAL_APPROVER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "countries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "vatRate" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currency_exchange_rates" (
    "id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "exchangeRateToEur" DECIMAL(65,30) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currency_exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "capacity" TEXT,
    "lifecycleStatus" "ProductLifecycleStatus" NOT NULL DEFAULT 'LAUNCHED',
    "launchedAt" TIMESTAMP(3),
    "plannedLaunchAt" TIMESTAMP(3),
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_costs" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "bomCost" DECIMAL(65,30) NOT NULL,
    "bomCostRmb" DECIMAL(65,30),
    "currency" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bom_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logistics_costs" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "productSize" TEXT NOT NULL,
    "logisticsCost" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "logistics_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_country_rrps" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "rrpLocal" DECIMAL(65,30) NOT NULL,
    "rrpEur" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_country_rrps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_margins" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "retailerName" TEXT NOT NULL,
    "fdName" TEXT NOT NULL,
    "incoterms" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "kaBuyingMargin" DECIMAL(65,30) NOT NULL,
    "kaFrontMargin" DECIMAL(65,30) NOT NULL,
    "kaBackMargin" DECIMAL(65,30) NOT NULL,
    "fdMargin" DECIMAL(65,30) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operational_margins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_margins" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "channelName" TEXT NOT NULL,
    "kaName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "normalFrontMargin" DECIMAL(65,30) NOT NULL,
    "normalBackMargin" DECIMAL(65,30) NOT NULL,
    "promoFrontMargin" DECIMAL(65,30) NOT NULL,
    "promoBackMargin" DECIMAL(65,30) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_margins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fd_margins" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "fdName" TEXT NOT NULL,
    "channelName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "normalFdMargin" DECIMAL(65,30) NOT NULL,
    "promoFdMargin" DECIMAL(65,30) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fd_margins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenarios" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ScenarioType" NOT NULL,
    "countryId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "channelMarginId" TEXT NOT NULL,
    "fdMarginId" TEXT NOT NULL,
    "settlementMode" "SettlementMode",
    "status" "ScenarioStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenario_inputs" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "normalRrp" DECIMAL(65,30),
    "promoRrp" DECIMAL(65,30),
    "vatRate" DECIMAL(65,30) NOT NULL,
    "normalFrontMargin" DECIMAL(65,30) NOT NULL,
    "normalBackMargin" DECIMAL(65,30) NOT NULL,
    "normalFdMargin" DECIMAL(65,30) NOT NULL,
    "promoFrontMargin" DECIMAL(65,30),
    "promoBackMargin" DECIMAL(65,30),
    "promoFdMargin" DECIMAL(65,30),
    "bomCost" DECIMAL(65,30) NOT NULL,
    "logisticsCost" DECIMAL(65,30) NOT NULL,
    "promoVolume" INTEGER,
    "overrideReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scenario_inputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenario_results" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "rrpExVat" DECIMAL(65,30),
    "promoRrpExVat" DECIMAL(65,30),
    "priceAfterFrontMargin" DECIMAL(65,30),
    "kaBuyingPrice" DECIMAL(65,30),
    "fdBuyingPrice" DECIMAL(65,30),
    "promoPriceAfterFrontMargin" DECIMAL(65,30),
    "rebatePerUnit" DECIMAL(65,30),
    "totalRebate" DECIMAL(65,30),
    "promoKaNewBuyingPrice" DECIMAL(65,30),
    "promoFdNetPrice" DECIMAL(65,30),
    "gp" DECIMAL(65,30),
    "gpPercent" DECIMAL(65,30),
    "np" DECIMAL(65,30),
    "npPercent" DECIMAL(65,30),
    "warningLevel" "WarningLevel" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scenario_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data_archives" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceReference" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "workbookFileName" TEXT NOT NULL,
    "workbookBytes" BYTEA NOT NULL,
    "driveStatus" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
    "driveFileId" TEXT,
    "driveUrl" TEXT,
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_data_archives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_country_accesses" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "label" TEXT,
    "countryCode" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "approvalRole" "PromotionPlanApprovalRole" NOT NULL DEFAULT 'NONE',
    "receivesPromotionPlanEmail" BOOLEAN NOT NULL DEFAULT false,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_country_accesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_plan_entries" (
    "id" TEXT NOT NULL,
    "planYear" INTEGER NOT NULL,
    "planMonth" INTEGER NOT NULL,
    "countryCode" TEXT NOT NULL,
    "retailerName" TEXT NOT NULL,
    "promotionName" TEXT,
    "fdName" TEXT NOT NULL,
    "incoterms" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "productSku" TEXT NOT NULL,
    "productName" TEXT,
    "promoRrpLocal" DECIMAL(65,30),
    "promoRrpEur" DECIMAL(65,30),
    "promoFrontMargin" DECIMAL(65,30),
    "dealType" TEXT NOT NULL DEFAULT 'NORMAL',
    "promoFdMargin" DECIMAL(65,30),
    "dealNote" TEXT,
    "promoVolume" INTEGER,
    "promoStartDate" TIMESTAMP(3),
    "promoEndDate" TIMESTAMP(3),
    "snapshotCurrency" TEXT,
    "snapshotLifecycleStatus" "ProductLifecycleStatus",
    "snapshotRrpLocal" DECIMAL(65,30),
    "snapshotRrpEur" DECIMAL(65,30),
    "snapshotVatRate" DECIMAL(65,30),
    "snapshotBaseFrontMargin" DECIMAL(65,30),
    "snapshotKaBuyingMargin" DECIMAL(65,30),
    "snapshotKaBackMargin" DECIMAL(65,30),
    "snapshotFdMargin" DECIMAL(65,30),
    "snapshotTransportCost" DECIMAL(65,30),
    "snapshotBomCost" DECIMAL(65,30),
    "createdByEmail" TEXT,
    "updatedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_plan_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_plan_entries" (
    "id" TEXT NOT NULL,
    "planYear" INTEGER NOT NULL,
    "planMonth" INTEGER NOT NULL,
    "countryCode" TEXT NOT NULL,
    "retailerName" TEXT NOT NULL,
    "fdName" TEXT NOT NULL,
    "incoterms" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "productSku" TEXT NOT NULL,
    "productName" TEXT,
    "channelProfileId" TEXT,
    "promoPriceLocal" DECIMAL(65,30),
    "promoDiscountPercent" DECIMAL(65,30),
    "siUnits" INTEGER NOT NULL DEFAULT 0,
    "soUnits" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'MASTER_DATA',
    "snapshotCurrency" TEXT,
    "snapshotRrpLocal" DECIMAL(65,30),
    "snapshotRrpEur" DECIMAL(65,30),
    "snapshotKaBuyingMargin" DECIMAL(65,30),
    "snapshotKaFrontMargin" DECIMAL(65,30),
    "snapshotKaBackMargin" DECIMAL(65,30),
    "snapshotFdMargin" DECIMAL(65,30),
    "snapshotBomCost" DECIMAL(65,30),
    "snapshotLogisticsCost" DECIMAL(65,30),
    "createdByEmail" TEXT,
    "updatedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_plan_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_plan_actual_entries" (
    "id" TEXT NOT NULL,
    "planYear" INTEGER NOT NULL,
    "planMonth" INTEGER NOT NULL,
    "countryCode" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "poDate" TIMESTAMP(3) NOT NULL,
    "productModel" TEXT,
    "productName" TEXT,
    "sourceLineKey" TEXT NOT NULL,
    "siUnits" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "siValueEur" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sourceFileName" TEXT,
    "importedByEmail" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_plan_actual_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_plan_channel_profiles" (
    "id" TEXT NOT NULL,
    "planYear" INTEGER NOT NULL,
    "countryCode" TEXT NOT NULL,
    "retailerName" TEXT NOT NULL,
    "fdName" TEXT NOT NULL,
    "incoterms" TEXT NOT NULL,
    "kaBuyingMargin" DECIMAL(65,30) NOT NULL,
    "kaFrontMargin" DECIMAL(65,30) NOT NULL,
    "kaBackMargin" DECIMAL(65,30) NOT NULL,
    "fdMargin" DECIMAL(65,30) NOT NULL,
    "createdByEmail" TEXT,
    "updatedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_plan_channel_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_plan_channel_product_overrides" (
    "id" TEXT NOT NULL,
    "channelProfileId" TEXT NOT NULL,
    "productSku" TEXT NOT NULL,
    "rrpLocal" DECIMAL(65,30),
    "rrpEur" DECIMAL(65,30),
    "currency" TEXT,
    "kaBuyingMargin" DECIMAL(65,30),
    "kaFrontMargin" DECIMAL(65,30),
    "kaBackMargin" DECIMAL(65,30),
    "fdMargin" DECIMAL(65,30),
    "bomCost" DECIMAL(65,30),
    "logisticsCost" DECIMAL(65,30),
    "createdByEmail" TEXT,
    "updatedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_plan_channel_product_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_plan_year_statuses" (
    "id" TEXT NOT NULL,
    "planYear" INTEGER NOT NULL,
    "countryCode" TEXT NOT NULL,
    "status" "PromotionPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedByEmail" TEXT,
    "firstApprovedByEmail" TEXT,
    "approvedByEmail" TEXT,
    "rejectedByEmail" TEXT,
    "submittedAt" TIMESTAMP(3),
    "firstApprovedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_plan_year_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_plan_month_statuses" (
    "id" TEXT NOT NULL,
    "planYear" INTEGER NOT NULL,
    "planMonth" INTEGER NOT NULL,
    "countryCode" TEXT NOT NULL,
    "status" "PromotionPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedByEmail" TEXT,
    "firstApprovedByEmail" TEXT,
    "approvedByEmail" TEXT,
    "rejectedByEmail" TEXT,
    "submittedAt" TIMESTAMP(3),
    "firstApprovedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_plan_month_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_plan_archives" (
    "id" TEXT NOT NULL,
    "planYear" INTEGER,
    "planMonth" INTEGER,
    "source" TEXT NOT NULL,
    "sourceReference" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "workbookFileName" TEXT NOT NULL,
    "workbookBytes" BYTEA NOT NULL,
    "driveStatus" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
    "driveFileId" TEXT,
    "driveUrl" TEXT,
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_plan_archives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_plan_email_recipients" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "label" TEXT,
    "countryCode" TEXT NOT NULL DEFAULT 'GLOBAL',
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_plan_email_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_plan_email_notifications" (
    "id" TEXT NOT NULL,
    "archiveId" TEXT,
    "planYear" INTEGER NOT NULL,
    "planMonth" INTEGER NOT NULL,
    "countryCodes" TEXT NOT NULL,
    "toEmails" TEXT NOT NULL,
    "ccEmails" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'SES',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "messageId" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_plan_email_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_notifications" (
    "id" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "requestId" TEXT,
    "planYear" INTEGER,
    "planMonth" INTEGER,
    "countryCodes" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "toEmails" TEXT NOT NULL,
    "ccEmails" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'SES',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "messageId" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "remindAfterAt" TIMESTAMP(3),
    "lastReminderAt" TIMESTAMP(3),
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "other_approval_requests" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "channelName" TEXT NOT NULL,
    "feeType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tableData" TEXT NOT NULL,
    "status" "PromotionPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "workflowState" TEXT NOT NULL DEFAULT 'ACTIVE',
    "duplicateOfRequestId" TEXT,
    "submittedByEmail" TEXT,
    "firstApprovedByEmail" TEXT,
    "approvedByEmail" TEXT,
    "rejectedByEmail" TEXT,
    "submittedAt" TIMESTAMP(3),
    "firstApprovedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdByEmail" TEXT,
    "updatedByEmail" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "other_approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "other_approval_request_audits" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "note" TEXT,
    "changedFields" TEXT,
    "previousValues" TEXT,
    "nextValues" TEXT,
    "actorEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "other_approval_request_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "other_approval_attachments" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "fileBytes" BYTEA NOT NULL,
    "uploadedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "other_approval_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autosave_drafts" (
    "id" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "workspace" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "autosave_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "countries_code_key" ON "countries"("code");

-- CreateIndex
CREATE UNIQUE INDEX "currency_exchange_rates_currency_key" ON "currency_exchange_rates"("currency");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "bom_costs_productId_status_idx" ON "bom_costs"("productId", "status");

-- CreateIndex
CREATE INDEX "logistics_costs_countryId_category_productSize_status_idx" ON "logistics_costs"("countryId", "category", "productSize", "status");

-- CreateIndex
CREATE INDEX "product_country_rrps_productId_countryId_status_idx" ON "product_country_rrps"("productId", "countryId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "product_country_rrps_productId_countryId_effectiveDate_key" ON "product_country_rrps"("productId", "countryId", "effectiveDate");

-- CreateIndex
CREATE INDEX "operational_margins_countryId_retailerName_fdName_category__idx" ON "operational_margins"("countryId", "retailerName", "fdName", "category", "status");

-- CreateIndex
CREATE UNIQUE INDEX "operational_margins_countryId_retailerName_fdName_incoterms_key" ON "operational_margins"("countryId", "retailerName", "fdName", "incoterms", "category", "effectiveDate");

-- CreateIndex
CREATE INDEX "channel_margins_countryId_channelName_kaName_category_statu_idx" ON "channel_margins"("countryId", "channelName", "kaName", "category", "status");

-- CreateIndex
CREATE INDEX "fd_margins_countryId_fdName_channelName_category_status_idx" ON "fd_margins"("countryId", "fdName", "channelName", "category", "status");

-- CreateIndex
CREATE INDEX "scenarios_type_status_idx" ON "scenarios"("type", "status");

-- CreateIndex
CREATE INDEX "scenarios_countryId_productId_idx" ON "scenarios"("countryId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "scenario_inputs_scenarioId_key" ON "scenario_inputs"("scenarioId");

-- CreateIndex
CREATE UNIQUE INDEX "scenario_results_scenarioId_key" ON "scenario_results"("scenarioId");

-- CreateIndex
CREATE INDEX "master_data_archives_createdAt_idx" ON "master_data_archives"("createdAt");

-- CreateIndex
CREATE INDEX "user_country_accesses_email_idx" ON "user_country_accesses"("email");

-- CreateIndex
CREATE INDEX "user_country_accesses_countryCode_status_idx" ON "user_country_accesses"("countryCode", "status");

-- CreateIndex
CREATE INDEX "user_country_accesses_approvalRole_idx" ON "user_country_accesses"("approvalRole");

-- CreateIndex
CREATE UNIQUE INDEX "user_country_accesses_email_countryCode_key" ON "user_country_accesses"("email", "countryCode");

-- CreateIndex
CREATE INDEX "promotion_plan_entries_planYear_planMonth_countryCode_retai_idx" ON "promotion_plan_entries"("planYear", "planMonth", "countryCode", "retailerName", "fdName", "incoterms", "productSku");

-- CreateIndex
CREATE INDEX "promotion_plan_entries_planYear_planMonth_idx" ON "promotion_plan_entries"("planYear", "planMonth");

-- CreateIndex
CREATE INDEX "business_plan_entries_planYear_countryCode_idx" ON "business_plan_entries"("planYear", "countryCode");

-- CreateIndex
CREATE INDEX "business_plan_entries_channelProfileId_idx" ON "business_plan_entries"("channelProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "business_plan_entries_planYear_planMonth_countryCode_retail_key" ON "business_plan_entries"("planYear", "planMonth", "countryCode", "retailerName", "fdName", "incoterms", "productSku");

-- CreateIndex
CREATE INDEX "business_plan_actual_entries_planYear_planMonth_countryCode_idx" ON "business_plan_actual_entries"("planYear", "planMonth", "countryCode");

-- CreateIndex
CREATE INDEX "business_plan_actual_entries_planYear_countryCode_customerN_idx" ON "business_plan_actual_entries"("planYear", "countryCode", "customerName");

-- CreateIndex
CREATE INDEX "business_plan_actual_entries_planYear_countryCode_productMo_idx" ON "business_plan_actual_entries"("planYear", "countryCode", "productModel");

-- CreateIndex
CREATE INDEX "business_plan_actual_entries_planYear_countryCode_poNumber_idx" ON "business_plan_actual_entries"("planYear", "countryCode", "poNumber");

-- CreateIndex
CREATE INDEX "business_plan_channel_profiles_planYear_countryCode_idx" ON "business_plan_channel_profiles"("planYear", "countryCode");

-- CreateIndex
CREATE UNIQUE INDEX "business_plan_channel_profiles_planYear_countryCode_retaile_key" ON "business_plan_channel_profiles"("planYear", "countryCode", "retailerName", "fdName", "incoterms");

-- CreateIndex
CREATE INDEX "business_plan_channel_product_overrides_channelProfileId_idx" ON "business_plan_channel_product_overrides"("channelProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "business_plan_channel_product_overrides_channelProfileId_pr_key" ON "business_plan_channel_product_overrides"("channelProfileId", "productSku");

-- CreateIndex
CREATE INDEX "business_plan_year_statuses_status_idx" ON "business_plan_year_statuses"("status");

-- CreateIndex
CREATE UNIQUE INDEX "business_plan_year_statuses_planYear_countryCode_key" ON "business_plan_year_statuses"("planYear", "countryCode");

-- CreateIndex
CREATE INDEX "promotion_plan_month_statuses_planYear_planMonth_idx" ON "promotion_plan_month_statuses"("planYear", "planMonth");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_plan_month_statuses_planYear_planMonth_countryCod_key" ON "promotion_plan_month_statuses"("planYear", "planMonth", "countryCode");

-- CreateIndex
CREATE INDEX "promotion_plan_archives_createdAt_idx" ON "promotion_plan_archives"("createdAt");

-- CreateIndex
CREATE INDEX "promotion_plan_archives_planYear_planMonth_idx" ON "promotion_plan_archives"("planYear", "planMonth");

-- CreateIndex
CREATE INDEX "promotion_plan_email_recipients_countryCode_status_idx" ON "promotion_plan_email_recipients"("countryCode", "status");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_plan_email_recipients_email_countryCode_key" ON "promotion_plan_email_recipients"("email", "countryCode");

-- CreateIndex
CREATE INDEX "promotion_plan_email_notifications_planYear_planMonth_idx" ON "promotion_plan_email_notifications"("planYear", "planMonth");

-- CreateIndex
CREATE INDEX "promotion_plan_email_notifications_archiveId_idx" ON "promotion_plan_email_notifications"("archiveId");

-- CreateIndex
CREATE INDEX "approval_notifications_requestType_planYear_planMonth_idx" ON "approval_notifications"("requestType", "planYear", "planMonth");

-- CreateIndex
CREATE INDEX "approval_notifications_requestId_idx" ON "approval_notifications"("requestId");

-- CreateIndex
CREATE INDEX "approval_notifications_status_remindAfterAt_idx" ON "approval_notifications"("status", "remindAfterAt");

-- CreateIndex
CREATE INDEX "other_approval_requests_countryCode_status_idx" ON "other_approval_requests"("countryCode", "status");

-- CreateIndex
CREATE INDEX "other_approval_requests_countryCode_workflowState_idx" ON "other_approval_requests"("countryCode", "workflowState");

-- CreateIndex
CREATE INDEX "other_approval_requests_duplicateOfRequestId_idx" ON "other_approval_requests"("duplicateOfRequestId");

-- CreateIndex
CREATE INDEX "other_approval_requests_createdAt_idx" ON "other_approval_requests"("createdAt");

-- CreateIndex
CREATE INDEX "other_approval_request_audits_requestId_createdAt_idx" ON "other_approval_request_audits"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "other_approval_request_audits_requestId_revision_idx" ON "other_approval_request_audits"("requestId", "revision");

-- CreateIndex
CREATE INDEX "other_approval_attachments_requestId_idx" ON "other_approval_attachments"("requestId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "autosave_drafts_userEmail_expiresAt_idx" ON "autosave_drafts"("userEmail", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "autosave_drafts_userEmail_workspace_scope_key" ON "autosave_drafts"("userEmail", "workspace", "scope");

-- AddForeignKey
ALTER TABLE "bom_costs" ADD CONSTRAINT "bom_costs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_costs" ADD CONSTRAINT "logistics_costs_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_country_rrps" ADD CONSTRAINT "product_country_rrps_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_country_rrps" ADD CONSTRAINT "product_country_rrps_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_margins" ADD CONSTRAINT "operational_margins_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_margins" ADD CONSTRAINT "channel_margins_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fd_margins" ADD CONSTRAINT "fd_margins_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_channelMarginId_fkey" FOREIGN KEY ("channelMarginId") REFERENCES "channel_margins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_fdMarginId_fkey" FOREIGN KEY ("fdMarginId") REFERENCES "fd_margins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_inputs" ADD CONSTRAINT "scenario_inputs_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_results" ADD CONSTRAINT "scenario_results_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_plan_channel_product_overrides" ADD CONSTRAINT "business_plan_channel_product_overrides_channelProfileId_fkey" FOREIGN KEY ("channelProfileId") REFERENCES "business_plan_channel_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_approval_request_audits" ADD CONSTRAINT "other_approval_request_audits_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "other_approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_approval_attachments" ADD CONSTRAINT "other_approval_attachments_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "other_approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Migration provenance is kept beside the copied domain, without mixing it
-- into business records or source-system identifiers.
CREATE TABLE "copy_import_batches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sourceSystem" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'NON_SETTLEMENT',
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "manifest" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "sourceCounts" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "targetCounts" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "verification" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "startedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "createdBy" UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "copy_import_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "copy_legacy_id_map" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY,
    "batchId" UUID NOT NULL REFERENCES "copy_import_batches"("id") ON DELETE CASCADE,
    "entityType" TEXT NOT NULL,
    "legacyId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "sourceChecksum" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "copy_legacy_id_map_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "copy_legacy_id_map_batch_entity_legacy_key" UNIQUE ("batchId", "entityType", "legacyId")
);

CREATE INDEX "copy_legacy_id_map_target_idx"
  ON "copy_legacy_id_map"("entityType", "targetId");

-- Platform membership controls login. This optional assignment refines the
-- copied application's business role without creating another user directory.
CREATE TABLE "app_user_roles" (
    "userId" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "assignedBy" UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "app_user_roles_pkey" PRIMARY KEY ("userId")
);

CREATE UNIQUE INDEX "app_user_roles_email_key"
  ON "app_user_roles"(lower("email"));

-- The isolated Next.js BFF is the only writer during parity testing. Browser
-- roles receive no direct table grants. RLS remains enabled as defense in depth
-- before this schema is ever exposed through the Supabase Data API.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'users', 'countries', 'currency_exchange_rates', 'products',
    'bom_costs', 'logistics_costs', 'product_country_rrps',
    'operational_margins', 'channel_margins', 'fd_margins', 'scenarios',
    'scenario_inputs', 'scenario_results', 'master_data_archives',
    'user_country_accesses', 'promotion_plan_entries',
    'business_plan_entries', 'business_plan_actual_entries',
    'business_plan_channel_profiles',
    'business_plan_channel_product_overrides',
    'business_plan_year_statuses', 'promotion_plan_month_statuses',
    'promotion_plan_archives', 'promotion_plan_email_recipients',
    'promotion_plan_email_notifications', 'approval_notifications',
    'other_approval_requests', 'other_approval_request_audits',
    'other_approval_attachments', 'audit_logs', 'autosave_drafts',
    'copy_import_batches', 'copy_legacy_id_map', 'app_user_roles'
  ]
  LOOP
    EXECUTE format(
      'ALTER TABLE commercial_planning.%I ENABLE ROW LEVEL SECURITY',
      table_name
    );
  END LOOP;
END
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA commercial_planning
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA commercial_planning
  FROM PUBLIC, anon, authenticated;

-- The Next.js application can resolve only the signed-in user's effective
-- access. Business tables remain inaccessible through the browser client.
CREATE OR REPLACE FUNCTION public.get_commercial_planning_access()
RETURNS TABLE(
  email text,
  display_name text,
  platform_role text,
  app_role text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, commercial_planning, auth
AS $$
  SELECT
    p.email,
    p.display_name,
    wm.role,
    COALESCE(
      aur."role"::text,
      CASE wm.role
        WHEN 'admin' THEN 'ADMIN'
        WHEN 'editor' THEN 'SALES_MANAGER'
        ELSE 'VIEWER'
      END
    )
  FROM public.workspace_members wm
  JOIN public.workspaces w ON w.id = wm.workspace_id
  JOIN public.profiles p ON p.id = wm.user_id
  LEFT JOIN commercial_planning.app_user_roles aur ON aur."userId" = wm.user_id
  WHERE wm.user_id = auth.uid()
    AND w.slug = 'operations-planning'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_commercial_planning_access()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_commercial_planning_access()
  TO authenticated;

COMMENT ON SCHEMA commercial_planning IS
  'Isolated non-Settlement commercial planning domain. Not browser-exposed during parity testing.';

RESET search_path;
