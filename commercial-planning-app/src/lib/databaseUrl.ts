type Env = Record<string, string | undefined>;

export function resolveDatabaseUrl(env: Env = process.env): string | undefined {
  if (env.DATABASE_URL) {
    return env.DATABASE_URL;
  }

  const host = env.RDS_HOSTNAME;
  const username = env.RDS_USERNAME;
  const password = env.RDS_PASSWORD;
  const databaseName = env.RDS_DB_NAME;

  if (!host || !username || !password || !databaseName) {
    return undefined;
  }

  const url = new URL(`postgresql://${host}`);
  url.username = username;
  url.password = password;
  url.port = env.RDS_PORT || "5432";
  url.pathname = `/${databaseName}`;
  url.searchParams.set("schema", env.DATABASE_SCHEMA || "public");

  if (env.DATABASE_SSL_MODE) {
    url.searchParams.set("sslmode", env.DATABASE_SSL_MODE);
  }

  return url.toString();
}

export function ensureDatabaseUrlFromAwsRdsEnv(env: Env = process.env) {
  const databaseUrl = resolveDatabaseUrl(env);
  if (!databaseUrl) return;

  env.DATABASE_URL = shouldApplyServerlessPoolOptions(env)
    ? withServerlessPoolOptions(databaseUrl, env)
    : databaseUrl;
}

export function withServerlessPoolOptions(databaseUrl: string, env: Env = process.env) {
  try {
    const url = new URL(databaseUrl);
    if (!url.protocol.startsWith("postgres")) return databaseUrl;

    setIfMissing(url, "connection_limit", boundedInteger(env.PRISMA_CONNECTION_LIMIT, 1, 10, 1));
    setIfMissing(url, "pool_timeout", boundedInteger(env.PRISMA_POOL_TIMEOUT_SECONDS, 5, 120, 60));
    setIfMissing(url, "connect_timeout", boundedInteger(env.PRISMA_CONNECT_TIMEOUT_SECONDS, 3, 60, 15));
    return url.toString();
  } catch {
    return databaseUrl;
  }
}

function shouldApplyServerlessPoolOptions(env: Env) {
  return env.VERCEL === "1" || env.PRISMA_SERVERLESS_POOLING === "1";
}

function setIfMissing(url: URL, key: string, value: number) {
  if (!url.searchParams.has(key)) url.searchParams.set(key, String(value));
}

function boundedInteger(value: string | undefined, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}
