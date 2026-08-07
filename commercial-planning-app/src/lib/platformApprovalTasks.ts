import { canViewAllCountries } from "@/lib/auth/roles";
import type { AppSession } from "@/lib/auth/types";
import {
  getPromotionPlanApprovalQueue,
  getRecentPromotionPlanEmailNotifications,
  getReferenceData,
  getUserCountryAccesses
} from "@/lib/data";
import { getOtherApprovalRequests } from "@/lib/otherApprovals";
import { canViewOtherApprovalInInbox } from "@/lib/otherApprovalWorkflow";
import { prisma } from "@/lib/prisma";
import {
  getAccessibleCountryCodes,
  getEffectivePromotionPlanRole
} from "@/lib/promotionPlanAccess";
import { getPromotionPlanApproverCapabilities } from "@/lib/promotionPlanApprovalWorkflow";
import type {
  OtherApprovalRequestOption,
  PromotionPlanApprovalQueueItem
} from "@/lib/types";

export type PlatformApprovalEmailState =
  | "SENT"
  | "PENDING"
  | "FAILED"
  | "NOT_CONFIGURED"
  | "MISSING";

export type PlatformApprovalTask = {
  id: string;
  kind: "monthly-promotion" | "other-approval";
  title: string;
  context: string;
  sourceModule: "月度促销审批" | "其他审批";
  responsibility: string;
  stage: "first" | "final";
  actionable: boolean;
  statusLabel: string;
  statusTone: "amber" | "blue" | "red";
  submittedByEmail: string | null;
  submittedAt: string | null;
  updatedAt: string;
  waitingHours: number;
  email: {
    state: PlatformApprovalEmailState;
    label: string;
    tone: "green" | "blue" | "red" | "amber" | "grey";
    detail: string;
    attemptCount: number;
    updatedAt: string | null;
  };
  targetRoute: string;
};

export type PlatformApprovalTaskInbox = {
  generatedAt: string;
  summary: {
    visibleApprovals: number;
    actionableApprovals: number;
    waitingForPreviousStage: number;
    monthlyPending: number;
    otherPending: number;
    emailSent: number;
    emailPending: number;
    emailIssues: number;
    deliveryRecent: number;
    deliverySent: number;
    deliveryPending: number;
    deliveryIssues: number;
  };
  tasks: PlatformApprovalTask[];
};

export type ApprovalNotificationSnapshot = {
  id: string;
  requestType: string;
  requestId: string | null;
  planYear: number | null;
  planMonth: number | null;
  countryCodes: string;
  stage: string;
  status: string;
  toEmails: string;
  ccEmails: string;
  attemptCount: number;
  errorMessage: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export async function getPlatformApprovalTaskInbox(
  session: AppSession
): Promise<PlatformApprovalTaskInbox> {
  const [referenceData, accessRows] = await Promise.all([
    getReferenceData(),
    getUserCountryAccesses()
  ]);
  const role = getEffectivePromotionPlanRole(
    session.role,
    session.email,
    accessRows
  );
  const capabilities = getPromotionPlanApproverCapabilities({
    role,
    email: session.email,
    accessRows
  });
  const accessibleCountryCodes = getAccessibleCountryCodes(
    role,
    session.email,
    accessRows,
    referenceData.countries
  );
  const visibleCountryCodes = canViewAllCountries(role)
    ? referenceData.countries.map((country) => country.code)
    : accessibleCountryCodes;

  const [monthlyItems, allOtherItems, notifications, deliveryNotifications] = await Promise.all([
    getPromotionPlanApprovalQueue({
      countryCodes: visibleCountryCodes,
      canFirstApprove: capabilities.canFirstApprove,
      canFinalApprove: capabilities.canFinalApprove,
      limit: 100
    }),
    getOtherApprovalRequests({
      countryCodes: visibleCountryCodes,
      limit: 160
    }),
    prisma.approvalNotification.findMany({
      where: {
        requestType: { in: ["PROMOTION_PLAN", "OTHER_APPROVAL"] }
      },
      orderBy: [{ createdAt: "desc" }],
      take: 400,
      select: {
        id: true,
        requestType: true,
        requestId: true,
        planYear: true,
        planMonth: true,
        countryCodes: true,
        stage: true,
        status: true,
        toEmails: true,
        ccEmails: true,
        attemptCount: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true
      }
    }),
    getRecentPromotionPlanEmailNotifications(50)
  ]);

  const otherItems = allOtherItems.filter((request) =>
    canViewOtherApprovalInInbox({
      status: request.status,
      workflowState: request.workflowState,
      capabilities
    })
  );
  const visibleCountrySet = new Set(
    visibleCountryCodes.map((countryCode) => countryCode.toUpperCase())
  );
  const visibleDeliveryNotifications = deliveryNotifications.filter((notification) =>
    notification.countryCodes.some((countryCode) =>
      visibleCountrySet.has(countryCode.toUpperCase())
    )
  );

  return buildPlatformApprovalTaskInbox({
    monthlyItems,
    otherItems,
    notifications,
    capabilities,
    deliveryStatuses: visibleDeliveryNotifications.map((notification) => notification.status)
  });
}

export function buildPlatformApprovalTaskInbox({
  monthlyItems,
  otherItems,
  notifications,
  capabilities = { canFirstApprove: true, canFinalApprove: true },
  deliveryStatuses = [],
  now = new Date()
}: {
  monthlyItems: PromotionPlanApprovalQueueItem[];
  otherItems: OtherApprovalRequestOption[];
  notifications: ApprovalNotificationSnapshot[];
  capabilities?: { canFirstApprove: boolean; canFinalApprove: boolean };
  deliveryStatuses?: string[];
  now?: Date;
}): PlatformApprovalTaskInbox {
  const monthlyTasks = monthlyItems.map((item) =>
    monthlyTask(item, notifications, now)
  );
  const otherTasks = otherItems.map((item) =>
    otherTask(item, notifications, capabilities, now)
  );
  const tasks = [...monthlyTasks, ...otherTasks].sort(compareTasks);
  const emailSent = tasks.filter((task) => task.email.state === "SENT").length;
  const emailPending = tasks.filter((task) => task.email.state === "PENDING").length;
  const emailIssues = tasks.filter((task) =>
    ["FAILED", "NOT_CONFIGURED"].includes(task.email.state)
  ).length;

  return {
    generatedAt: now.toISOString(),
    summary: {
      visibleApprovals: tasks.length,
      actionableApprovals: tasks.filter((task) => task.actionable).length,
      waitingForPreviousStage: tasks.filter((task) => !task.actionable).length,
      monthlyPending: monthlyTasks.length,
      otherPending: otherTasks.length,
      emailSent,
      emailPending,
      emailIssues,
      deliveryRecent: deliveryStatuses.length,
      deliverySent: deliveryStatuses.filter((status) => status === "SENT").length,
      deliveryPending: deliveryStatuses.filter((status) => status === "PENDING").length,
      deliveryIssues: deliveryStatuses.filter((status) =>
        status === "FAILED" || status === "NOT_CONFIGURED"
      ).length
    },
    tasks
  };
}

function monthlyTask(
  item: PromotionPlanApprovalQueueItem,
  notifications: ApprovalNotificationSnapshot[],
  now: Date
): PlatformApprovalTask {
  const stage = item.stage;
  const notification = notifications.find(
    (candidate) =>
      candidate.requestType === "PROMOTION_PLAN" &&
      candidate.planYear === item.planYear &&
      candidate.planMonth === item.planMonth &&
      notificationCountries(candidate.countryCodes).includes(
        item.countryCode.toUpperCase()
      ) &&
      candidate.stage === notificationStage(stage)
  );
  const params = new URLSearchParams({
    year: String(item.planYear),
    month: String(item.planMonth),
    country: item.countryCode
  });

  return {
    id: `monthly:${item.id}`,
    kind: "monthly-promotion",
    title: `${item.planYear}年${item.planMonth}月 ${item.countryCode} 月度促销计划`,
    context: `${item.entryCount}条计划 · ${item.countryCode}`,
    sourceModule: "月度促销审批",
    responsibility: stage === "first" ? "一级审批" : "最终审批",
    stage,
    actionable: item.canApprove,
    statusLabel: approvalStatusLabel(stage, item.canApprove),
    statusTone: item.canApprove ? (stage === "final" ? "red" : "amber") : "blue",
    submittedByEmail: item.submittedByEmail,
    submittedAt: item.submittedAt,
    updatedAt: item.updatedAt,
    waitingHours: elapsedHours(item.submittedAt ?? item.updatedAt, now),
    email: emailState(notification),
    targetRoute: `/platform/collaboration/monthly-approvals?${params.toString()}`
  };
}

function otherTask(
  item: OtherApprovalRequestOption,
  notifications: ApprovalNotificationSnapshot[],
  capabilities: { canFirstApprove: boolean; canFinalApprove: boolean },
  now: Date
): PlatformApprovalTask {
  const stage = item.status === "FIRST_APPROVED" ? "final" : "first";
  const actionable = stage === "first"
    ? capabilities.canFirstApprove
    : capabilities.canFinalApprove;
  const notification = notifications.find(
    (candidate) =>
      candidate.requestType === "OTHER_APPROVAL" &&
      candidate.requestId === item.id &&
      candidate.stage === notificationStage(stage)
  );
  const params = new URLSearchParams({
    workspace: "other-approvals",
    requestId: item.id
  });

  return {
    id: `other:${item.id}`,
    kind: "other-approval",
    title: item.title,
    context: `${item.countryCode} · ${item.channelName} · ${item.feeType}`,
    sourceModule: "其他审批",
    responsibility: stage === "first" ? "一级审批" : "最终审批",
    stage,
    actionable,
    statusLabel: approvalStatusLabel(stage, actionable),
    statusTone: actionable ? (stage === "final" ? "red" : "amber") : "blue",
    submittedByEmail: item.submittedByEmail,
    submittedAt: item.submittedAt,
    updatedAt: item.updatedAt,
    waitingHours: elapsedHours(item.submittedAt ?? item.updatedAt, now),
    email: emailState(notification),
    targetRoute: `/platform/collaboration/other-approvals?${params.toString()}`
  };
}

function emailState(
  notification: ApprovalNotificationSnapshot | undefined
): PlatformApprovalTask["email"] {
  if (!notification) {
    return {
      state: "MISSING",
      label: "无邮件记录",
      tone: "grey",
      detail: "该审批阶段尚未生成邮件发送记录。",
      attemptCount: 0,
      updatedAt: null
    };
  }

  const state = normalizeEmailState(notification.status);
  const recipients = notification.toEmails
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
  const detailParts = [
    recipients.length > 0 ? `收件人 ${recipients.join("、")}` : "未配置收件人",
    notification.errorMessage ?? ""
  ].filter(Boolean);
  const display = {
    SENT: ["已发送", "green"],
    PENDING: ["发送中", "blue"],
    FAILED: ["发送失败", "red"],
    NOT_CONFIGURED: ["未配置", "amber"]
  }[state] as [string, "green" | "blue" | "red" | "amber"];

  return {
    state,
    label: display[0],
    tone: display[1],
    detail: detailParts.join("；"),
    attemptCount: notification.attemptCount,
    updatedAt: toIsoString(notification.updatedAt)
  };
}

function normalizeEmailState(status: string): Exclude<PlatformApprovalEmailState, "MISSING"> {
  if (status === "SENT" || status === "PENDING" || status === "NOT_CONFIGURED") {
    return status;
  }
  return "FAILED";
}

function approvalStatusLabel(stage: "first" | "final", actionable: boolean) {
  if (!actionable) return "等待一级审批";
  return stage === "first" ? "待我一级审批" : "待我最终审批";
}

function notificationStage(stage: "first" | "final") {
  return stage === "first" ? "FIRST_APPROVAL" : "FINAL_APPROVAL";
}

function notificationCountries(value: string) {
  return value
    .split(",")
    .map((countryCode) => countryCode.trim().toUpperCase())
    .filter(Boolean);
}

function elapsedHours(value: string, now: Date) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, Math.floor((now.getTime() - timestamp) / 3_600_000));
}

function compareTasks(left: PlatformApprovalTask, right: PlatformApprovalTask) {
  if (left.actionable !== right.actionable) return left.actionable ? -1 : 1;
  if (left.stage !== right.stage) return left.stage === "final" ? -1 : 1;
  return right.waitingHours - left.waitingHours;
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
