-- Read-only role for the DataPilot live connector.
-- The app probes the supplied role and refuses it if it can write, so the
-- application MUST connect as this SELECT-only role (never as `postgres`).
-- Run against the `company` database AFTER schema + data load.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'analyst') THEN
        CREATE ROLE analyst LOGIN PASSWORD '1234';
    END IF;
END $$;

GRANT CONNECT ON DATABASE company TO analyst;
GRANT USAGE ON SCHEMA public TO analyst;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO analyst;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO analyst;
