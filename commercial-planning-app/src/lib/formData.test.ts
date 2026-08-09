import { describe, expect, test } from "vitest";
import { optionalText } from "./formData";

describe("optionalText", () => {
  test("returns null for missing or blank form values", () => {
    const formData = new FormData();
    formData.set("blank", "   ");

    expect(optionalText(formData, "missing")).toBeNull();
    expect(optionalText(formData, "blank")).toBeNull();
  });

  test("returns trimmed text for non-blank form values", () => {
    const formData = new FormData();
    formData.set("capacity", " Compact ");

    expect(optionalText(formData, "capacity")).toBe("Compact");
  });
});
