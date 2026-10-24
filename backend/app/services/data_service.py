import sqlite3
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from backend.app.database import get_db_connection


def get_default_cutoff_for_date(date_str: str, cutoff_hour: int = 11) -> str:
    """
    Returns the standard Day-Ahead decision cutoff timestamp for a delivery date.
    E.g., for delivery date '2026-01-15', default cutoff is '2026-01-14T11:00:00Z'.
    """
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    d_minus_1 = dt - timedelta(days=1)
    return f"{d_minus_1.strftime('%Y-%m-%d')}T{cutoff_hour:02d}:00:00Z"


def get_matched_day_ahead_data(
    date_str: str,
    cutoff_time: Optional[str] = None,
    resolution: str = "half_hourly"  # "half_hourly" or "hourly"
) -> pd.DataFrame:
    """
    Retrieves the actual wind generation and the latest forecast available prior
    to the decision cutoff time for the given delivery date.
    
    If resolution == 'half_hourly', interpolates WINDFOR hourly points to all 48 settlement periods.
    If resolution == 'hourly', matches the 24 hourly points directly.
    """
    if cutoff_time is None:
        cutoff_time = get_default_cutoff_for_date(date_str)

    with get_db_connection() as conn:
        # 1. Fetch actual generation for this delivery day (all 48 half-hours)
        query_actuals = """
            SELECT 
                start_time,
                settlement_date,
                settlement_period,
                generation as actual_mw
            FROM actual_generation
            WHERE settlement_date = ?
            ORDER BY settlement_period
        """
        df_act = pd.read_sql_query(query_actuals, conn, params=[date_str])

        if df_act.empty:
            return pd.DataFrame()

        # 2. Fetch latest forecast published <= cutoff_time for each target time
        # WINDFOR covers hourly timestamps (e.g. 00:00, 01:00, ... 23:00, plus next day)
        # We fetch up to next day 00:00 so interpolation for period 48 (23:30) is exact
        query_forecasts = """
            WITH RankedForecasts AS (
                SELECT 
                    start_time,
                    publish_time,
                    generation as forecast_mw,
                    ROW_NUMBER() OVER (PARTITION BY start_time ORDER BY publish_time DESC) as rn
                FROM forecasted_generation
                WHERE publish_time <= ?
                  AND start_time >= ?
                  AND start_time <= ?
            )
            SELECT start_time, publish_time, forecast_mw
            FROM RankedForecasts
            WHERE rn = 1
            ORDER BY start_time
        """
        start_bound = f"{date_str}T00:00:00Z"
        # Fetch up to next day 01:00 to interpolate midnight accurately
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        next_day_bound = (dt + timedelta(days=1, hours=2)).strftime("%Y-%m-%dT%H:%M:%SZ")

        df_fc = pd.read_sql_query(query_forecasts, conn, params=[cutoff_time, start_bound, next_day_bound])

    if df_fc.empty:
        # Return actuals without matched forecast
        df_act["forecast_mw"] = None
        df_act["error_mw"] = None
        df_act["abs_error_mw"] = None
        df_act["publish_time"] = None
        return df_act

    # Parse timestamps
    df_act["datetime"] = pd.to_datetime(df_act["start_time"])
    df_fc["datetime"] = pd.to_datetime(df_fc["start_time"])

    if resolution == "hourly":
        # Filter actuals to hourly marks or aggregate half-hours to hourly
        # Let's aggregate actuals to hourly: mean of periods (1,2), (3,4) etc.
        df_act["hour_dt"] = df_act["datetime"].dt.floor("h")
        df_act_hourly = df_act.groupby("hour_dt").agg(
            actual_mw=("actual_mw", "mean"),
            start_time=("start_time", "first"),
            settlement_period=("settlement_period", "first"),
            settlement_date=("settlement_date", "first")
        ).reset_index()

        df_merged = pd.merge(
            df_act_hourly,
            df_fc[["datetime", "publish_time", "forecast_mw"]],
            left_on="hour_dt",
            right_on="datetime",
            how="inner"
        )
        df_merged = df_merged.drop(columns=["datetime"])
        df_merged = df_merged.rename(columns={"hour_dt": "target_datetime"})
    else:
        # Half-hourly resolution: interpolate forecast_mw to 30-minute intervals
        df_act = df_act.sort_values("datetime").reset_index(drop=True)
        # Interpolate forecast against df_act datetime
        # Merge on exact matches first, then interpolate
        df_merged = pd.merge(
            df_act,
            df_fc[["datetime", "publish_time", "forecast_mw"]],
            on="datetime",
            how="left"
        )

        # Forward/backward or linear interpolation for half-hours
        df_merged["forecast_mw"] = df_merged["forecast_mw"].interpolate(method="linear")
        # If any boundary NaN, fill forward/backward
        df_merged["forecast_mw"] = df_merged["forecast_mw"].bfill().ffill()
        df_merged["publish_time"] = df_merged["publish_time"].ffill().bfill()
        df_merged = df_merged.rename(columns={"datetime": "target_datetime"})

    # Compute error metrics per row
    df_merged["error_mw"] = df_merged["forecast_mw"] - df_merged["actual_mw"]
    df_merged["abs_error_mw"] = df_merged["error_mw"].abs()
    # Avoid zero division
    df_merged["pct_error"] = np.where(
        df_merged["actual_mw"] > 0,
        (df_merged["error_mw"] / df_merged["actual_mw"]) * 100,
        0.0
    )
    # Direction: "OVER_FORECAST" (utility was short) vs "UNDER_FORECAST" (utility was long)
    df_merged["imbalance_direction"] = np.where(
        df_merged["error_mw"] > 0, "OVER_FORECAST (Short)", "UNDER_FORECAST (Long)"
    )

    return df_merged
