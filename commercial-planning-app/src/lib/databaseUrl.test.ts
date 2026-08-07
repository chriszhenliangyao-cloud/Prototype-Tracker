import { describe, expect, it } from "vitest";
import { ensureDatabaseUrlFromAwsRdsEnv, resolveDatabaseUrl } from "./databaseUrl";

describe("resolveDatabaseUrl", () => {
  it("keeps an explicit DATABASE_URL", () => {
    expect(
      resolveDatabaseUrl({
        DATABASE_URL: "postgresql://direct:secret@example.com:5432/app"
      })
    ).toBe("postgresql://direct:secret@example.com:5432/app");
  });

  it("builds a PostgreSQL URL from Elastic Beanstalk RDS variables", () => {
    expect(
      resolveDatabaseUrl({
        RDS_HOSTNAME: "value-chain-db.example.eu-west-3.rds.amazonaws.com",
        RDS_PORT: "5432",
        RDS_USERNAME: "finance.user",
        RDS_PASSWORD: "p@ss/word",
        RDS_DB_NAME: "ebdb",
        DATABASE_SSL_MODE: "require"
      })
    ).toBe(
      "postgresql://finance.user:p%40ss%2Fword@value-chain-db.example.eu-west-3.rds.amazonaws.com:5432/ebdb?schema=public&sslmode=require"
    );
  });

  it("sets DATABASE_URL on a mutable environment object", () => {
    const env: Record<string, string | undefined> = {
      RDS_HOSTNAME: "db.internal",
      RDS_USERNAME: "user",
      RDS_PASSWORD: "secret",
      RDS_DB_NAME: "value_chain"
    };

    ensureDatabaseUrlFromAwsRdsEnv(env);

    expect(env.DATABASE_URL).toBe(
      "postgresql://user:secret@db.internal:5432/value_chain?schema=public"
    );
  });
});
