FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# demo.duckdb must be baked into the image at this path — read_only=True at runtime
# Ensure data/demo.duckdb exists before building the image

EXPOSE 8000

# CRITICAL: single worker only — multi-worker + DuckDB = database is locked
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
