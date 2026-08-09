import { spawnSync } from "node:child_process";

ensureDatabaseUrl();
run(process.execPath, ["scripts/write-postgres-schema.mjs"]);
run(prismaBin(), [
  "db",
  "push",
  "--skip-generate",
  "--schema",
  "prisma/schema.generated.postgres.prisma"
]);

function run(command, args) {
  const result = spawnSync(command, args, {
    env: process.env,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function prismaBin() {
  return process.platform === "win32"
    ? "node_modules/.bin/prisma.cmd"
    : "node_modules/.bin/prisma";
}

function ensureDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return;
  }

  const { RDS_HOSTNAME, RDS_USERNAME, RDS_PASSWORD, RDS_DB_NAME } = process.env;
  if (!RDS_HOSTNAME || !RDS_USERNAME || !RDS_PASSWORD || !RDS_DB_NAME) {
    throw new Error(
      "DATABASE_URL is missing and RDS_HOSTNAME/RDS_USERNAME/RDS_PASSWORD/RDS_DB_NAME are incomplete."
    );
  }

  const url = new URL(`postgresql://${RDS_HOSTNAME}`);
  url.username = RDS_USERNAME;
  url.password = RDS_PASSWORD;
  url.port = process.env.RDS_PORT || "5432";
  url.pathname = `/${RDS_DB_NAME}`;
  url.searchParams.set("schema", process.env.DATABASE_SCHEMA || "public");

  if (process.env.DATABASE_SSL_MODE) {
    url.searchParams.set("sslmode", process.env.DATABASE_SSL_MODE);
  }

  process.env.DATABASE_URL = url.toString();
}
