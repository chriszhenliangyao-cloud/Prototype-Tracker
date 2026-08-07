-- Dedicated server-side role for the independently deployed commercial-planning app.
-- The password is intentionally provisioned out-of-band and is never committed.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'commercial_planning_app') THEN
    CREATE ROLE commercial_planning_app
      NOLOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      NOREPLICATION;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE postgres TO commercial_planning_app;
GRANT USAGE ON SCHEMA commercial_planning TO commercial_planning_app;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA commercial_planning
  TO commercial_planning_app;
GRANT USAGE, SELECT
  ON ALL SEQUENCES IN SCHEMA commercial_planning
  TO commercial_planning_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA commercial_planning
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO commercial_planning_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA commercial_planning
  GRANT USAGE, SELECT ON SEQUENCES TO commercial_planning_app;

DO $$
DECLARE
  target_table RECORD;
BEGIN
  FOR target_table IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'commercial_planning'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS commercial_planning_server_access ON commercial_planning.%I',
      target_table.tablename
    );
    EXECUTE format(
      'CREATE POLICY commercial_planning_server_access ON commercial_planning.%I TO commercial_planning_app USING (true) WITH CHECK (true)',
      target_table.tablename
    );
  END LOOP;
END
$$;

COMMENT ON ROLE commercial_planning_app IS
  'Server-only role for the independent Operations Planning Hub commercial-planning application.';
