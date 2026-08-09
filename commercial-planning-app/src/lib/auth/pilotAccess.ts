export function getPilotAccessCookieMaxAge(
  expiresAt: number,
  nowSeconds = Math.floor(Date.now() / 1000)
) {
  return Math.max(1, Math.min(600, expiresAt - nowSeconds));
}
