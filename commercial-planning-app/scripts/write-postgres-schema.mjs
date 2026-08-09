import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const sourcePath = resolve("prisma/schema.prisma");
const targetPath = resolve("prisma/schema.generated.postgres.prisma");

const source = readFileSync(sourcePath, "utf8");
const sqliteProvider = 'provider = "sqlite"';

if (!source.includes(sqliteProvider)) {
  throw new Error(`Expected ${sqliteProvider} in ${sourcePath}`);
}

const postgresSchema = source.replace(sqliteProvider, 'provider = "postgresql"');

writeFileSync(targetPath, postgresSchema);
console.log(`Wrote ${targetPath}`);
