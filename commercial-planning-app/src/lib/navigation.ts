import { canEditMasterData } from "./auth/roles";
import type { UserRole } from "./types";

export type { UserRole };

export type ModuleItem = {
  href: string;
  label: string;
  summary: string;
  actionLabel: string;
  requiresMasterDataAccess?: boolean;
};

export type ModuleGroup = {
  label: string;
  description: string;
  items: ModuleItem[];
};

export const moduleGroups: ModuleGroup[] = [
  {
    label: "Commercial Planning Hub",
    description:
      "Plan BP targets, simulate value-chain results, and approve promotions from shared master data.",
    items: [
      {
        href: "/commercial/value-chain",
        label: "On-sale Product Simulation",
        summary:
          "Review launched product-country rows and simulate RRPP floor NP.",
        actionLabel: "Open on-sale product simulation"
      },
      {
        href: "/simulation",
        label: "New Product Simulation",
        summary:
          "Enter RRPP for product-country rows that do not yet have active RRP.",
        actionLabel: "Open simulation"
      },
      {
        href: "/business-plan",
        label: "BP",
        summary:
          "Plan monthly SI/SO targets by country, channel, and product using the shared value-chain data.",
        actionLabel: "Open BP"
      },
      {
        href: "/promotion",
        label: "Approval Center",
        summary:
          "Submit monthly promotion plans and other approval requests through one workflow.",
        actionLabel: "Open approvals"
      }
    ]
  },
  {
    label: "Master Data",
    description:
      "Maintain the data tables used by every calculator and scenario.",
    items: [
      {
        href: "/master-data",
        label: "Master Data",
        summary:
          "Manage products, countries, RRP, BOM, logistics, and margin records.",
        actionLabel: "Maintain data",
        requiresMasterDataAccess: true
      }
    ]
  }
];

export function getVisibleModuleGroups(role: UserRole): ModuleGroup[] {
  return moduleGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          !item.requiresMasterDataAccess || canEditMasterData(role)
      )
    }))
    .filter((group) => group.items.length > 0);
}

export function getNavigationItems(role: UserRole): ModuleItem[] {
  return getVisibleModuleGroups(role).flatMap((group) => group.items);
}

export function isNavigationItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function formatRoleLabel(role: UserRole) {
  return role.replaceAll("_", " ");
}
