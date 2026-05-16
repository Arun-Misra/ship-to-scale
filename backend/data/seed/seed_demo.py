"""
Seed script — creates the baked read-only demo.duckdb file.
Run once before building the Docker image: python data/seed/seed_demo.py

The demo dataset has intentional quality issues for the quality scan demo:
- Mixed date formats in orders.created_at
- Duplicated customer emails
- Null shipping addresses
- Revenue drop in week 14 (for the "why did revenue drop" kill-shot investigation)
"""
import duckdb
import os

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "demo.duckdb")


def seed():
    if os.path.exists(OUTPUT_PATH):
        os.remove(OUTPUT_PATH)

    con = duckdb.connect(OUTPUT_PATH)

    con.execute("""
        CREATE TABLE customers (
            customer_id INTEGER PRIMARY KEY,
            name VARCHAR,
            email VARCHAR,
            region VARCHAR,
            signup_date VARCHAR,    -- intentionally mixed date formats
            plan VARCHAR
        )
    """)

    con.execute("""
        CREATE TABLE orders (
            order_id INTEGER PRIMARY KEY,
            customer_id INTEGER,
            order_total DECIMAL(10,2),
            refunded BOOLEAN DEFAULT FALSE,
            shipping_fee DECIMAL(10,2),
            status VARCHAR,
            created_at VARCHAR,     -- intentionally mixed date formats
            region VARCHAR
        )
    """)

    # Seed customers — include duplicates for quality scan demo
    con.execute("""
        INSERT INTO customers VALUES
        (1, 'Acme Corp', 'acme@example.com', 'North America', '2025-01-15', 'growth'),
        (2, 'Beta Ltd', 'beta@example.com', 'Europe', '01/20/2025', 'starter'),
        (3, 'Gamma Inc', 'gamma@example.com', 'Asia', '2025-02-01', 'scale'),
        (4, 'Acme Corp', 'acme@example.com', 'North America', '2025-01-15', 'growth'),  -- duplicate
        (5, 'Delta Co', NULL, 'North America', '02/15/2025', 'starter')  -- null email
    """)

    # Seed orders — revenue drops in week 14 (April 2025) for Mumbai region specifically
    con.executemany(
        "INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        _generate_orders(),
    )

    con.close()
    print(f"Demo database seeded at {OUTPUT_PATH}")


def _generate_orders():
    import random
    random.seed(42)
    orders = []
    order_id = 1
    regions = ["North America", "Europe", "Asia", "Mumbai"]
    for week in range(1, 20):
        for _ in range(random.randint(20, 35)):
            region = random.choice(regions)
            total = random.uniform(100, 5000)
            # Revenue drop in week 14 for Mumbai
            if week == 14 and region == "Mumbai":
                total *= 0.3
            orders.append((
                order_id,
                random.randint(1, 5),
                round(total, 2),
                random.random() < 0.05,
                round(random.uniform(5, 50), 2),
                "completed",
                f"2025-{week:02d}-01" if week % 2 == 0 else f"{week:02d}/01/2025",  # mixed formats
                region,
            ))
            order_id += 1
    return orders


if __name__ == "__main__":
    seed()
