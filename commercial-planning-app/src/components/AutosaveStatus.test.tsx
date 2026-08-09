import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { AutosaveStatus } from "./AutosaveStatus";

describe("AutosaveStatus", () => {
  test("shows a restored draft as saved without a recovery decision", () => {
    const html = renderToStaticMarkup(
      <AutosaveStatus
        status="saved"
        lastSavedAt="2026-07-21T09:20:00.000Z"
        hasConflict={false}
        onKeepMyChanges={vi.fn()}
        onLoadNewest={vi.fn()}
      />
    );

    expect(html).toContain("Saved");
    expect(html).not.toContain("Restore unfinished draft");
    expect(html).not.toContain("Use current saved version");
    expect(html).not.toContain("Load latest saved draft");
  });

  test("keeps an explicit choice only for a true concurrent-edit conflict", () => {
    const html = renderToStaticMarkup(
      <AutosaveStatus
        status="conflict"
        lastSavedAt={null}
        hasConflict={true}
        onKeepMyChanges={vi.fn()}
        onLoadNewest={vi.fn()}
      />
    );

    expect(html).toContain("Load latest saved draft");
    expect(html).toContain("Keep my changes");
  });
});
