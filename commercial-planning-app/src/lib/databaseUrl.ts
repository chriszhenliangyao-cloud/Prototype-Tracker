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
  if (!env.DATABASE_URL) {
    const databaseUrl = resolveDatabaseUrl(env);
    if (databaseUrl) {
      env.DATABASE_URL = databaseUrl;
    }
  }
}
