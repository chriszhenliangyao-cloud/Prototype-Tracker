import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(process.cwd(), "..");
const cloudSyncSource = readFileSync(
  join(repositoryRoot, "cloud-app/cloud-sync.js"),
  "utf8"
);
const nativeModuleSource = readFileSync(
  join(repositoryRoot, "erp-native-local-test/index.html"),
  "utf8"
);
const proxySource = readFileSync(
  join(process.cwd(), "src/proxy.ts"),
  "utf8"
);
const platformShellSource = readFileSync(
  join(process.cwd(), "src/components/platform/PlatformShell.tsx"),
  "utf8"
);
const moduleRegistrySource = readFileSync(
  join(process.cwd(), "src/lib/platform/modules.ts"),
  "utf8"
);

describe("embedded platform authentication boundary", () => {
  it("uses the protected parent session for every native module", () => {
    expect(nativeModuleSource).toContain("if (window.OPERATIONS_PLATFORM_EMBEDDED)");
    expect(nativeModuleSource).toContain('authSource: "platform-session"');
    expect(nativeModuleSource.indexOf("if (window.OPERATIONS_PLATFORM_EMBEDDED)"))
      .toBeLessThan(nativeModuleSource.indexOf('script.src = "/cloud-sync.js"'));

    for (const moduleKey of [
      "forecast",
      "shipmentSummary",
      "bp",
      "performance",
      "functions",
      "prototypeManagement"
    ]) {
      expect(moduleRegistrySource).toContain(`#module=${moduleKey}`);
    }
  });

  it("shares the Supabase cookie session in legacy embedded modules", () => {
    expect(cloudSyncSource).toContain("@supabase/ssr@0.7.0");
    expect(cloudSyncSource).toContain("createBrowserClient");
    expect(cloudSyncSource).not.toContain(
      'import("https://esm.sh/@supabase/supabase-js@2.57.4")'
    );
  });

  it("never starts Google OAuth inside an embedded frame", () => {
    expect(cloudSyncSource).toContain("operations-platform:reauthenticate");
    expect(cloudSyncSource).toContain("window.parent !== window");
    expect(platformShellSource).toContain("operations-platform:reauthenticate");
    expect(platformShellSource).toContain("switchAccount=1&returnTo=");
  });

  it("protects every static module entry before its scripts execute", () => {
    expect(proxySource).toContain('"/platform/index.html"');
    expect(proxySource).toContain('"/platform-native/index.html"');
    expect(proxySource).toContain('"/platform-native/assets/data.js"');
    expect(proxySource).toContain('"/platform-native/settlement-ledger.html"');
  });

  it("opens permissions with the current browser route as return target", () => {
    expect(platformShellSource).toContain(
      'const returnTo = `${window.location.pathname}${window.location.search}`'
    );
    expect(platformShellSource).toContain(
      "`/platform/system/permissions?returnTo=${encodeURIComponent(returnTo)}`"
    );
  });
});
