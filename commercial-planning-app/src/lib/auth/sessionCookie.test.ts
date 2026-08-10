import { describe, expect, it } from "vitest";
import { createSessionCookie, verifySessionCookie } from "./sessionCookie";

const session = {
  email: "finance@example.com",
  name: "Finance User",
  role: "FINANCE" as const,
  groups: ["FINANCE"],
  expiresAt: 1800000000,
  governanceRole: "platform_owner" as const
};

describe("session cookies", () => {
  it("round-trips a signed session payload", () => {
    const cookie = createSessionCookie(session, "0123456789abcdef");

    expect(verifySessionCookie(cookie, "0123456789abcdef", 1700000000)).toEqual(
      session
    );
  });

  it("rejects tampered session payloads", () => {
    const cookie = createSessionCookie(session, "0123456789abcdef");
    const [payload, signature] = cookie.split(".");
    const tamperedPayload =
      payload.slice(0, -1) + (payload.endsWith("A") ? "B" : "A");
    const tampered = `${tamperedPayload}.${signature}`;

    expect(
      verifySessionCookie(tampered, "0123456789abcdef", 1700000000)
    ).toBeNull();
  });

  it("rejects expired sessions", () => {
    const cookie = createSessionCookie(session, "0123456789abcdef");

    expect(
      verifySessionCookie(cookie, "0123456789abcdef", 1900000000)
    ).toBeNull();
  });
});
