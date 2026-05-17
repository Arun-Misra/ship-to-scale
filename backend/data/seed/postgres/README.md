# `company` — extensive synthetic Postgres database

A ~226K-row, 21-table operational + analytics dataset for a fictional SaaS +
e-commerce company. Built for the DataPilot **live (Postgres) connector**.

## Quick start

Postgres 18 is already installed locally (service `postgresql-x64-18`, admin
`postgres` / `1234`). Rebuild everything from scratch with one command:

```powershell
powershell -ExecutionPolicy Bypass -File backend\data\seed\postgres\build_company_db.ps1
```

This is idempotent — it drops and recreates the `company` database each run.

## Connecting from the app

The app probes the supplied role and **rejects any role that can write**, so
connect as the dedicated read-only role, never as `postgres`:

```
host=localhost port=5432 dbname=company user=analyst password=1234
```

(`analyst` has `SELECT` on every table and nothing else.)

## Schema (21 tables)

| Group | Tables |
|---|---|
| Geography | `regions`, `countries` |
| Org | `departments`, `employees` (self-ref manager), `salary_history` |
| Catalog | `product_categories`, `suppliers`, `products`, `warehouses`, `inventory` |
| Customers / revenue | `customers`, `subscription_plans`, `subscriptions` |
| Transactions | `orders`, `order_items`, `payments`, `invoices`, `shipments` |
| Support / growth | `support_tickets`, `marketing_campaigns`, `web_usage_events` |

Largest tables: `order_items` (~77K), `web_usage_events` (35K), `orders` (22K),
`payments`/`invoices`/`shipments` (~19K each), `customers` (12K).
All foreign keys are enforced; indexes cover the analytics workload. Total size
on disk ≈ 39 MB. The dataset is deterministic (RNG seed 42) — a rebuild
reproduces it exactly.

## Intentional patterns to investigate

- **APAC revenue collapse, April 2025.** Orders from APAC countries
  (`regions` 6/7/8) in 2025-04 are ~70% below the trend (≈3.0M vs ≈10M in
  neighbouring months). This is the headline "why did revenue drop"
  investigation.
- **Seasonality.** Q4 (Nov/Dec) revenue lifts ~60%, Jan/Feb dips ~20%.
- **Support SLA degradation.** Ticket `resolution_hours` worsens ~2.5x from
  2025-Q4 onward.
- **Churn.** ~20% of subscriptions have `status = 'churned'`; the Starter plan
  (`plan_id = 2`) was configured for elevated churn in 2025-H2, though
  right-censoring (recent subs haven't reached their churn date) means the
  *observed* rate doesn't yet spike — a realistic survivorship nuance.

## Files

| File | Purpose |
|---|---|
| `build_company_db.py` | Deterministic data generator → `_data/*.csv` + `generated_load.sql` |
| `schema.sql` | DDL: tables, FKs, indexes |
| `generated_load.sql` | Auto-generated `\copy` loader (FK-safe order) |
| `grants.sql` | Creates/refreshes the read-only `analyst` role |
| `build_company_db.ps1` | One-command end-to-end rebuild |
| `_data/` | Generated CSVs (regenerable; safe to delete) |
