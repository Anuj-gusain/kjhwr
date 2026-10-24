import numpy as np
import pandas as pd
from typing import Dict, List, Any
from backend.app.services.data_service import get_matched_day_ahead_data, get_default_cutoff_for_date

# Standard winter daily electricity demand curve in the UK (scaled to a medium/large utility with ~4,000 - 6,000 MW customer base)
# Indexed by Settlement Period 1 to 48 (SP 1 = 00:00, SP 48 = 23:30)
BASE_UTILITY_DEMAND_PROFILE_MW = {
    1: 3400, 2: 3300, 3: 3200, 4: 3100, 5: 3050, 6: 3000, 7: 3000, 8: 3050,
    9: 3150, 10: 3300, 11: 3600, 12: 4000, 13: 4500, 14: 5100, 15: 5500, 16: 5700,
    17: 5750, 18: 5700, 19: 5600, 20: 5500, 21: 5400, 22: 5350, 23: 5300, 24: 5300,
    25: 5300, 26: 5350, 27: 5400, 28: 5500, 29: 5650, 30: 5800, 31: 6000, 32: 6200,
    33: 6500, 34: 6700, 35: 6800, 36: 6750, 37: 6600, 38: 6300, 39: 5900, 40: 5500,
    41: 5100, 42: 4800, 43: 4500, 44: 4200, 45: 3950, 46: 3750, 47: 3600, 48: 3450,
}


def simulate_day_ahead_procurement(
    date_str: str,
    cutoff_time: str,
    confidence_level: float = 0.90,  # 0.50, 0.75, 0.85, 0.90, 0.95
    utility_scale_factor: float = 0.25, # Assumes utility serves ~25% of national load/wind share
    assumed_cashout_penalty_gbp_per_mwh: float = 120.0, # Average winter peak cashout price
    assumed_thermal_dayahead_price_gbp_per_mwh: float = 75.0, # Day-ahead thermal contract price
) -> Dict[str, Any]:
    """
    Simulates day-ahead procurement decisions with and without quantified forecast error hedging.
    """
    df = get_matched_day_ahead_data(date_str, cutoff_time, resolution="half_hourly")
    if df.empty or "forecast_mw" not in df.columns:
        return {"error": f"No data found for date {date_str} and cutoff {cutoff_time}"}

    # Extract wind and demand
    results_periods = []
    
    total_demand_mwh = 0.0
    total_actual_wind_mwh = 0.0
    total_forecast_wind_mwh = 0.0

    # Naive Strategy (Basing thermal procurement strictly on raw wind forecast)
    naive_thermal_procured_mwh = 0.0
    naive_shortfall_mwh = 0.0
    naive_surplus_mwh = 0.0

    # Risk-Adjusted Strategy (Using quantified forecast error buffer)
    hedged_thermal_procured_mwh = 0.0
    hedged_shortfall_mwh = 0.0
    hedged_surplus_mwh = 0.0

    # Buffer multiplier based on Gaussian / empirical standard deviation
    # 50% = 0.0 * sigma, 75% = 0.67 * sigma, 90% = 1.28 * sigma, 95% = 1.65 * sigma
    z_scores = {0.50: 0.0, 0.75: 0.674, 0.85: 1.036, 0.90: 1.282, 0.95: 1.645}
    z = z_scores.get(round(confidence_level, 2), 1.282)

    # Historical forecast uncertainty in Jan 2026: std_dev ~ 1500 MW nationally
    base_sigma_mw = 1500.0 * utility_scale_factor

    for _, row in df.iterrows():
        sp = int(row.get("settlement_period", 1))
        time_label = f"{(sp-1)//2:02d}:{30 if sp%2==0 else 0:02d}"
        
        # Utility portfolio wind and demand
        demand_mw = BASE_UTILITY_DEMAND_PROFILE_MW.get(sp, 5000.0)
        fc_wind_mw = float(row["forecast_mw"]) * utility_scale_factor
        act_wind_mw = float(row["actual_mw"]) * utility_scale_factor

        # Safety reserve buffer (MW) to protect against over-forecast
        safety_buffer_mw = z * (base_sigma_mw * (0.8 + 0.4 * (fc_wind_mw / 3500.0)))
        # Derated wind for procurement
        derated_wind_mw = max(0.0, fc_wind_mw - safety_buffer_mw)

        # Naive procurement: cover remaining demand assuming wind forecast is 100% accurate
        naive_thermal_mw = max(0.0, demand_mw - fc_wind_mw)

        # Hedged procurement: cover remaining demand assuming wind might underperform
        hedged_thermal_mw = max(0.0, demand_mw - derated_wind_mw)

        # Real-time physical delivery outcome:
        # Physical generation = actual wind + thermal procured
        # Net imbalance = physical generation - demand
        # Negative imbalance = SHORT (must pay cashout penalty!)
        # Positive imbalance = LONG (spill or sell into balancing market)

        naive_net_imbalance_mw = (naive_thermal_mw + act_wind_mw) - demand_mw
        hedged_net_imbalance_mw = (hedged_thermal_mw + act_wind_mw) - demand_mw

        # Energy for 0.5 hour
        half_hour = 0.5
        total_demand_mwh += demand_mw * half_hour
        total_actual_wind_mwh += act_wind_mw * half_hour
        total_forecast_wind_mwh += fc_wind_mw * half_hour

        naive_thermal_procured_mwh += naive_thermal_mw * half_hour
        hedged_thermal_procured_mwh += hedged_thermal_mw * half_hour

        if naive_net_imbalance_mw < 0:
            naive_shortfall_mwh += abs(naive_net_imbalance_mw) * half_hour
        else:
            naive_surplus_mwh += naive_net_imbalance_mw * half_hour

        if hedged_net_imbalance_mw < 0:
            hedged_shortfall_mwh += abs(hedged_net_imbalance_mw) * half_hour
        else:
            hedged_surplus_mwh += hedged_net_imbalance_mw * half_hour

        results_periods.append({
            "settlement_period": sp,
            "time_label": time_label,
            "demand_mw": round(demand_mw, 1),
            "forecast_wind_mw": round(fc_wind_mw, 1),
            "actual_wind_mw": round(act_wind_mw, 1),
            "safety_buffer_mw": round(safety_buffer_mw, 1),
            "derated_wind_mw": round(derated_wind_mw, 1),
            "naive_thermal_procure_mw": round(naive_thermal_mw, 1),
            "hedged_thermal_procure_mw": round(hedged_thermal_mw, 1),
            "naive_imbalance_mw": round(naive_net_imbalance_mw, 1),
            "hedged_imbalance_mw": round(hedged_net_imbalance_mw, 1),
        })

    # Financial Exposure Estimates
    naive_thermal_cost = naive_thermal_procured_mwh * assumed_thermal_dayahead_price_gbp_per_mwh
    naive_imbalance_penalty = naive_shortfall_mwh * assumed_cashout_penalty_gbp_per_mwh
    naive_total_cost = naive_thermal_cost + naive_imbalance_penalty

    hedged_thermal_cost = hedged_thermal_procured_mwh * assumed_thermal_dayahead_price_gbp_per_mwh
    hedged_imbalance_penalty = hedged_shortfall_mwh * assumed_cashout_penalty_gbp_per_mwh
    hedged_total_cost = hedged_thermal_cost + hedged_imbalance_penalty

    net_risk_reduction_pct = (
        ((naive_shortfall_mwh - hedged_shortfall_mwh) / naive_shortfall_mwh * 100)
        if naive_shortfall_mwh > 0 else 100.0
    )

    return {
        "date": date_str,
        "cutoff_time": cutoff_time,
        "confidence_level": confidence_level,
        "summary": {
            "total_demand_mwh": round(total_demand_mwh, 1),
            "total_actual_wind_mwh": round(total_actual_wind_mwh, 1),
            "total_forecast_wind_mwh": round(total_forecast_wind_mwh, 1),
            "wind_forecast_error_mwh": round(total_forecast_wind_mwh - total_actual_wind_mwh, 1),
            "naive_strategy": {
                "thermal_procured_mwh": round(naive_thermal_procured_mwh, 1),
                "unhedged_shortfall_mwh": round(naive_shortfall_mwh, 1),
                "surplus_spill_mwh": round(naive_surplus_mwh, 1),
                "thermal_cost_gbp": round(naive_thermal_cost, 2),
                "imbalance_penalty_gbp": round(naive_imbalance_penalty, 2),
                "total_procurement_cost_gbp": round(naive_total_cost, 2),
            },
            "hedged_strategy": {
                "thermal_procured_mwh": round(hedged_thermal_procured_mwh, 1),
                "unhedged_shortfall_mwh": round(hedged_shortfall_mwh, 1),
                "surplus_spill_mwh": round(hedged_surplus_mwh, 1),
                "thermal_cost_gbp": round(hedged_thermal_cost, 2),
                "imbalance_penalty_gbp": round(hedged_imbalance_penalty, 2),
                "total_procurement_cost_gbp": round(hedged_total_cost, 2),
            },
            "net_shortfall_reduction_pct": round(net_risk_reduction_pct, 1),
            "net_financial_hedge_delta_gbp": round(naive_total_cost - hedged_total_cost, 2),
        },
        "periods": results_periods,
    }
