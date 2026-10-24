import sqlite3
import pandas as pd

conn = sqlite3.connect('backend/data/elexon_wind_jan2026.db')

# 1. Check actuals
df_act = pd.read_sql_query("""
    SELECT start_time, settlement_date, settlement_period, generation as actual_mw 
    FROM actual_generation 
    WHERE settlement_date >= '2026-01-01' AND settlement_date <= '2026-01-31' 
    ORDER BY start_time
""", conn)
print(f"Jan 2026 Actual records: {len(df_act)}")
print(f"Actual MW range: {df_act['actual_mw'].min():.1f} MW to {df_act['actual_mw'].max():.1f} MW, mean: {df_act['actual_mw'].mean():.1f} MW")

# 2. Check forecast coverage
df_fc_summary = pd.read_sql_query("""
    SELECT 
        COUNT(*) as total_rows,
        COUNT(DISTINCT publish_time) as distinct_publishes,
        COUNT(DISTINCT start_time) as distinct_target_times,
        MIN(publish_time) as min_pub,
        MAX(publish_time) as max_pub,
        MIN(start_time) as min_start,
        MAX(start_time) as max_start
    FROM forecasted_generation
""", conn)
print("Forecast summary:")
print(df_fc_summary.to_string())

# 3. Test matching: For each day in Jan 2026, find latest forecast published before D-1 11:00 UTC
# E.g. for delivery day 2026-01-02, cutoff is 2026-01-01T11:00:00Z
sample_target_date = "2026-01-15"
sample_cutoff = "2026-01-14T11:00:00Z"

query_match = f"""
WITH RankedForecasts AS (
    SELECT 
        start_time,
        publish_time,
        generation as forecast_mw,
        ROW_NUMBER() OVER (PARTITION BY start_time ORDER BY publish_time DESC) as rn
    FROM forecasted_generation
    WHERE publish_time <= '{sample_cutoff}'
      AND start_time LIKE '{sample_target_date}%'
)
SELECT 
    rf.start_time,
    rf.publish_time,
    rf.forecast_mw,
    ag.generation as actual_mw,
    (rf.forecast_mw - ag.generation) as error_mw,
    ABS(rf.forecast_mw - ag.generation) as abs_error_mw
FROM RankedForecasts rf
JOIN actual_generation ag ON rf.start_time = ag.start_time
WHERE rf.rn = 1
ORDER BY rf.start_time
"""

df_sample = pd.read_sql_query(query_match, conn)
print(f"\nMatching sample for {sample_target_date} (cutoff {sample_cutoff}):")
print(f"Matched records: {len(df_sample)}")
if len(df_sample) > 0:
    print(df_sample.head(5).to_string())
    mae = df_sample['abs_error_mw'].mean()
    rmse = (df_sample['error_mw']**2).mean()**0.5
    wape = df_sample['abs_error_mw'].sum() / df_sample['actual_mw'].sum() * 100
# Check all January days
results = []
days = [f"2026-01-{d:02d}" for d in range(1, 32)]

for day in days:
    # Day-ahead decision cutoff: Day D-1 at 11:00:00Z
    # For Jan 1, D-1 is 2025-12-31T11:00:00Z
    from datetime import datetime, timedelta
    dt = datetime.strptime(day, "%Y-%m-%d")
    d_minus_1 = (dt - timedelta(days=1)).strftime("%Y-%m-%d")
    cutoff = f"{d_minus_1}T11:00:00Z"

    # Query latest forecast published <= cutoff
    q = f"""
    WITH LatestFC AS (
        SELECT start_time, generation as fc_mw,
               ROW_NUMBER() OVER (PARTITION BY start_time ORDER BY publish_time DESC) as rn
        FROM forecasted_generation
        WHERE publish_time <= '{cutoff}'
          AND start_time >= '{day}T00:00:00Z'
          AND start_time <= '{day}T23:59:59Z'
    )
    SELECT lfc.start_time, lfc.fc_mw, ag.generation as act_mw
    FROM LatestFC lfc
    JOIN actual_generation ag ON lfc.start_time = ag.start_time
    WHERE lfc.rn = 1
    ORDER BY lfc.start_time
    """
    df = pd.read_sql_query(q, conn)
    if len(df) > 0:
        mae = (df['fc_mw'] - df['act_mw']).abs().mean()
        rmse = ((df['fc_mw'] - df['act_mw'])**2).mean()**0.5
        wape = (df['fc_mw'] - df['act_mw']).abs().sum() / df['act_mw'].sum() * 100
        bias = (df['fc_mw'] - df['act_mw']).mean()
        results.append({
            "date": day,
            "cutoff": cutoff,
            "matched_hours": len(df),
            "avg_act_mw": df['act_mw'].mean(),
            "avg_fc_mw": df['fc_mw'].mean(),
            "mae_mw": mae,
            "rmse_mw": rmse,
            "wape_pct": wape,
            "bias_mw": bias
        })

df_res = pd.DataFrame(results)
print(f"Total January days evaluated: {len(df_res)}")
print(df_res.head(10).to_string())
print("\nJanuary 2026 Overall Aggregate Stats:")
print(f"Mean Daily MAE: {df_res['mae_mw'].mean():.1f} MW")
print(f"Mean Daily RMSE: {df_res['rmse_mw'].mean():.1f} MW")
print(f"Mean Daily WAPE: {df_res['wape_pct'].mean():.2f}%")
print(f"Mean Daily Bias: {df_res['bias_mw'].mean():.1f} MW")
print(f"Min WAPE Day: {df_res.loc[df_res['wape_pct'].idxmin()]['date']} ({df_res['wape_pct'].min():.2f}%)")
print(f"Max WAPE Day: {df_res.loc[df_res['wape_pct'].idxmax()]['date']} ({df_res['wape_pct'].max():.2f}%)")

conn.close()
