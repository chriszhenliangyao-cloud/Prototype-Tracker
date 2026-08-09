import { PrismaClient } from "@prisma/client";
import { ensureDatabaseUrlFromAwsRdsEnv } from "./databaseUrl";

ensureDatabaseUrlFromAwsRdsEnv();

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

// Next.js can load the data module through multiple route bundles in one warm
// serverless process. Keep one pool per process in production as well as dev.
globalForPrisma.prisma = prisma;
