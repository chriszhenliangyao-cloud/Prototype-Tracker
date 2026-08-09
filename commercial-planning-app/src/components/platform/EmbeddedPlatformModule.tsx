import type { PlatformModuleDefinition } from "@/lib/platform/modules";

export function EmbeddedPlatformModule({
  module,
  searchParams = {}
}: {
  module: PlatformModuleDefinition;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  if (!module.embeddedSrc) return null;

  return (
    <iframe
      className="native-platform-module-frame"
      src={appendSearchParams(module.embeddedSrc, searchParams)}
      title={module.zh}
      loading="eager"
      referrerPolicy="same-origin"
    />
  );
}

function appendSearchParams(
  source: string,
  searchParams: Record<string, string | string[] | undefined>
) {
  const [pathAndQuery, hash = ""] = source.split("#", 2);
  const url = new URL(pathAndQuery, "https://platform.local");
  const hashParams = new URLSearchParams(hash);
  for (const [key, rawValue] of Object.entries(searchParams)) {
    if (key === "embedded") continue;
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const value of values) {
      if (value === undefined) continue;
      if (key === "view" && hashParams.has("module")) {
        hashParams.append(key, value);
      } else {
        url.searchParams.append(key, value);
      }
    }
  }
  const nextHash = hashParams.toString();
  return `${url.pathname}${url.search}${nextHash ? `#${nextHash}` : ""}`;
}
