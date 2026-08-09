import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const platformSource = readFileSync(
  new URL("../../public/platform/index.html", import.meta.url),
  "utf8"
);

describe("Project Tracking EOL lifecycle", () => {
  it("defines EOL as a historical, read-only project status", () => {
    expect(platformSource).toContain('eol: { label: "已退市（EOL）", tone: "grey", scope: "history" }');
    expect(platformSource).toContain('["archived", "eol", "cancelled"].includes(projectLifecycleStatus(project))');
    expect(platformSource).toContain('if (scope === "history") return ["archived", "eol", "cancelled"].includes(status)');
  });

  it("supports moving active projects to EOL and restoring them later", () => {
    expect(platformSource).toContain('active: ["paused", "closeout", "eol", "cancelled"]');
    expect(platformSource).toContain('eol: ["active"]');
    expect(platformSource).toContain('["lifecycle_end", "产品生命周期结束"]');
    expect(platformSource).toContain('project.nextMilestone = "End of Life"');
  });

  it("removes EOL projects from current Marketing Assets views", () => {
    expect(platformSource).toContain('!["archived", "eol", "cancelled"].includes(project.lifecycleStatus)');
  });

  it("renders the requested bilingual labels", () => {
    expect(platformSource).toContain('eol: "EOL"');
    expect(platformSource).toContain('EOL生效日期');
    expect(platformSource).toContain('已退市（EOL）');
  });
});
