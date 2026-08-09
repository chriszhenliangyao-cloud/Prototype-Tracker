type HeaderReader = Pick<Headers, "get">;

export function isNavigationPrefetch(headers: HeaderReader) {
  if (
    headers.get("next-router-prefetch") !== null ||
    headers.get("x-middleware-prefetch") !== null
  ) {
    return true;
  }
  return [headers.get("purpose"), headers.get("sec-purpose")].some((value) =>
    value?.toLowerCase().includes("prefetch")
  );
}
