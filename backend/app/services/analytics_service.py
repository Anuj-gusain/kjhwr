import sqlite3
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from backend.app.database import get_db_connection
from backend.app.services.data_service import get_matched_day_ahead_data, get_default_cutoff_for_date

GB_INSTALLED_WIND_CAPACITY_MW = 29500.0  # Approx UK Grid wind capacity in early 2026 (~29.5 GW)


def calculate_metrics_from_df(df: pd.DataFrame, time_step_hours: float = 0.5) -> Dict[str, Any]:
    """
    Computes rigorous forecast error and accuracy metrics on a dataframe containing
    'actual_mw' and 'forecast_mw'.
    """
    if df.empty or "forecast_mw" not in df.columns or df["forecast_mw"].dropna().empty:
        return {
            "record_count": 0,
            "mae_mw": 0.0,
            "rmse_mw": 0.0,
            "wape_pct": 0.0,
            "mean_error_bias_mw": 0.0,
            "nmae_capacity_pct": 0.0,
            "nrmse_capacity_pct": 0.0,
            "total_actual_mwh": 0.0,
            "total_forecast_mwh": 0.0,
            "correlation_r": 0.0,
            "max_overforecast_mw": 0.0,
            "max_underforecast_mw": 0.0,
        }

    clean_df = df.dropna(subset=["actual_mw", "forecast_mw"]).copy()
    act = clean_df["actual_mw"].to_numpy()
    fc = clean_df["forecast_mw"].to_numpy()
    errors = fc - act
    abs_errors = np.abs(errors)

    mae = float(np.mean(abs_errors))
    rmse = float(np.sqrt(np.mean(errors ** 2)))
    sum_act = float(np.sum(act))
    wape = float((np.sum(abs_errors) / sum_act) * 100) if sum_act > 0 else 0.0
    mean_bias = float(np.mean(errors))

    # Normalized metrics against GB installed wind capacity
    nmae = float((mae / GB_INSTALLED_WIND_CAPACITY_MW) * 100)
    nrmse = float((rmse / GB_INSTALLED_WIND_CAPACITY_MW) * 100)

    # Energy volumes (MWh)
    total_act_mwh = float(np.sum(act) * time_step_hours)
    total_fc_mwh = float(np.sum(fc) * time_step_hours)

    # Pearson correlation
    corr = 0.0
    if len(act) > 1 and np.std(act) > 0 and np.std(fc) > 0:
        corr = float(np.corrcoef(act, fc)[0, 1])

    max_over = float(np.max(errors)) if len(errors) > 0 else 0.0
    max_under = float(np.min(errors)) if len(errors) > 0 else 0.0

    return {
        "record_count": len(clean_df),
        "mae_mw": round(mae, 2),
        "rmse_mw": round(rmse, 2),
        "wape_pct": round(wape, 2),
        "mean_error_bias_mw": round(mean_bias, 2),
        "nmae_capacity_pct": round(nmae, 2),
        "nrmse_capacity_pct": round(nrmse, 2),
        "total_actual_mwh": round(total_act_mwh, 1),
        "total_forecast_mwh": round(total_fc_mwh, 1),
        "correlation_r": round(corr, 3),
        "max_overforecast_mw": round(max_over, 1),
        "max_underforecast_mw": round(max_under, 1),
        "avg_actual_mw": round(float(np.mean(act)), 1),
        "avg_forecast_mw": round(float(np.mean(fc)), 1),
    }


def get_month_daily_summary(cutoff_hour: int = 11, resolution: str = "half_hourly") -> List[Dict[str, Any]]:
    """
    Evaluates every day in January 2026 using the decision cutoff of D-1 at `cutoff_hour`:00 UTC.
    """
    daily_results = []
    step_hours = 0.5 if resolution == "half_hourly" else 1.0

    for day_num in range(1, 32):
        date_str = f"2026-01-{day_num:02d}"
        cutoff_time = get_default_cutoff_for_date(date_str, cutoff_hour)
        df_matched = get_matched_day_ahead_data(date_str, cutoff_time, resolution)

        if not df_matched.empty and "actual_mw" in df_matched.columns and "forecast_mw" in df_matched.columns:
            metrics = calculate_metrics_from_df(df_matched, time_step_hours=step_hours)
            daily_results.append({
                "date": date_str,
                "cutoff_time": cutoff_time,
                **metrics,
                "peak_actual_mw": round(float(df_matched["actual_mw"].max()), 1),
                "peak_forecast_mw": round(float(df_matched["forecast_mw"].max()), 1),
                "min_actual_mw": round(float(df_matched["actual_mw"].min()), 1),
                "min_forecast_mw": round(float(df_matched["forecast_mw"].min()), 1),
            })

    return daily_results


def get_month_overview_kpis(cutoff_hour: int = 11, resolution: str = "half_hourly") -> Dict[str, Any]:
    """
    Computes aggregated KPIs for the entire month of January 2026.
    """
    daily = get_month_daily_summary(cutoff_hour, resolution)
    if not daily:
        return {}

    df_daily = pd.DataFrame(daily)

    best_day = df_daily.loc[df_daily["wape_pct"].idxmin()].to_dict()
    worst_day = df_daily.loc[df_daily["wape_pct"].idxmax()].to_dict()

    return {
        "days_analyzed": len(daily),
        "overall_mean_mae_mw": round(df_daily["mae_mw"].mean(), 2),
        "overall_mean_rmse_mw": round(df_daily["rmse_mw"].mean(), 2),
        "overall_mean_wape_pct": round(df_daily["wape_pct"].mean(), 2),
        "overall_mean_bias_mw": round(df_daily["mean_error_bias_mw"].mean(), 2),
        "total_month_actual_mwh": round(df_daily["total_actual_mwh"].sum(), 1),
        "total_month_forecast_mwh": round(df_daily["total_forecast_mwh"].sum(), 1),
        "avg_daily_actual_mwh": round(df_daily["total_actual_mwh"].mean(), 1),
        "best_accuracy_day": {
            "date": best_day["date"],
            "wape_pct": best_day["wape_pct"],
            "mae_mw": best_day["mae_mw"],
        },
        "worst_accuracy_day": {
            "date": worst_day["date"],
            "wape_pct": worst_day["wape_pct"],
            "mae_mw": worst_day["mae_mw"],
        },
        "days_overforecasted": int((df_daily["mean_error_bias_mw"] > 0).sum()),
        "days_underforecasted": int((df_daily["mean_error_bias_mw"] < 0).sum()),
    }


def get_diurnal_error_profile(cutoff_hour: int = 11) -> List[Dict[str, Any]]:
    """
    Analyzes error statistics across all 48 settlement periods over the entire month.
    Reveals intraday patterns, e.g. morning/evening peak bias vs overnight.
    """
    all_rows = []
    for day_num in range(1, 32):
        date_str = f"2026-01-{day_num:02d}"
        cutoff_time = get_default_cutoff_for_date(date_str, cutoff_hour)
        df = get_matched_day_ahead_data(date_str, cutoff_time, resolution="half_hourly")
        if not df.empty:
            all_rows.append(df)

    if not all_rows:
        return []

    month_df = pd.concat(all_rows, ignore_index=True)
    grouped = month_df.groupby("settlement_period")

    profile = []
    for sp, group in grouped:
        act = group["actual_mw"].to_numpy()
        fc = group["forecast_mw"].to_numpy()
        err = group["error_mw"].to_numpy()
        abs_err = group["abs_error_mw"].to_numpy()

        # Convert settlement period to time label (SP 1 = 00:00 - 00:30)
        h = (sp - 1) // 2
        m = 30 if (sp % 2 == 0) else 0
        time_label = f"{h:02d}:{m:02d}"

        # Is this peak hours in the UK? (7:00 to 19:00 = SP 15 to 38)
        is_peak = 15 <= sp <= 38

        profile.append({
            "settlement_period": int(sp),
            "time_label": time_label,
            "is_peak": is_peak,
            "avg_actual_mw": round(float(np.mean(act)), 1),
            "avg_forecast_mw": round(float(np.mean(fc)), 1),
            "mae_mw": round(float(np.mean(abs_err)), 1),
            "rmse_mw": round(float(np.sqrt(np.mean(err ** 2))), 1),
            "bias_mw": round(float(np.mean(err)), 1),
            "std_error_mw": round(float(np.std(err)), 1),
            "p90_risk_mw": round(float(np.percentile(err, 90)), 1),
            "p10_risk_mw": round(float(np.percentile(err, 10)), 1),
        })

    return profile


def get_error_distribution_and_quantiles(cutoff_hour: int = 11) -> Dict[str, Any]:
    """
    Computes distribution histogram and quantile safety buffers for trading risk management.
    """
    all_rows = []
    for day_num in range(1, 32):
        date_str = f"2026-01-{day_num:02d}"
        cutoff_time = get_default_cutoff_for_date(date_str, cutoff_hour)
        df = get_matched_day_ahead_data(date_str, cutoff_time, resolution="half_hourly")
        if not df.empty:
            all_rows.append(df)

    if not all_rows:
        return {}

    month_df = pd.concat(all_rows, ignore_index=True)
    errors = month_df["error_mw"].dropna().to_numpy()

    # Quantiles
    quantiles = {
        "p01": round(float(np.percentile(errors, 1)), 1),
        "p05": round(float(np.percentile(errors, 5)), 1),
        "p10": round(float(np.percentile(errors, 10)), 1),
        "p25": round(float(np.percentile(errors, 25)), 1),
        "p50_median": round(float(np.percentile(errors, 50)), 1),
        "p75": round(float(np.percentile(errors, 75)), 1),
        "p90": round(float(np.percentile(errors, 90)), 1),
        "p95": round(float(np.percentile(errors, 95)), 1),
        "p99": round(float(np.percentile(errors, 99)), 1),
        "std_dev": round(float(np.std(errors)), 1),
    }

    # Sizing recommended procurement buffer:
    # If the trader wants 90% confidence they won't be short due to wind over-forecast:
    # Buffer = max(0, P90 error)
    quantiles["recommended_p90_buffer_mw"] = max(0.0, quantiles["p90"])
    quantiles["recommended_p95_buffer_mw"] = max(0.0, quantiles["p95"])

    # Histogram (25 bins)
    counts, bin_edges = np.histogram(errors, bins=25)
    histogram = []
    for i in range(len(counts)):
        histogram.append({
            "bin_start_mw": round(float(bin_edges[i]), 1),
            "bin_end_mw": round(float(bin_edges[i + 1]), 1),
            "bin_center_mw": round(float((bin_edges[i] + bin_edges[i + 1]) / 2), 1),
            "count": int(counts[i]),
            "pct": round(float(counts[i] / len(errors) * 100), 2),
        })

    return {
        "total_observations": len(errors),
        "quantiles": quantiles,
        "histogram": histogram,
    }


def get_lead_time_decay_analysis() -> List[Dict[str, Any]]:
    """
    Evaluates forecast accuracy across multiple lead times / forecast horizons.
    Demonstrates the value of latest forecasts vs early day-ahead forecasts.
    """
    # Test on a representative multi-day sample across January
    sample_days = ["2026-01-05", "2026-01-10", "2026-01-15", "2026-01-20", "2026-01-25"]
    
    # Horizons to test (relative to delivery start D 00:00):
    # 1. 48h out (D-2 00:00)
    # 2. 24h out (D-1 00:00)
    # 3. 13h out (D-1 11:00 - Standard Day-Ahead Gate Closure)
    # 4. 7h out (D-1 17:00 - Evening Day-Ahead update)
    # 5. 2h out (D-1 22:00 - Night before delivery)
    horizons = [
        {"name": "48h Pre-Delivery (D-2 00:00)", "hours_before_midnight": 48, "offset_days": 2, "cutoff_hour": 0},
        {"name": "24h Pre-Delivery (D-1 00:00)", "hours_before_midnight": 24, "offset_days": 1, "cutoff_hour": 0},
        {"name": "13h Gate Closure (D-1 11:00)", "hours_before_midnight": 13, "offset_days": 1, "cutoff_hour": 11},
        {"name": "7h Evening Update (D-1 17:00)", "hours_before_midnight": 7, "offset_days": 1, "cutoff_hour": 17},
        {"name": "2h Pre-Day (D-1 22:00)", "hours_before_midnight": 2, "offset_days": 1, "cutoff_hour": 22},
    ]

    decay_results = []
    for h in horizons:
        h_maes = []
        h_wapes = []
        h_rmses = []
        h_biases = []

        for day in sample_days:
            dt = datetime.strptime(day, "%Y-%m-%d")
            cutoff_dt = dt - timedelta(days=h["offset_days"]) + timedelta(hours=h["cutoff_hour"])
            cutoff_str = cutoff_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

            df = get_matched_day_ahead_data(day, cutoff_str, resolution="half_hourly")
            if not df.empty and "actual_mw" in df.columns and "forecast_mw" in df.columns:
                m = calculate_metrics_from_df(df)
                h_maes.append(m["mae_mw"])
                h_wapes.append(m["wape_pct"])
                h_rmses.append(m["rmse_mw"])
                h_biases.append(m["mean_error_bias_mw"])

        if h_maes:
            decay_results.append({
                "horizon_label": h["name"],
                "lead_hours": h["hours_before_midnight"],
                "mean_mae_mw": round(float(np.mean(h_maes)), 1),
                "mean_wape_pct": round(float(np.mean(h_wapes)), 2),
                "mean_rmse_mw": round(float(np.mean(h_rmses)), 1),
                "mean_bias_mw": round(float(np.mean(h_biases)), 1),
            })

    return decay_results
