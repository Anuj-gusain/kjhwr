"""
Fetch and cache Elexon BMRS data for January 2026:
- FUELHH (actual wind generation)
- WINDFOR (forecasted wind generation)

Stores in SQLite database for high-performance zero-latency local queries,
while preserving full provenance and original timestamps.
"""

import os
import sys
import json
import sqlite3
import urllib.request
import urllib.error
from datetime import datetime, timedelta

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
DB_PATH = os.path.join(DATA_DIR, "elexon_wind_jan2026.db")

BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1"
HEADERS = {"User-Agent": "ElexonWindAnalytics/1.0 (UK Energy Utility Day-Ahead Desk)"}


def init_db(conn: sqlite3.Connection):
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS actual_generation (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_time TEXT NOT NULL,
        publish_time TEXT,
        settlement_date TEXT NOT NULL,
        settlement_period INTEGER NOT NULL,
        fuel_type TEXT NOT NULL,
        generation REAL NOT NULL,
        UNIQUE(start_time, fuel_type)
    )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_actual_start ON actual_generation(start_time)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_actual_date ON actual_generation(settlement_date)")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS forecasted_generation (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        publish_time TEXT NOT NULL,
        start_time TEXT NOT NULL,
        generation REAL NOT NULL,
        UNIQUE(publish_time, start_time)
    )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_forecast_start ON forecasted_generation(start_time)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_forecast_publish ON forecasted_generation(publish_time)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_forecast_pub_start ON forecasted_generation(publish_time, start_time)")
    conn.commit()


def fetch_url_json(url: str, retries: int = 3):
    req = urllib.request.Request(url, headers=HEADERS)
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = resp.read().decode("utf-8")
                return json.loads(data)
        except Exception as e:
            print(f"  [Attempt {attempt+1}/{retries}] Error fetching {url}: {e}")
            if attempt == retries - 1:
                raise
            import time
            time.sleep(2)


def fetch_and_store_actuals(conn: sqlite3.Connection, start_date: str = "2025-12-31", end_date: str = "2026-02-01"):
    print(f"\n--- Fetching Actual Generation (FUELHH, WIND) from {start_date} to {end_date} ---")
    url = f"{BASE_URL}/datasets/FUELHH/stream?settlementDateFrom={start_date}&settlementDateTo={end_date}"
    print(f"Requesting: {url}")
    records = fetch_url_json(url)
    print(f"Received {len(records)} total FUELHH records. Filtering WIND...")

    wind_records = [
        (
            r.get("startTime"),
            r.get("publishTime"),
            r.get("settlementDate"),
            r.get("settlementPeriod"),
            r.get("fuelType"),
            float(r.get("generation", 0))
        )
        for r in records
        if r.get("fuelType") == "WIND" and r.get("startTime") is not None
    ]

    print(f"Extracted {len(wind_records)} WIND records. Inserting into database...")
    cursor = conn.cursor()
    cursor.executemany("""
    INSERT OR REPLACE INTO actual_generation
    (start_time, publish_time, settlement_date, settlement_period, fuel_type, generation)
    VALUES (?, ?, ?, ?, ?, ?)
    """, wind_records)
    conn.commit()
    print(f"Successfully saved {len(wind_records)} actual wind records.")


def fetch_and_store_forecasts(conn: sqlite3.Connection):
    print("\n--- Fetching Forecast Generation (WINDFOR) in chunks ---")
    # National Grid ESO / Elexon WINDFOR forecasts published from Dec 30, 2025 to Feb 1, 2026
    start = datetime(2025, 12, 30, 0, 0, 0)
    end = datetime(2026, 2, 2, 0, 0, 0)
    chunk_days = 4

    current = start
    total_saved = 0

    while current < end:
        chunk_end = min(current + timedelta(days=chunk_days), end)
        from_str = current.strftime("%Y-%m-%dT%H:%M:%SZ")
        to_str = chunk_end.strftime("%Y-%m-%dT%H:%M:%SZ")
        url = f"{BASE_URL}/datasets/WINDFOR/stream?publishDateTimeFrom={from_str}&publishDateTimeTo={to_str}"
        print(f"Fetching WINDFOR: {from_str} -> {to_str} ...")

        try:
            records = fetch_url_json(url)
            print(f"  Got {len(records)} forecast records.")
            if records:
                rows = [
                    (
                        r.get("publishTime"),
                        r.get("startTime"),
                        float(r.get("generation", 0))
                    )
                    for r in records
                    if r.get("publishTime") and r.get("startTime")
                ]
                cursor = conn.cursor()
                cursor.executemany("""
                INSERT OR REPLACE INTO forecasted_generation (publish_time, start_time, generation)
                VALUES (?, ?, ?)
                """, rows)
                conn.commit()
                total_saved += len(rows)
        except Exception as e:
            print(f"  Error on chunk {from_str} to {to_str}: {e}")

        current = chunk_end

    print(f"\nTotal WINDFOR records saved: {total_saved}")


def verify_database(conn: sqlite3.Connection):
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*), MIN(start_time), MAX(start_time), AVG(generation), MIN(generation), MAX(generation) FROM actual_generation")
    act_count, act_min, act_max, act_avg, act_low, act_high = cursor.fetchone()
    print("\n=== VERIFICATION REPORT: ACTUAL GENERATION ===")
    print(f"Total Half-Hour Records: {act_count}")
    print(f"Time Range: {act_min} -> {act_max}")
    print(f"Wind Generation Stats: Min {act_low:.1f} MW | Avg {act_avg:.1f} MW | Max {act_high:.1f} MW")

    cursor.execute("SELECT COUNT(*), COUNT(DISTINCT publish_time), MIN(publish_time), MAX(publish_time) FROM forecasted_generation")
    fc_count, fc_pub_count, fc_min, fc_max = cursor.fetchone()
    print("\n=== VERIFICATION REPORT: FORECAST GENERATION ===")
    print(f"Total Forecast Points: {fc_count}")
    print(f"Distinct Forecast Issues (vintages): {fc_pub_count}")
    print(f"Publish Time Range: {fc_min} -> {fc_max}")


if __name__ == "__main__":
    os.makedirs(DATA_DIR, exist_ok=True)
    print(f"Database location: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    try:
        init_db(conn)
        fetch_and_store_actuals(conn)
        fetch_and_store_forecasts(conn)
        verify_database(conn)
    finally:
        conn.close()
    print("\n[SUCCESS] Elexon January 2026 database ready.")
