export function readPlatformSessionToken(value: unknown, minimumLength: number) {
  if (typeof value !== "string") return "";
  const token = value.trim();
  return token.length >= minimumLength && token.length < 10000 ? token : "";
}
