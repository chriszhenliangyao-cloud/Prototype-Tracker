import { describe, expect, it } from "vitest";
import {
  formatRoleLabel,
  getNavigationItems,
  isNavigationItemActive,
  moduleGroups,
  type UserRole
} from "./navigation";

describe("module navigation", () => {
  it("groups the platform into calculation and data modules", () => {
    expect(moduleGroups.map((group) => group.label)).toEqual([
      "Commercial Planning Hub",
      "Master Data"
    ]);
  });

  it("uses BP as the business planning module name", () => {
    expect(getNavigationItems("ADMIN")).toContainEqual(
      expect.objectContaining({
        href: "/business-plan",
        label: "BP",
        actionLabel: "Open BP"
      })
    );
  });

  it("uses distinct on-sale and new-product simulation names", () => {
    expect(getNavigationItems("ADMIN")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: "/commercial/value-chain",
          label: "On-sale Product Simulation"
        }),
        expect.objectContaining({
          href: "/simulation",
          label: "New Product Simulation"
        })
      ])
    );
  });

  it.each<UserRole>(["OWNER", "GTM_LEADER", "ADMIN"])(
    "keeps every module route reachable for %s users",
    (role) => {
      expect(getNavigationItems(role).map((item) => item.href)).toEqual([
        "/commercial/value-chain",
        "/simulation",
        "/business-plan",
        "/promotion",
        "/master-data"
      ]);
    }
  );

  it.each<UserRole>(["GM"])(
    "shows operating modules but hides master data for %s users",
    (role) => {
      expect(getNavigationItems(role).map((item) => item.href)).toEqual([
        "/commercial/value-chain",
        "/simulation",
        "/business-plan",
        "/promotion"
      ]);
    }
  );

  it.each<UserRole>(["SALES_MANAGER", "KA_OWNER"])(
    "keeps country submitter navigation identical for %s users",
    (role) => {
      expect(getNavigationItems(role).map((item) => item.href)).toEqual([
        "/commercial/value-chain",
        "/simulation",
        "/business-plan",
        "/promotion"
      ]);
    }
  );

  it.each<UserRole>(["GM", "FINANCE", "SALES_MANAGER", "KA_OWNER", "VIEWER"])(
    "hides master data setup from %s users",
    (role) => {
      expect(getNavigationItems(role).map((item) => item.href)).not.toContain(
        "/master-data"
      );
    }
  );

  it.each<UserRole>(["FINANCE", "VIEWER"])(
    "keeps read or country-scoped operating modules reachable for %s users",
    (role) => {
      expect(getNavigationItems(role).map((item) => item.href)).toEqual([
        "/commercial/value-chain",
        "/simulation",
        "/business-plan",
        "/promotion"
      ]);
    }
  );

  it("marks only the current module as active", () => {
    expect(
      isNavigationItemActive(
        "/commercial/value-chain",
        "/commercial/value-chain"
      )
    ).toBe(true);
    expect(isNavigationItemActive("/promotion", "/promotion")).toBe(true);
    expect(isNavigationItemActive("/promotion/review", "/promotion")).toBe(true);
    expect(
      isNavigationItemActive("/business-plan", "/commercial/value-chain")
    ).toBe(false);
  });

  it("formats multi-word role names for compact header display", () => {
    expect(formatRoleLabel("KA_OWNER")).toBe("KA OWNER");
  });
});
