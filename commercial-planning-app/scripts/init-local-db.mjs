import { existsSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, isAbsolute, resolve } from "node:path";
import { tmpdir } from "node:os";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
const databasePath = resolveDatabasePath(databaseUrl);
const bootstrapPath = `${databasePath}.bootstrap.sql`;

const localDatabasePath = resolve(projectRoot, "prisma/dev.db");
const tempRoot = resolve(tmpdir());
if (
  databasePath !== localDatabasePath &&
  !databasePath.startsWith(`${tempRoot}/`)
) {
  throw new Error(`Refusing to reset unexpected database path: ${databasePath}`);
}

if (existsSync(databasePath)) {
  unlinkSync(databasePath);
}

run("npx", [
  "prisma",
  "migrate",
  "diff",
  "--from-empty",
  "--to-schema-datamodel",
  "prisma/schema.prisma",
  "--script",
  "--output",
  bootstrapPath
]);

run("sqlite3", [databasePath, `.read '${bootstrapPath.replaceAll("'", "''")}'`]);
unlinkSync(bootstrapPath);

function resolveDatabasePath(url) {
  if (!url.startsWith("file:")) {
    throw new Error("Local bootstrap requires a SQLite file DATABASE_URL.");
  }

  const filePath = url.slice("file:".length);
  if (isAbsolute(filePath)) {
    return resolve(filePath);
  }

  return resolve(projectRoot, "prisma", filePath);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      XDG_CACHE_HOME:
        process.env.XDG_CACHE_HOME || "/tmp/prototype-prisma-cache"
    },
    stdio: "inherit"
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
}
