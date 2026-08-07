import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const requiredPaths = [
  "src/app/page.tsx",
  "src/app/normal/page.tsx",
  "src/app/simulation/page.tsx",
  "src/app/business-plan/page.tsx",
  "src/app/promotion/page.tsx",
  "src/app/master-data/page.tsx",
  "src/app/api/scenarios/route.ts",
  "src/app/api/value-chain/export/route.ts",
  "src/app/api/business-plan/save/route.ts",
  "src/app/api/promotion-plan/save/route.ts",
  "src/app/api/other-approvals/save/route.ts"
];
const forbiddenPaths = [
  "src/app/settlement",
  "src/app/api/settlement",
  "src/components/settlement",
  "src/lib/settlement",
  "src/lib/evidence"
];
const forbiddenSchemaTerms = [
  "model SettlementCase",
  "model GmailEvidenceInbox",
  "model EvidenceArchiveArtifact",
  "model CnReverseExclusion",
  "model SettlementReviewConfirmation"
];

const failures = [];
for (const path of requiredPaths) {
  if (!(await exists(join(root, path)))) failures.push(`Missing required path: ${path}`);
}
for (const path of forbiddenPaths) {
  if (await exists(join(root, path))) failures.push(`Excluded path exists: ${path}`);
}

const schema = await readFile(join(root, "prisma/schema.prisma"), "utf8");
for (const term of forbiddenSchemaTerms) {
  if (schema.includes(term)) failures.push(`Excluded schema model exists: ${term}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify(
      {
        status: "passed",
        requiredPaths: requiredPaths.length,
        excludedPathsChecked: forbiddenPaths.length,
        excludedSchemaModelsChecked: forbiddenSchemaTerms.length,
        settlementModuleCopied: false
      },
      null,
      2
    )
  );
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}
