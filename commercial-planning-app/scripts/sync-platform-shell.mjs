import { access, copyFile, cp, mkdir, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(appRoot, "..", "cloud-app");
const roadmapSourceRoot = resolve(appRoot, "..", "roadmap-local-test");
const publicRoot = resolve(appRoot, "public");
const files = [
  ["index.html", "platform/index.html"],
  ["cloud-sync.js", "cloud-sync.js"],
  ["i18n.js", "i18n.js"]
];

await mkdir(resolve(publicRoot, "platform"), { recursive: true });

for (const [sourceName, destinationName] of files) {
  const source = resolve(sourceRoot, sourceName);
  const destination = resolve(publicRoot, destinationName);
  if (await exists(source)) {
    await copyFile(source, destination);
    continue;
  }
  if (!(await exists(destination))) {
    throw new Error(`Missing platform shell asset: ${destinationName}`);
  }
}

const roadmapDestination = resolve(publicRoot, "roadmap");
if (await exists(roadmapSourceRoot)) {
  await rm(roadmapDestination, { recursive: true, force: true });
  await cp(roadmapSourceRoot, roadmapDestination, {
    recursive: true,
    filter: (source) => !source.endsWith("SOURCE_MANIFEST.md")
  });
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
