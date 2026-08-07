import { createHmac, timingSafeEqual } from "node:crypto";
import type { AppSession } from "./types";

export const sessionCookieName = "vc_session";

export function createSessionCookie(session: AppSession, secret: string) {
  const payload = base64UrlEncode(JSON.stringify(session));
  const signature = sign(payload, secret);
  return `${payload}.${signature}`;
}

export function verifySessionCookie(
  cookieValue: string | undefined,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): AppSession | null {
  if (!cookieValue) {
    return null;
  }

  const [payload, signature] = cookieValue.split(".");
  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = sign(payload, secret);
  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }

  const session = parseSession(payload);
  if (!session || session.expiresAt <= nowSeconds) {
    return null;
  }

  return session;
}

function parseSession(payload: string): AppSession | null {
  try {
    const parsed = JSON.parse(base64UrlDecode(payload)) as AppSession;
    if (!parsed.email || !parsed.role || !parsed.expiresAt) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}
