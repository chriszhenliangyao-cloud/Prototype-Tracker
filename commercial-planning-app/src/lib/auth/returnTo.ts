export function normalizeAuthReturnTo(value: string | null | undefined) {
  const target = value?.trim();

  if (!target || !target.startsWith("/") || target.startsWith("//")) {
    return "/";
  }

  if (target.startsWith("/auth/")) {
    return "/";
  }

  return target;
}
