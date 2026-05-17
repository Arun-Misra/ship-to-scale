#!/bin/bash
set -euo pipefail

CONF_FILE="/opt/homebrew/var/postgresql@18/postgresql.conf"
HBA_FILE="/opt/homebrew/var/postgresql@18/pg_hba.conf"

# 1. Update postgresql.conf
sed -i '' "s/^#*listen_addresses =.*/listen_addresses = '*'/" "$CONF_FILE"
if grep -q "shared_preload_libraries" "$CONF_FILE"; then
    sed -i '' "s/^#*shared_preload_libraries =.*/shared_preload_libraries = 'pg_stat_statements'/" "$CONF_FILE"
else
    echo "shared_preload_libraries = 'pg_stat_statements'" >> "$CONF_FILE"
fi

# 2. Update pg_hba.conf
LINE="host    all             all             192.168.8.0/24          scram-sha-256"
grep -qxF "$LINE" "$HBA_FILE" || echo "$LINE" >> "$HBA_FILE"

# 3. Restart and Wait
brew services restart postgresql@18
for i in {1..10}; do pg_isready && break || sleep 1; done

# 4. Create DB
psql -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'app_db'" | grep -q 1 || psql -d postgres -c "CREATE DATABASE app_db"

# 5. Run SQL
APP_READONLY_PASSWORD=$(openssl rand -base64 24)

psql -d app_db <<SQL
-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Schemas
CREATE SCHEMA IF NOT EXISTS users;
CREATE SCHEMA IF NOT EXISTS catalog;
CREATE SCHEMA IF NOT EXISTS telemetry;

-- Function
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER AS \$\$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
\$\$ language 'plpgsql';

-- Tables
CREATE TABLE IF NOT EXISTS users.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email citext UNIQUE NOT NULL,
    dynamic_attributes JSONB,
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalog.items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    specifications JSONB,
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Triggers
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_accounts_updated_at') THEN
        CREATE TRIGGER tr_accounts_updated_at BEFORE UPDATE ON users.accounts FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_items_updated_at') THEN
        CREATE TRIGGER tr_items_updated_at BEFORE UPDATE ON catalog.items FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
    END IF;
END
\$\$;

-- Partitioned Table
CREATE TABLE IF NOT EXISTS telemetry.events (
    id UUID NOT NULL,
    account_id UUID NOT NULL,
    event_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE IF NOT EXISTS telemetry.events_default PARTITION OF telemetry.events DEFAULT;
CREATE TABLE IF NOT EXISTS telemetry.events_2026_05 PARTITION OF telemetry.events FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS telemetry.events_2026_06 PARTITION OF telemetry.events FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_accounts_dyn_attr ON users.accounts USING GIN (dynamic_attributes jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_items_specs ON catalog.items USING GIN (specifications jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_telemetry_account_id ON telemetry.events (account_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_payload ON telemetry.events USING GIN (event_payload jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_telemetry_created_brin ON telemetry.events USING BRIN (created_at);

-- 6. Read-only Role
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_readonly') THEN
        CREATE ROLE app_readonly WITH LOGIN PASSWORD '$APP_READONLY_PASSWORD';
    ELSE
        ALTER ROLE app_readonly WITH PASSWORD '$APP_READONLY_PASSWORD';
    END IF;
END
\$\$;

-- 7. Grant permissions
GRANT CONNECT ON DATABASE app_db TO app_readonly;
GRANT USAGE ON SCHEMA users, catalog, telemetry TO app_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA users, catalog, telemetry TO app_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA users, catalog, telemetry TO app_readonly;

ALTER DEFAULT PRIVILEGES IN SCHEMA users, catalog, telemetry GRANT SELECT ON TABLES TO app_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA users, catalog, telemetry GRANT SELECT ON SEQUENCES TO app_readonly;
SQL

# 8. Verification
echo "--- CONFIG ---"
psql -d app_db -c "SHOW listen_addresses; SHOW shared_preload_libraries;"
echo "--- SCHEMAS ---"
psql -d app_db -c "\dn users|catalog|telemetry"
echo "--- TABLES ---"
psql -d app_db -c "\dt users.*"
psql -d app_db -c "\dt catalog.*"
psql -d app_db -c "\dt telemetry.*"
echo "--- ROLE ---"
psql -d app_db -c "SELECT rolname, rolcanlogin FROM pg_roles WHERE rolname = 'app_readonly';"
echo "--- TEST CONNECTION ---"
PGPASSWORD="$APP_READONLY_PASSWORD" psql -h localhost -U app_readonly -d app_db -c "SELECT current_user, now();"

echo "APP_READONLY_PASSWORD=$APP_READONLY_PASSWORD"
