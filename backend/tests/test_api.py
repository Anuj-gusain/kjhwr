import os
import sys

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_root_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert data["database_connected"] is True

    # Also test root with JSON Accept header
    root_json = client.get("/", headers={"Accept": "application/json"})
    assert root_json.status_code == 200
    assert root_json.json()["status"] == "online"


def test_data_status():
    response = client.get("/api/data/status")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["actual_generation_fuelhh"]["total_records"] > 1400
    assert data["forecasted_generation_windfor"]["total_records"] > 10000


def test_available_dates():
    response = client.get("/api/dayahead/available-dates")
    assert response.status_code == 200
    data = response.json()
    assert len(data["dates"]) == 31
    assert "2026-01-01" in data["dates"]
    assert "2026-01-31" in data["dates"]


def test_matched_day_ahead_series_half_hourly():
    response = client.get("/api/dayahead/matched?date=2026-01-15&resolution=half_hourly")
    assert response.status_code == 200
    data = response.json()
    assert data["date"] == "2026-01-15"
    assert data["resolution"] == "half_hourly"
    assert len(data["series"]) == 48  # 48 half-hour settlement periods
    
    metrics = data["metrics"]
    assert metrics["record_count"] == 48
    assert metrics["mae_mw"] > 0
    assert metrics["rmse_mw"] >= metrics["mae_mw"]
    assert metrics["wape_pct"] > 0
    assert metrics["total_actual_mwh"] > 0


def test_matched_day_ahead_series_hourly():
    response = client.get("/api/dayahead/matched?date=2026-01-15&resolution=hourly")
    assert response.status_code == 200
    data = response.json()
    assert data["resolution"] == "hourly"
    assert len(data["series"]) == 24  # 24 hourly periods


def test_procurement_simulation():
    response = client.get("/api/dayahead/simulate?date=2026-01-15&confidence_level=0.90")
    assert response.status_code == 200
    data = response.json()
    assert data["date"] == "2026-01-15"
    assert len(data["periods"]) == 48
    summary = data["summary"]
    assert "naive_strategy" in summary
    assert "hedged_strategy" in summary
    # Hedged shortfall should be less than or equal to naive shortfall
    assert summary["hedged_strategy"]["unhedged_shortfall_mwh"] <= summary["naive_strategy"]["unhedged_shortfall_mwh"]


def test_analytics_overview():
    response = client.get("/api/analytics/overview")
    assert response.status_code == 200
    data = response.json()
    assert data["days_analyzed"] == 31
    assert data["overall_mean_mae_mw"] > 0
    assert data["overall_mean_wape_pct"] > 0
    assert "best_accuracy_day" in data
    assert "worst_accuracy_day" in data


def test_analytics_daily_ledger():
    response = client.get("/api/analytics/daily-ledger")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 31
    for day in data:
        assert "mae_mw" in day
        assert "wape_pct" in day
        assert "mean_error_bias_mw" in day


def test_diurnal_profile():
    response = client.get("/api/analytics/diurnal")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 48
    # SP 1 to 48
    assert data[0]["settlement_period"] == 1
    assert data[47]["settlement_period"] == 48


def test_distribution_and_quantiles():
    response = client.get("/api/analytics/distribution")
    assert response.status_code == 200
    data = response.json()
    quantiles = data["quantiles"]
    assert quantiles["p10"] <= quantiles["p50_median"] <= quantiles["p90"]
    assert len(data["histogram"]) > 0


def test_lead_time_decay():
    response = client.get("/api/analytics/lead-time-decay")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 3


def test_raw_data_and_csv_export():
    raw_resp = client.get("/api/data/raw?date=2026-01-15&limit=10")
    assert raw_resp.status_code == 200
    raw_data = raw_resp.json()
    assert len(raw_data["records"]) == 10

    csv_resp = client.get("/api/data/export-csv?date_from=2026-01-01&date_to=2026-01-02")
    assert csv_resp.status_code == 200
    assert "text/csv" in csv_resp.headers["content-type"]
    assert "actual_mw" in csv_resp.text
