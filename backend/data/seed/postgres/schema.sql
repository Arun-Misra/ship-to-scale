-- Extensive synthetic company database — schema (Postgres 12+).
-- Apply with:  psql -d company -f schema.sql
-- Data is loaded separately by generated_load.sql (FK-safe parent->child order).

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- ── geography ────────────────────────────────────────────────────────────────
CREATE TABLE regions (
    region_id    INT PRIMARY KEY,
    region_name  TEXT NOT NULL,
    macro_area   TEXT NOT NULL
);

CREATE TABLE countries (
    country_id    INT PRIMARY KEY,
    country_name  TEXT NOT NULL,
    region_id     INT NOT NULL REFERENCES regions(region_id),
    iso2          TEXT NOT NULL
);

-- ── org ──────────────────────────────────────────────────────────────────────
CREATE TABLE departments (
    department_id    INT PRIMARY KEY,
    department_name  TEXT NOT NULL,
    division         TEXT NOT NULL
);

CREATE TABLE employees (
    employee_id        INT PRIMARY KEY,
    full_name          TEXT NOT NULL,
    email              TEXT NOT NULL,
    department_id      INT NOT NULL REFERENCES departments(department_id),
    job_title          TEXT NOT NULL,
    manager_id         INT REFERENCES employees(employee_id),
    hire_date          DATE NOT NULL,
    termination_date   DATE,
    is_active          BOOLEAN NOT NULL,
    country_id         INT NOT NULL REFERENCES countries(country_id),
    current_salary     NUMERIC(12,2) NOT NULL
);

CREATE TABLE salary_history (
    salary_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employee_id     INT NOT NULL REFERENCES employees(employee_id),
    effective_date  DATE NOT NULL,
    annual_salary   NUMERIC(12,2) NOT NULL
);

-- ── product catalog ──────────────────────────────────────────────────────────
CREATE TABLE product_categories (
    category_id    INT PRIMARY KEY,
    category_name  TEXT NOT NULL,
    product_line   TEXT NOT NULL
);

CREATE TABLE suppliers (
    supplier_id        INT PRIMARY KEY,
    supplier_name      TEXT NOT NULL,
    country_id         INT NOT NULL REFERENCES countries(country_id),
    contact_name       TEXT NOT NULL,
    contact_email      TEXT NOT NULL,
    reliability_score  NUMERIC(3,2) NOT NULL
);

CREATE TABLE products (
    product_id    INT PRIMARY KEY,
    product_name  TEXT NOT NULL,
    sku           TEXT NOT NULL UNIQUE,
    category_id   INT NOT NULL REFERENCES product_categories(category_id),
    supplier_id   INT NOT NULL REFERENCES suppliers(supplier_id),
    unit_cost     NUMERIC(12,2) NOT NULL,
    list_price    NUMERIC(12,2) NOT NULL,
    is_active     BOOLEAN NOT NULL,
    launched_on   DATE NOT NULL
);

CREATE TABLE warehouses (
    warehouse_id    INT PRIMARY KEY,
    warehouse_code  TEXT NOT NULL,
    country_id      INT NOT NULL REFERENCES countries(country_id),
    capacity_units  INT NOT NULL
);

CREATE TABLE inventory (
    product_id        INT NOT NULL REFERENCES products(product_id),
    warehouse_id      INT NOT NULL REFERENCES warehouses(warehouse_id),
    quantity_on_hand  INT NOT NULL,
    reorder_level     INT NOT NULL,
    last_counted_at   TIMESTAMP NOT NULL,
    PRIMARY KEY (product_id, warehouse_id)
);

-- ── customers & recurring revenue ────────────────────────────────────────────
CREATE TABLE customers (
    customer_id       INT PRIMARY KEY,
    company_name      TEXT NOT NULL,
    primary_email     TEXT NOT NULL,
    country_id        INT NOT NULL REFERENCES countries(country_id),
    segment           TEXT NOT NULL,
    industry          TEXT NOT NULL,
    signup_date       DATE NOT NULL,
    account_owner_id  INT REFERENCES employees(employee_id),
    health_score      NUMERIC(4,3) NOT NULL
);

CREATE TABLE subscription_plans (
    plan_id            INT PRIMARY KEY,
    plan_name          TEXT NOT NULL,
    monthly_price_usd  NUMERIC(12,2) NOT NULL,
    billing_cycle      TEXT NOT NULL
);

CREATE TABLE subscriptions (
    subscription_id  INT PRIMARY KEY,
    customer_id      INT NOT NULL REFERENCES customers(customer_id),
    plan_id          INT NOT NULL REFERENCES subscription_plans(plan_id),
    started_on       DATE NOT NULL,
    ended_on         DATE,
    status           TEXT NOT NULL,
    seats            INT NOT NULL
);

-- ── transactional core ───────────────────────────────────────────────────────
CREATE TABLE orders (
    order_id      INT PRIMARY KEY,
    customer_id   INT NOT NULL REFERENCES customers(customer_id),
    order_date    DATE NOT NULL,
    status        TEXT NOT NULL,
    country_id    INT NOT NULL REFERENCES countries(country_id),
    sales_rep_id  INT REFERENCES employees(employee_id),
    subtotal      NUMERIC(12,2) NOT NULL,
    shipping_fee  NUMERIC(12,2) NOT NULL,
    tax           NUMERIC(12,2) NOT NULL,
    total_amount  NUMERIC(12,2) NOT NULL
);

CREATE TABLE order_items (
    order_item_id  INT PRIMARY KEY,
    order_id       INT NOT NULL REFERENCES orders(order_id),
    product_id     INT NOT NULL REFERENCES products(product_id),
    quantity       INT NOT NULL,
    unit_price     NUMERIC(12,2) NOT NULL,
    discount_pct   NUMERIC(4,2) NOT NULL,
    line_total     NUMERIC(12,2) NOT NULL
);

CREATE TABLE payments (
    payment_id  INT PRIMARY KEY,
    order_id    INT NOT NULL REFERENCES orders(order_id),
    method      TEXT NOT NULL,
    amount      NUMERIC(12,2) NOT NULL,
    status      TEXT NOT NULL,
    paid_at     TIMESTAMP NOT NULL
);

CREATE TABLE invoices (
    invoice_id      INT PRIMARY KEY,
    order_id        INT NOT NULL REFERENCES orders(order_id),
    customer_id     INT NOT NULL REFERENCES customers(customer_id),
    invoice_number  TEXT NOT NULL,
    amount          NUMERIC(12,2) NOT NULL,
    issued_on       DATE NOT NULL,
    due_on          DATE NOT NULL,
    status          TEXT NOT NULL
);

CREATE TABLE shipments (
    shipment_id      INT PRIMARY KEY,
    order_id         INT NOT NULL REFERENCES orders(order_id),
    warehouse_id     INT NOT NULL REFERENCES warehouses(warehouse_id),
    carrier          TEXT NOT NULL,
    tracking_number  TEXT NOT NULL,
    shipped_on       DATE NOT NULL,
    delivered_on     DATE,
    status           TEXT NOT NULL
);

-- ── support & growth ─────────────────────────────────────────────────────────
CREATE TABLE support_tickets (
    ticket_id         INT PRIMARY KEY,
    customer_id       INT NOT NULL REFERENCES customers(customer_id),
    category          TEXT NOT NULL,
    priority          TEXT NOT NULL,
    status            TEXT NOT NULL,
    agent_id          INT NOT NULL REFERENCES employees(employee_id),
    opened_on         DATE NOT NULL,
    closed_on         DATE,
    resolution_hours  NUMERIC(8,1),
    csat              INT
);

CREATE TABLE marketing_campaigns (
    campaign_id              INT PRIMARY KEY,
    campaign_name            TEXT NOT NULL,
    channel                  TEXT NOT NULL,
    start_date               DATE NOT NULL,
    end_date                 DATE NOT NULL,
    budget_usd               NUMERIC(12,2) NOT NULL,
    attributed_revenue_usd   NUMERIC(12,2) NOT NULL,
    leads_generated          INT NOT NULL
);

CREATE TABLE web_usage_events (
    event_id          INT PRIMARY KEY,
    customer_id       INT NOT NULL REFERENCES customers(customer_id),
    event_type        TEXT NOT NULL,
    occurred_at       TIMESTAMP NOT NULL,
    platform          TEXT NOT NULL,
    duration_seconds  NUMERIC(8,3) NOT NULL
);

-- ── indexes for the analytics workload ───────────────────────────────────────
CREATE INDEX idx_orders_date        ON orders (order_date);
CREATE INDEX idx_orders_customer    ON orders (customer_id);
CREATE INDEX idx_orders_country     ON orders (country_id);
CREATE INDEX idx_order_items_order  ON order_items (order_id);
CREATE INDEX idx_order_items_prod   ON order_items (product_id);
CREATE INDEX idx_payments_order     ON payments (order_id);
CREATE INDEX idx_invoices_customer  ON invoices (customer_id);
CREATE INDEX idx_subs_customer      ON subscriptions (customer_id);
CREATE INDEX idx_subs_status        ON subscriptions (status);
CREATE INDEX idx_tickets_customer   ON support_tickets (customer_id);
CREATE INDEX idx_tickets_opened     ON support_tickets (opened_on);
CREATE INDEX idx_events_customer    ON web_usage_events (customer_id);
CREATE INDEX idx_events_time        ON web_usage_events (occurred_at);
CREATE INDEX idx_employees_dept     ON employees (department_id);
CREATE INDEX idx_products_category  ON products (category_id);
