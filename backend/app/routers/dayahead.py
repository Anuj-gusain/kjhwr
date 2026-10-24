from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from backend.app.services.data_service import get_matched_day_ahead_data, get_default_cutoff_for_date
from backend.app.services.analytics_service import calculate_metrics_from_df
from backend.app.services.procurement_service import simulate_day_ahead_procurement

router = APIRouter(prefix="/api/dayahead", tags=["Day-Ahead Trading Desk"])


@router.get("/available-dates")
def get_available_dates():
    """Returns the list of days in January 2026 and standard cutoff configuration."""
    dates = [f"2026-01-{d:02d}" for d in range(1, 32)]
    return {
        "dates": dates,
        "default_date": "2026-01-15",
        "market_gate_closure_gmt": "11:00",
        "time_zone": "UTC / GMT",
    }


@router.get("/matched")
def get_day_ahead_matched_series(
    date: str = Query("2026-01-15", pattern=r"^2026-01-\d{2}$", description="Delivery date (YYYY-MM-DD)"),
    cutoff_time: Optional[str] = Query(None, description="ISO timestamp of decision cutoff, e.g. 2026-01-14T11:00:00Z"),
    resolution: str = Query("half_hourly", pattern=r"^(half_hourly|hourly)$", description="half_hourly (48 SP) or hourly (24 H)"),
):
    """
    Returns actual wind generation and the latest forecast available prior to
    the day-ahead decision cutoff time for the selected delivery date.
    """
    effective_cutoff = cutoff_time or get_default_cutoff_for_date(date)
    df = get_matched_day_ahead_data(date, effective_cutoff, resolution)

    if df.empty:
        raise HTTPException(status_code=404, detail=f"No data available for date {date}")

    step_hours = 0.5 if resolution == "half_hourly" else 1.0
    metrics = calculate_metrics_from_df(df, time_step_hours=step_hours)

    records = df.to_dict(orient="records")
    # Clean datetime fields to string for JSON serialization
    for r in records:
        if "target_datetime" in r and hasattr(r["target_datetime"], "isoformat"):
            r["target_datetime"] = r["target_datetime"].isoformat()

    return {
        "date": date,
        "cutoff_time": effective_cutoff,
        "resolution": resolution,
        "metrics": metrics,
        "series": records,
    }


@router.get("/simulate")
def simulate_procurement(
    date: str = Query("2026-01-15", pattern=r"^2026-01-\d{2}$"),
    cutoff_time: Optional[str] = Query(None),
    confidence_level: float = Query(0.90, ge=0.50, le=0.99),
    utility_scale_factor: float = Query(0.25, ge=0.01, le=1.0),
):
    """
    Simulates utility day-ahead thermal power procurement decisions comparing naive
    vs risk-adjusted procurement using quantified forecast errors.
    """
    effective_cutoff = cutoff_time or get_default_cutoff_for_date(date)
    return simulate_day_ahead_procurement(
        date_str=date,
        cutoff_time=effective_cutoff,
        confidence_level=confidence_level,
        utility_scale_factor=utility_scale_factor,
    )
