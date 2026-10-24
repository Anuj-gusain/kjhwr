from fastapi import APIRouter, Query
from backend.app.services.analytics_service import (
    get_month_overview_kpis,
    get_month_daily_summary,
    get_diurnal_error_profile,
    get_error_distribution_and_quantiles,
    get_lead_time_decay_analysis,
)

router = APIRouter(prefix="/api/analytics", tags=["Forecast Accuracy & Error Analytics"])


@router.get("/overview")
def get_overview_kpis(
    cutoff_hour: int = Query(11, ge=0, le=23, description="Decision cutoff hour on D-1 (default 11 for 11:00 UTC)"),
    resolution: str = Query("half_hourly", pattern=r"^(half_hourly|hourly)$"),
):
    """Returns high-level executive KPIs for January 2026."""
    return get_month_overview_kpis(cutoff_hour=cutoff_hour, resolution=resolution)


@router.get("/daily-ledger")
def get_daily_ledger(
    cutoff_hour: int = Query(11, ge=0, le=23),
    resolution: str = Query("half_hourly", pattern=r"^(half_hourly|hourly)$"),
):
    """Returns day-by-day accuracy and error metrics across all 31 days in January 2026."""
    return get_month_daily_summary(cutoff_hour=cutoff_hour, resolution=resolution)


@router.get("/diurnal")
def get_diurnal_profile(
    cutoff_hour: int = Query(11, ge=0, le=23),
):
    """Returns 48 settlement period diurnal profile with peak vs off-peak error breakdown."""
    return get_diurnal_error_profile(cutoff_hour=cutoff_hour)


@router.get("/distribution")
def get_distribution(
    cutoff_hour: int = Query(11, ge=0, le=23),
):
    """Returns error histogram distribution, quantiles (P10..P90), and recommended safety reserve buffers."""
    return get_error_distribution_and_quantiles(cutoff_hour=cutoff_hour)


@router.get("/lead-time-decay")
def get_lead_time_decay():
    """Returns forecast accuracy metrics as a function of lead time / forecast horizon."""
    return get_lead_time_decay_analysis()
