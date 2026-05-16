"""P1 gate: SQL sandbox screen rejects DDL/DML and multi-statement."""
from app.db.sandbox import screen_sql


def test_select_passes():
    assert screen_sql("SELECT id, name FROM customers") is None


def test_insert_rejected():
    assert screen_sql("INSERT INTO customers VALUES (1, 'x')") is not None


def test_drop_rejected():
    assert screen_sql("DROP TABLE customers") is not None


def test_multi_statement_rejected():
    assert screen_sql("SELECT 1; DROP TABLE customers") is not None


def test_subquery_passes():
    assert screen_sql("SELECT * FROM (SELECT id FROM orders WHERE total > 100)") is None
