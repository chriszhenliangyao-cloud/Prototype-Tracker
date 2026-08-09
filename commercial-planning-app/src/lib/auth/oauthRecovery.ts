export const authRetryParam = "authRetry";

export function isRecoverableSupabaseExchangeError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code || "") : "";
  const status = "status" in error ? Number(error.status) : 0;
  return status === 400 || [
    "bad_code_verifier",
    "flow_state_not_found",
    "validation_failed"
  ].includes(code);
}

export function hasRetriedAuthFlow(searchParams: URLSearchParams) {
  return searchParams.get(authRetryParam) === "1";
}
