import { normalizeAuthReturnTo } from "./returnTo";

const authFlowCookiePrefix = "vc_auth_flow_";

type AuthFlow = {
  state: string;
  verifier: string;
  returnTo: string;
};

export function authFlowCookieName(state: string) {
  return `${authFlowCookiePrefix}${state}`;
}

export function createAuthFlowCookie(flow: AuthFlow) {
  return Buffer.from(
    JSON.stringify({
      ...flow,
      returnTo: normalizeAuthReturnTo(flow.returnTo)
    }),
    "utf8"
  ).toString("base64url");
}

export function readAuthFlowCookie(
  cookieValue: string | undefined,
  expectedState: string
): AuthFlow | null {
  if (!cookieValue || !expectedState) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(cookieValue, "base64url").toString("utf8")
    ) as Partial<AuthFlow>;

    if (
      parsed.state !== expectedState ||
      typeof parsed.verifier !== "string" ||
      !parsed.verifier
    ) {
      return null;
    }

    return {
      state: expectedState,
      verifier: parsed.verifier,
      returnTo: normalizeAuthReturnTo(parsed.returnTo)
    };
  } catch {
    return null;
  }
}
