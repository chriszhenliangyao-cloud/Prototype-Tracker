import { describe, expect, test } from "vitest";
import {
  AUTOSAVE_RETENTION_DAYS,
  expiresAtFrom,
  isAutosaveSnapshot,
  normalizeAutosaveScope,
  parseAutosaveSnapshot,
  serializeAutosaveSnapshot
} from "./autosaveDrafts";
import { pickNewestAutosaveDraft } from "@/components/useAutosaveDraft";

describe("autosave drafts", () => {
  test("accepts a business scope and rejects unsafe scope values", () => {
    expect(normalizeAutosaveScope("2026:09:ES,FR")).toBe("2026:09:ES,FR");
    expect(normalizeAutosaveScope("case-123_ABC")).toBe("case-123_ABC");
    expect(normalizeAutosaveScope("../other-user")).toBeNull();
    expect(normalizeAutosaveScope(" ")).toBeNull();
  });

  test("keeps a round-trippable JSON snapshot", () => {
    const snapshot = {
      inputsByRow: { "ES:BG:P75-P1": { rrppLocal: "39.99" } },
      filters: { countryCodes: ["ES"] }
    };

    const payload = serializeAutosaveSnapshot(snapshot);
    expect(parseAutosaveSnapshot(payload)).toEqual(snapshot);
    expect(isAutosaveSnapshot(snapshot)).toBe(true);
    expect(parseAutosaveSnapshot("not-json")).toBeNull();
  });

  test("sets expiration exactly thirty days after the last protected input", () => {
    const now = new Date("2026-07-21T00:00:00.000Z");
    const expiresAt = expiresAtFrom(now);

    expect(expiresAt.getTime() - now.getTime()).toBe(
      AUTOSAVE_RETENTION_DAYS * 24 * 60 * 60 * 1000
    );
  });

  test("chooses the newest local or server draft for automatic restore", () => {
    const local = {
      workspace: "VALUE_CHAIN" as const,
      scope: "all",
      snapshot: { inputs: { "ES:BG:P75-P1": "39.99" } },
      revision: 3,
      updatedAt: "2026-07-21T09:15:00.000Z",
      expiresAt: "2026-08-20T09:15:00.000Z"
    };
    const remote = {
      ...local,
      snapshot: { inputs: { "ES:BG:P75-P1": "44.99" } },
      revision: 4,
      updatedAt: "2026-07-21T09:20:00.000Z"
    };

    expect(pickNewestAutosaveDraft(local, remote)).toEqual(remote);
    expect(pickNewestAutosaveDraft(remote, local)).toEqual(remote);
  });
});
