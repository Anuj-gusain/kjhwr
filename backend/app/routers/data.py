import csv
import io
import pandas as pd
from fastapi import APIRouter, Query, Response
from backend.app.database import get_db_connection

router = APIRouter(prefix="/api/data", tags=["Raw Data & Export"])


@router.get("/status")
def get_data_status():
    """Returns database record counts, timestamp boundaries, and system status."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*), MIN(start_time), MAX(start_time) FROM actual_generation")
        act_row = cursor.fetchone()

        cursor.execute("SELECT COUNT(*), COUNT(DISTINCT publish_time), MIN(publish_time), MAX(publish_time) FROM forecasted_generation")
        fc_row = cursor.fetchone()

    return {
        "status": "healthy",
        "database": "SQLite (elexon_wind_jan2026.db)",
        "actual_generation_fuelhh": {
            "total_records": act_row[0],
            "start_time_min": act_row[1],
            "start_time_max": act_row[2],
            "resolution": "Half-Hourly (30 min)",
            "fuel_type": "WIND",
        },
        "forecasted_generation_windfor": {
            "total_records": fc_row[0],
            "distinct_publish_vintages": fc_row[1],
            "publish_time_min": fc_row[2],
            "publish_time_max": fc_row[3],
            "horizon": "Rolling 72 hours",
        },
    }


@router.get("/raw")
def get_raw_actuals(
    date: str = Query("2026-01-15", pattern=r"^2026-01-\d{2}$"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """Returns raw FUELHH actual generation rows for inspection."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, start_time, settlement_date, settlement_period, fuel_type, generation
            FROM actual_generation
            WHERE settlement_date = ?
            ORDER BY settlement_period
            LIMIT ? OFFSET ?
        """, (date, limit, offset))
        rows = [dict(r) for r in cursor.fetchall()]

        cursor.execute("SELECT COUNT(*) FROM actual_generation WHERE settlement_date = ?", (date,))
        total = cursor.fetchone()[0]

    return {
        "date": date,
        "total": total,
        "limit": limit,
        "offset": offset,
        "records": rows,
    }


@router.get("/export-csv")
def export_csv(
    date_from: str = Query("2026-01-01", pattern=r"^2026-01-\d{2}$"),
    date_to: str = Query("2026-01-31", pattern=r"^2026-01-\d{2}$"),
):
    """Exports matched actual vs forecast data as a CSV stream."""
    from backend.app.services.data_service import get_matched_day_ahead_data, get_default_cutoff_for_date

    all_dfs = []
    # Loop through requested dates
    cur = pd.to_datetime(date_from)
    end = pd.to_datetime(date_to)
    while cur <= end:
        d_str = cur.strftime("%Y-%m-%d")
        cutoff = get_default_cutoff_for_date(d_str)
        df = get_matched_day_ahead_data(d_str, cutoff, resolution="half_hourly")
        if not df.empty:
            all_dfs.append(df)
        cur += pd.Timedelta(days=1)

    if not all_dfs:
        return Response(content="No data found", media_type="text/plain")

    combined = pd.concat(all_dfs, ignore_index=True)
    cols = ["settlement_date", "settlement_period", "start_time", "actual_mw", "forecast_mw", "error_mw", "abs_error_mw", "pct_error", "publish_time"]
    existing_cols = [c for c in cols if c in combined.columns]
    
    csv_buffer = io.StringIO()
    combined[existing_cols].to_csv(csv_buffer, index=False)

    return Response(
        content=csv_buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=elexon_wind_analysis_{date_from}_to_{date_to}.csv"}
    )
