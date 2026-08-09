export const authRetryParam = "authRetry";

export function isRecoverableSupabaseExchangeError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code || "") : "";
  return ["bad_code_verifier", "flow_state_not_found"].includes(code);
}

export function hasRetriedAuthFlow(searchParams: URLSearchParams) {
  return searchParams.get(authRetryParam) === "1";
}
