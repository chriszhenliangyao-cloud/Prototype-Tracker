import { access, copyFile, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(appRoot, "..", "cloud-app");
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

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
