"""
Extensive synthetic company database — data generator.

Produces an ~200K-row, 21-table operational + analytics dataset for a fictional
SaaS + e-commerce company ("Northwind-meets-SaaS"). Designed for the DataPilot
live (Postgres) connector: rich foreign keys, seasonality, regional revenue
patterns and churn so investigations have something real to find.

Pipeline (all driven by build_company_db.ps1):
    1. this script  ->  _data/*.csv  +  generated_load.sql
    2. psql         ->  CREATE DATABASE company
    3. psql -f schema.sql
    4. psql -f generated_load.sql   (\copy each CSV, client-side)

Deterministic: a fixed RNG seed means re-running yields the identical dataset.
"""
from __future__ import annotations

import csv
import os
import random
from datetime import date, datetime, timedelta

SEED = 42
HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(HERE, "_data")
LOAD_SQL = os.path.join(HERE, "generated_load.sql")

# Simulation window: 3 years of history up to the project's "today".
START = date(2023, 1, 1)
TODAY = date(2026, 5, 17)
DAYS = (TODAY - START).days

rng = random.Random(SEED)


# ── helpers ───────────────────────────────────────────────────────────────────

def rand_date(start: date = START, end: date = TODAY) -> date:
    span = (end - start).days
    return start + timedelta(days=rng.randint(0, max(span, 0)))


def rand_ts(d: date) -> str:
    """A date plus a random business-ish time, ISO-8601."""
    return datetime(d.year, d.month, d.day,
                     rng.randint(7, 21), rng.randint(0, 59), rng.randint(0, 59)).isoformat(sep=" ")


def money(lo: float, hi: float) -> float:
    return round(rng.uniform(lo, hi), 2)


HEADERS: dict[str, list[str]] = {}


def write_table(name: str, header: list[str], rows: list[tuple]) -> None:
    HEADERS[name] = header
    os.makedirs(DATA_DIR, exist_ok=True)
    path = os.path.join(DATA_DIR, f"{name}.csv")
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(header)
        w.writerows(rows)
    print(f"  {name:<24} {len(rows):>8,} rows")


FIRST = ["Aarav", "Mia", "Liam", "Sofia", "Noah", "Ava", "Ethan", "Isla", "Kai", "Maya",
         "Lucas", "Zoe", "Aria", "Leo", "Nina", "Omar", "Priya", "Raj", "Sara", "Tara",
         "Yusuf", "Ines", "Diego", "Hana", "Bo", "Wei", "Anya", "Marco", "Lena", "Jonas"]
LAST = ["Sharma", "Khan", "Patel", "Silva", "Nguyen", "Garcia", "Mueller", "Rossi", "Kim",
        "Okafor", "Haddad", "Novak", "Olsen", "Costa", "Tanaka", "Singh", "Lopez", "Brown",
        "Dubois", "Ivanov", "Ali", "Schmidt", "Cohen", "Park", "Mensah", "Reyes", "Walsh"]
COMPANIES = ["Acme", "Globex", "Initech", "Umbrella", "Soylent", "Stark", "Wayne", "Wonka",
             "Hooli", "Pied Piper", "Vehement", "Massive Dynamic", "Cyberdyne", "Tyrell",
             "Aperture", "Black Mesa", "Oscorp", "Gringotts", "Nakatomi", "Weyland"]
SUFFIX = ["Corp", "Ltd", "Inc", "LLC", "Group", "Holdings", "Partners", "Systems", "Labs"]


def name() -> str:
    return f"{rng.choice(FIRST)} {rng.choice(LAST)}"


# ── 1. regions / countries ────────────────────────────────────────────────────

REGION_DATA = [
    (1, "North America", "Americas"),
    (2, "South America", "Americas"),
    (3, "Western Europe", "EMEA"),
    (4, "Eastern Europe", "EMEA"),
    (5, "Middle East & Africa", "EMEA"),
    (6, "South Asia", "APAC"),
    (7, "East Asia", "APAC"),
    (8, "Oceania", "APAC"),
]
write_table("regions", ["region_id", "region_name", "macro_area"], REGION_DATA)

COUNTRY_SEED = {
    1: ["United States", "Canada", "Mexico"],
    2: ["Brazil", "Argentina", "Chile", "Colombia"],
    3: ["United Kingdom", "Germany", "France", "Spain", "Italy", "Netherlands"],
    4: ["Poland", "Czechia", "Romania", "Hungary"],
    5: ["UAE", "Saudi Arabia", "South Africa", "Nigeria", "Kenya", "Egypt"],
    6: ["India", "Pakistan", "Bangladesh", "Sri Lanka"],
    7: ["Japan", "South Korea", "China", "Taiwan"],
    8: ["Australia", "New Zealand"],
}
countries = []
cid = 1
for region_id, names in COUNTRY_SEED.items():
    for n in names:
        countries.append((cid, n, region_id, n[:2].upper()))
        cid += 1
write_table("countries", ["country_id", "country_name", "region_id", "iso2"], countries)
COUNTRY_IDS = [c[0] for c in countries]


# ── 2. departments / employees / salary history ───────────────────────────────

DEPARTMENTS = [
    (1, "Executive", "Leadership"),
    (2, "Engineering", "Product"),
    (3, "Product", "Product"),
    (4, "Design", "Product"),
    (5, "Sales", "Go-To-Market"),
    (6, "Marketing", "Go-To-Market"),
    (7, "Customer Success", "Go-To-Market"),
    (8, "Support", "Operations"),
    (9, "Finance", "Operations"),
    (10, "People Ops", "Operations"),
    (11, "Legal", "Operations"),
    (12, "Data & Analytics", "Product"),
]
write_table("departments", ["department_id", "department_name", "division"], DEPARTMENTS)

TITLES = {
    1: ["CEO", "COO", "CFO", "CTO"],
    2: ["Software Engineer", "Senior Engineer", "Staff Engineer", "Engineering Manager"],
    3: ["Product Manager", "Senior PM", "Group PM"],
    4: ["Product Designer", "Senior Designer", "Design Lead"],
    5: ["Account Executive", "SDR", "Sales Manager", "VP Sales"],
    6: ["Marketing Specialist", "Content Lead", "Growth Manager"],
    7: ["CSM", "Senior CSM", "CS Manager"],
    8: ["Support Agent", "Senior Support", "Support Lead"],
    9: ["Accountant", "Financial Analyst", "Controller"],
    10: ["Recruiter", "HRBP", "People Lead"],
    11: ["Counsel", "Senior Counsel"],
    12: ["Data Analyst", "Data Engineer", "Analytics Lead"],
}
NUM_EMPLOYEES = 2000
employees = []
salary_history = []
for emp_id in range(1, NUM_EMPLOYEES + 1):
    dept = rng.randint(1, 12) if emp_id > 4 else emp_id  # first 4 are execs
    dept = min(dept, 12)
    title = rng.choice(TITLES.get(dept, ["Associate"]))
    hire = rand_date(date(2019, 1, 1), TODAY - timedelta(days=30))
    is_active = rng.random() > 0.12
    term = "" if is_active else (hire + timedelta(days=rng.randint(180, 1500))).isoformat()
    manager = "" if emp_id <= 4 else rng.randint(1, max(emp_id - 1, 4))
    base = {2: 145, 1: 320, 12: 150}.get(dept, 95) * 1000
    salary = round(base * rng.uniform(0.7, 1.8), -2)
    employees.append((
        emp_id, name(), f"emp{emp_id}@company.example", dept, title,
        manager, hire.isoformat(), term, is_active,
        rng.choice(COUNTRY_IDS), salary,
    ))
    # 1-3 salary revisions per employee
    rev_date = hire
    cur = salary * rng.uniform(0.7, 0.9)
    for _ in range(rng.randint(1, 3)):
        rev_date = rev_date + timedelta(days=rng.randint(200, 600))
        if rev_date > TODAY:
            break
        cur = round(cur * rng.uniform(1.03, 1.18), -2)
        salary_history.append((emp_id, rev_date.isoformat(), round(cur, 2)))
write_table("employees",
            ["employee_id", "full_name", "email", "department_id", "job_title",
             "manager_id", "hire_date", "termination_date", "is_active",
             "country_id", "current_salary"],
            employees)
write_table("salary_history",
            ["employee_id", "effective_date", "annual_salary"],
            salary_history)
SALES_REPS = [e[0] for e in employees if e[3] == 5 and e[8]]  # active sales dept


# ── 3. product catalog ────────────────────────────────────────────────────────

CATEGORIES = [
    "Laptops", "Monitors", "Keyboards", "Mice", "Docks", "Webcams", "Headsets",
    "Storage", "Networking", "Cables", "Chairs", "Desks", "Lighting", "Software Licenses",
    "Cloud Credits", "Support Plans", "Training", "Accessories", "Tablets", "Phones",
    "Printers", "Scanners", "Projectors", "Servers",
]
categories = [(i + 1, c, "Hardware" if i < 13 else "Services" if 13 <= i <= 16 else "Hardware")
              for i, c in enumerate(CATEGORIES)]
write_table("product_categories", ["category_id", "category_name", "product_line"], categories)

NUM_SUPPLIERS = 150
suppliers = []
for sid in range(1, NUM_SUPPLIERS + 1):
    suppliers.append((
        sid, f"{rng.choice(COMPANIES)} {rng.choice(SUFFIX)} #{sid}",
        rng.choice(COUNTRY_IDS), name(), f"vendor{sid}@supply.example",
        round(rng.uniform(2.5, 5.0), 2),  # reliability score
    ))
write_table("suppliers",
            ["supplier_id", "supplier_name", "country_id", "contact_name",
             "contact_email", "reliability_score"],
            suppliers)

NUM_PRODUCTS = 1200
products = []
for pid in range(1, NUM_PRODUCTS + 1):
    cat = rng.randint(1, len(CATEGORIES))
    cost = money(5, 1800)
    products.append((
        pid, f"{rng.choice(COMPANIES)} {CATEGORIES[cat - 1][:-1] if CATEGORIES[cat-1].endswith('s') else CATEGORIES[cat-1]} {pid}",
        f"SKU-{cat:02d}-{pid:05d}", cat, rng.randint(1, NUM_SUPPLIERS),
        cost, round(cost * rng.uniform(1.25, 2.4), 2),
        rng.random() > 0.08,  # is_active
        rand_date(date(2021, 1, 1)).isoformat(),
    ))
write_table("products",
            ["product_id", "product_name", "sku", "category_id", "supplier_id",
             "unit_cost", "list_price", "is_active", "launched_on"],
            products)


# ── 4. warehouses + inventory ─────────────────────────────────────────────────

NUM_WAREHOUSES = 12
warehouses = []
for wid in range(1, NUM_WAREHOUSES + 1):
    warehouses.append((
        wid, f"DC-{wid:02d}", rng.choice(COUNTRY_IDS),
        rng.randint(10000, 200000),  # capacity units
    ))
write_table("warehouses", ["warehouse_id", "warehouse_code", "country_id", "capacity_units"],
            warehouses)

inventory = []
for pid in range(1, NUM_PRODUCTS + 1):
    for wid in rng.sample(range(1, NUM_WAREHOUSES + 1), rng.randint(1, 5)):
        inventory.append((
            pid, wid, rng.randint(0, 4000),
            rng.randint(10, 200),  # reorder level
            rand_ts(rand_date(TODAY - timedelta(days=120))),
        ))
write_table("inventory",
            ["product_id", "warehouse_id", "quantity_on_hand", "reorder_level", "last_counted_at"],
            inventory)


# ── 5. customers ──────────────────────────────────────────────────────────────

SEGMENTS = ["SMB", "Mid-Market", "Enterprise", "Strategic"]
INDUSTRIES = ["Technology", "Finance", "Healthcare", "Retail", "Manufacturing",
              "Education", "Media", "Logistics", "Energy", "Public Sector"]
NUM_CUSTOMERS = 12000
customers = []
for cust_id in range(1, NUM_CUSTOMERS + 1):
    signup = rand_date()
    seg = rng.choices(SEGMENTS, weights=[55, 28, 13, 4])[0]
    customers.append((
        cust_id,
        f"{rng.choice(COMPANIES)} {rng.choice(SUFFIX)}",
        f"contact{cust_id}@client.example",
        rng.choice(COUNTRY_IDS), seg, rng.choice(INDUSTRIES),
        signup.isoformat(),
        rng.choice(SALES_REPS) if SALES_REPS else "",
        round(rng.uniform(0.0, 1.0), 3),  # health_score
    ))
write_table("customers",
            ["customer_id", "company_name", "primary_email", "country_id",
             "segment", "industry", "signup_date", "account_owner_id", "health_score"],
            customers)


# ── 6. subscriptions (SaaS recurring revenue) ─────────────────────────────────

PLANS = [
    (1, "Free", 0, "monthly"),
    (2, "Starter", 49, "monthly"),
    (3, "Growth", 199, "monthly"),
    (4, "Scale", 799, "monthly"),
    (5, "Enterprise", 2500, "monthly"),
    (6, "Enterprise Annual", 27000, "annual"),
]
write_table("subscription_plans",
            ["plan_id", "plan_name", "monthly_price_usd", "billing_cycle"], PLANS)

NUM_SUBSCRIPTIONS = 9000
subscriptions = []
for sub_id in range(1, NUM_SUBSCRIPTIONS + 1):
    cust = rng.randint(1, NUM_CUSTOMERS)
    plan = rng.choices([1, 2, 3, 4, 5, 6], weights=[20, 30, 25, 12, 8, 5])[0]
    start = rand_date(date(2023, 1, 1), TODAY - timedelta(days=10))
    # Churn: ~22% have ended; spike churn for plan 2 in 2025 H2 (a finding to discover).
    churn_p = 0.22
    if plan == 2 and start >= date(2025, 7, 1):
        churn_p = 0.55
    ended = ""
    status = "active"
    if rng.random() < churn_p:
        end = start + timedelta(days=rng.randint(30, 700))
        if end < TODAY:
            ended = end.isoformat()
            status = "churned"
    seats = rng.randint(1, 250)
    subscriptions.append((
        sub_id, cust, plan, start.isoformat(), ended, status, seats,
    ))
write_table("subscriptions",
            ["subscription_id", "customer_id", "plan_id", "started_on",
             "ended_on", "status", "seats"],
            subscriptions)


# ── 7. orders + order_items + payments + shipments + invoices ─────────────────

ORDER_STATUS = ["completed", "completed", "completed", "completed",
                "refunded", "cancelled", "processing"]
PAYMENT_METHODS = ["credit_card", "wire", "paypal", "ach", "invoice_net30"]
SHIP_CARRIERS = ["DHL", "FedEx", "UPS", "BlueDart", "Aramex"]

NUM_ORDERS = 22000
orders, order_items, payments, shipments, invoices = [], [], [], [], []
oi_id = 1
for order_id in range(1, NUM_ORDERS + 1):
    cust = rng.randint(1, NUM_CUSTOMERS)
    od = rand_date(date(2023, 1, 1), TODAY)
    # Seasonality: Q4 lift, plus a deliberate APAC revenue dip in 2025-04 for the
    # "why did revenue drop" investigation.
    season = 1.0
    if od.month in (11, 12):
        season = 1.6
    if od.month in (1, 2):
        season = 0.8
    status = rng.choice(ORDER_STATUS)
    n_items = rng.randint(1, 6)
    subtotal = 0.0
    item_rows = []
    for _ in range(n_items):
        pid = rng.randint(1, NUM_PRODUCTS)
        qty = rng.randint(1, 20)
        unit = products[pid - 1][6]  # list_price
        disc = rng.choice([0, 0, 0, 0.05, 0.1, 0.15, 0.2])
        line = round(unit * qty * (1 - disc) * season, 2)
        subtotal += line
        item_rows.append((oi_id, order_id, pid, qty, unit, disc, line))
        oi_id += 1
    region_country = rng.choice(COUNTRY_IDS)
    # APAC dip: region_id 6/7/8 countries in Apr 2025 lose 70% of value.
    if od.year == 2025 and od.month == 4:
        rc_region = next((c[2] for c in countries if c[0] == region_country), 1)
        if rc_region in (6, 7, 8):
            subtotal *= 0.3
            for k in range(len(item_rows)):
                r = item_rows[k]
                item_rows[k] = (r[0], r[1], r[2], r[3], r[4], r[5], round(r[6] * 0.3, 2))
    shipping = money(0, 60) if status != "cancelled" else 0
    tax = round(subtotal * 0.08, 2)
    total = round(subtotal + shipping + tax, 2)
    orders.append((
        order_id, cust, od.isoformat(), status, region_country,
        rng.choice(SALES_REPS) if SALES_REPS else "",
        round(subtotal, 2), shipping, tax, total,
    ))
    order_items.extend(item_rows)

    if status not in ("cancelled",):
        pay_status = "refunded" if status == "refunded" else "captured"
        payments.append((
            order_id, rng.choice(PAYMENT_METHODS), total,
            pay_status, rand_ts(od),
        ))
        inv_due = od + timedelta(days=30)
        invoices.append((
            order_id, cust, f"INV-{od.year}-{order_id:06d}", total,
            od.isoformat(), inv_due.isoformat(),
            "paid" if status == "completed" else pay_status,
        ))
    if status in ("completed", "refunded", "processing"):
        ship_d = od + timedelta(days=rng.randint(1, 9))
        shipments.append((
            order_id, rng.choice(range(1, NUM_WAREHOUSES + 1)),
            rng.choice(SHIP_CARRIERS),
            f"TRK{rng.randint(10**9, 10**10 - 1)}",
            ship_d.isoformat(),
            (ship_d + timedelta(days=rng.randint(2, 14))).isoformat() if status != "processing" else "",
            "delivered" if status == "completed" else "in_transit",
        ))

write_table("orders",
            ["order_id", "customer_id", "order_date", "status", "country_id",
             "sales_rep_id", "subtotal", "shipping_fee", "tax", "total_amount"],
            orders)
write_table("order_items",
            ["order_item_id", "order_id", "product_id", "quantity",
             "unit_price", "discount_pct", "line_total"],
            order_items)
write_table("payments",
            ["payment_id", "order_id", "method", "amount", "status", "paid_at"],
            [(i + 1, *p) for i, p in enumerate(payments)])
write_table("invoices",
            ["invoice_id", "order_id", "customer_id", "invoice_number",
             "amount", "issued_on", "due_on", "status"],
            [(i + 1, *v) for i, v in enumerate(invoices)])
write_table("shipments",
            ["shipment_id", "order_id", "warehouse_id", "carrier",
             "tracking_number", "shipped_on", "delivered_on", "status"],
            [(i + 1, *s) for i, s in enumerate(shipments)])


# ── 8. support tickets ────────────────────────────────────────────────────────

TICKET_CAT = ["Billing", "Bug", "How-To", "Feature Request", "Outage", "Onboarding"]
TICKET_PRIO = ["low", "medium", "high", "urgent"]
SUPPORT_AGENTS = [e[0] for e in employees if e[3] == 8 and e[8]] or [1]
NUM_TICKETS = 7000
tickets = []
for tid in range(1, NUM_TICKETS + 1):
    opened = rand_date(date(2023, 6, 1), TODAY)
    prio = rng.choices(TICKET_PRIO, weights=[40, 35, 18, 7])[0]
    resolved = rng.random() > 0.15
    # Resolution time degrades in 2025-Q4 (another finding).
    base_hours = {"low": 48, "medium": 24, "high": 8, "urgent": 3}[prio]
    if opened >= date(2025, 10, 1):
        base_hours *= 2.5
    rt = round(rng.uniform(0.5, base_hours), 1) if resolved else ""
    closed = (opened + timedelta(days=rng.randint(0, 20))).isoformat() if resolved else ""
    tickets.append((
        tid, rng.randint(1, NUM_CUSTOMERS), rng.choice(TICKET_CAT), prio,
        "resolved" if resolved else rng.choice(["open", "pending"]),
        rng.choice(SUPPORT_AGENTS), opened.isoformat(), closed, rt,
        rng.randint(1, 5) if resolved else "",  # csat
    ))
write_table("support_tickets",
            ["ticket_id", "customer_id", "category", "priority", "status",
             "agent_id", "opened_on", "closed_on", "resolution_hours", "csat"],
            tickets)


# ── 9. marketing campaigns + web usage events ─────────────────────────────────

CHANNELS = ["paid_search", "social", "email", "events", "partner", "organic"]
NUM_CAMPAIGNS = 80
campaigns = []
for cmp_id in range(1, NUM_CAMPAIGNS + 1):
    start = rand_date(date(2023, 1, 1), TODAY - timedelta(days=30))
    budget = money(2000, 250000)
    campaigns.append((
        cmp_id, f"{rng.choice(['Q1','Q2','Q3','Q4'])} {start.year} {rng.choice(CHANNELS)} push",
        rng.choice(CHANNELS), start.isoformat(),
        (start + timedelta(days=rng.randint(14, 120))).isoformat(),
        budget, round(budget * rng.uniform(0.4, 3.5), 2),  # attributed revenue
        rng.randint(50, 50000),  # leads
    ))
write_table("marketing_campaigns",
            ["campaign_id", "campaign_name", "channel", "start_date", "end_date",
             "budget_usd", "attributed_revenue_usd", "leads_generated"],
            campaigns)

EVENT_TYPES = ["login", "page_view", "report_run", "export", "query", "invite",
               "dashboard_view", "api_call", "error"]
NUM_EVENTS = 35000
events = []
for ev_id in range(1, NUM_EVENTS + 1):
    d = rand_date(date(2024, 1, 1), TODAY)
    events.append((
        ev_id, rng.randint(1, NUM_CUSTOMERS), rng.choice(EVENT_TYPES),
        rand_ts(d), rng.choice(["web", "mobile", "api"]),
        round(rng.uniform(0.01, 4.0), 3),  # duration seconds
    ))
write_table("web_usage_events",
            ["event_id", "customer_id", "event_type", "occurred_at",
             "platform", "duration_seconds"],
            events)


# ── load.sql generator ────────────────────────────────────────────────────────

# Order matters: parents before children (FK-safe).
LOAD_ORDER = [
    "regions", "countries", "departments", "employees", "salary_history",
    "product_categories", "suppliers", "products", "warehouses", "inventory",
    "customers", "subscription_plans", "subscriptions", "orders", "order_items",
    "payments", "invoices", "shipments", "support_tickets",
    "marketing_campaigns", "web_usage_events",
]
with open(LOAD_SQL, "w", encoding="utf-8") as fh:
    fh.write("-- Auto-generated by build_company_db.py. Run with: psql -d company -f generated_load.sql\n")
    fh.write("BEGIN;\n")
    for t in LOAD_ORDER:
        csv_path = os.path.join(DATA_DIR, f"{t}.csv").replace("\\", "/")
        cols = ", ".join(HEADERS[t])
        fh.write(f"\\copy {t} ({cols}) FROM '{csv_path}' WITH (FORMAT csv, HEADER true, NULL '');\n")
    fh.write("COMMIT;\n")
    # Refresh planner stats so the live connector gets good plans.
    fh.write("ANALYZE;\n")

print(f"\nLoad script written: {LOAD_SQL}")
print("Done.")
