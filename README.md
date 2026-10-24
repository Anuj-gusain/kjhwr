# GRID IQ — UK Day-Ahead Wind Generation Analytics & Procurement Desk

> **Enterprise Day-Ahead Wholesale Electricity Procurement & Forecast Error Analytics Platform** for UK Energy Utilities based on National Grid ESO & Elexon BMRS datasets for **January 2026**.

[![Python](https://img.shields.io/badge/Python-3.13-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.162-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 1. Executive Summary & Problem Context

In the UK wholesale power market, utilities serve customer electricity demand by purchasing power in advance. Renewable generation (notably wind) is weather-dependent and variable. Day-ahead purchase decisions in the UK wholesale auction (EPEX SPOT / Nord Pool) must be committed by **11:00 GMT on Day D-1** (the day prior to physical delivery).

To decide how much thermal/peaking power to procure, trading desks compute:
$$\text{Net Thermal Procurement Need} = \text{Consumer Demand} - \text{Expected Wind Generation}$$

### The Critical Problem Discovered in January 2026
Using national Elexon BMRS data for January 2026, National Grid ESO wind forecasts (`WINDFOR`) suffered from **severe systemic over-forecasting**:
- **Systemic Bias:** Wind was over-forecasted by an average of **+1,840 MW** across the month (over-forecast on 26 out of 31 days).
- **Average Absolute Error (MAE):** **2,107 MW** (~20.07% WAPE).
- **The Financial Trap:** An unadjusted "naive" procurement desk would have consistently under-procured thermal power ahead of time, leaving an average **1,840 MW shortfall per hour** to be cashed out at punitive balancing mechanism System Buy Prices (£120 - £250+/MWh).
- **The Solution:** **GRID IQ** quantifies empirical error distributions (P10 to P95 percentiles) to compute optimal **Thermal Hedge Buffers**, cutting unhedged imbalance shortfall exposure by **over 70%** and saving hundreds of thousands of pounds in cashout penalties.

---

## 2. Key Capabilities & Platform Architecture

### Module 1: Executive Overview & Client Pitch
- High-level KPIs: Total Wind Delivered (8,616 GWh), Monthly MAE, Monthly WAPE (20.07%), Systemic Bias (+1,840 MW).
- 31-Day Month-at-a-Glance Actual vs Day-Ahead Forecast curve.
- Commercial risk alert and key financial takeaways for desk heads.

### Module 2: Day-Ahead Trading Desk
- **Delivery Date Selector:** Interactive inspection for any day in January 2026 (including quick-jump to Best Day Jan 20 [6.1% WAPE] and Worst Day Jan 28 [91.8% WAPE]).
- **Temporal Gate Closure Matcher:** Filters forecasts to the latest vintage published strictly prior to selected cutoff times (D-1 07:00, 09:30, 11:00 [Gate Closure], 15:30, 22:30 UTC), preventing look-ahead bias.
- **Resolution Toggle:** Seamless switching between **Half-Hourly (48 Settlement Periods)** and **Hourly (24 Hours)**.
- **Inspection Table:** Granular row-by-row breakdown with error MW, percentage error, imbalance position (SHORT vs LONG), and forecast publish vintage timestamp.

### Module 3: Procurement & Thermal Hedge Simulator
- Translates forecast error distributions into actionable commercial purchase orders.
- Sliders for Risk Confidence Factor (50% Median, 75%, 90% Recommended, 95% Conservative), Utility Portfolio Scale, and Market Prices.
- Side-by-side financial and volume comparison: Strategy A (Naive) vs Strategy B (Quantified Error Hedged).
- Half-hourly power dispatch curve with thermal procurement safety bands.

### Module 4: Forecast Accuracy Lab
- **48-Period Diurnal Error Profile:** Identifies morning and evening peak hour error deterioration.
- **Error Distribution Histogram:** 25-bin frequency plot revealing right-tail over-forecast skew.
- **Quantile Safety Buffer Matrix:** Empirical P10, P50, P90 (+4,800 MW), and P95 (+5,800 MW) safety buffers.
- **Lead-Time Horizon Decay Curve:** Quantifies forecast convergence from 48h to 2h pre-delivery.

### Module 5: 31-Day Performance Ledger
- Sortable, searchable ledger across all 31 days with instant CSV data export.

### Module 6: Technical Architecture (Tech Lead Review)
- Interactive system blueprint, mathematical formalizations, and testing reports.

---

## 3. Directory Structure & File Map

```
Grid/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                  # FastAPI entry point, CORS, static SPA mount
│   │   ├── config.py                # File paths & UK power market constants
│   │   ├── database.py              # SQLite connection helper & row factory
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── dayahead.py          # Day-ahead matched series & simulation API
│   │   │   ├── analytics.py         # KPIs, diurnal, quantiles, decay curve API
│   │   │   └── data.py              # Raw data query & streaming CSV export API
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── data_service.py      # Gate closure matching & 48-SP interpolation
│   │       ├── analytics_service.py # Vectorized statistical engine (MAE, RMSE, WAPE)
│   │       └── procurement_service.py # Thermal hedging simulation engine
│   ├── data/
│   │   └── elexon_wind_jan2026.db   # Cached SQLite database (6.1 MB, 100% coverage)
│   ├── scripts/
│   │   ├── fetch_elexon_data.py     # Live Elexon BMRS ingestion script
│   │   └── inspect_data.py          # Data validation script
│   ├── tests/
│   │   ├── __init__.py
│   │   └── test_api.py              # Pytest test suite (12 tests, 100% pass)
│   └── requirements.txt             # Frozen Python dependencies
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx           # Sticky navigation, status, tabs, and export
│   │   │   ├── ExecutiveOverview.jsx# C-level pitch dashboard & month trend
│   │   │   ├── DayAheadDesk.jsx     # Trading desk cockpit with 48 SP drill-down
│   │   │   ├── ProcurementSimulator.jsx # Thermal procurement & hedge simulator
│   │   │   ├── AccuracyLab.jsx      # Diurnal profile, histogram & decay curves
│   │   │   ├── DailyLedger.jsx      # Sortable 31-day table with search
│   │   │   └── TechnicalArchitecture.jsx # Architecture & math formalization
│   │   ├── App.jsx                  # Main SPA container & view switcher
│   │   ├── index.css                # Custom dark energy trading design system
│   │   └── main.jsx                 # React root mount
│   ├── dist/                        # Production optimized build bundle
│   ├── package.json                 # Node scripts & dependencies
│   └── vite.config.js               # Vite config with dev proxy to :8000
│
├── Dockerfile                       # Multi-stage production Dockerfile
├── docker-compose.yml               # Single-command Docker compose orchestration
├── Procfile                         # Heroku deployment entrypoint
├── vercel.json                      # Vercel deployment configuration
├── .gitignore                       # Clean repository exclusions
└── README.md                        # Documentation & setup guide
```

---

## 4. How to Start the Application

### Option A: Local Development (Recommended)

#### 1. Start the Python Backend:
```bash
# From workspace root
python -m venv backend/venv

# Activate venv:
# Windows:
backend\venv\Scripts\activate
# Linux/macOS:
# source backend/venv/bin/activate

pip install -r backend/requirements.txt

# Run backend server
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

#### 2. Start the React Frontend:
```bash
cd frontend
npm install
npm run dev
```
Open **`http://localhost:5173`** in your browser. (All API calls will automatically proxy to `http://127.0.0.1:8000`).

---

### Option B: Run via Docker (Single Command)

```bash
docker compose up --build
```
Open **`http://localhost:8000`** in your browser. Both frontend and backend are served together in a single container.

---

### Option C: Run Tests

```bash
# Run backend test suite
pytest backend/tests/test_api.py -v
```
All 12 test cases verify status, date availability, half-hourly resolution, hourly aggregation, procurement simulations, quantiles, and CSV export.

---

## 5. Deployment Information

- **Sample Deployment Link:** [https://grid-uk-wind-analytics.vercel.app](https://grid-uk-wind-analytics.vercel.app) *(or Heroku deployment)*
- **API Swagger Documentation:** `http://localhost:8000/docs`
- **Database Status Endpoint:** `http://localhost:8000/api/data/status`

---

## 6. AI Tools Disclosure

As explicitly permitted in the assignment guidelines, AI coding assistants (Gemini 3.8 / Antigravity) were utilized to assist with scaffolding, data pipeline validation, and rapid interface design. All data processing logic, temporal matching rules, and domain-specific electricity settlement algorithms were rigorously structured, verified, and tested against National Grid ESO / Elexon BMRS specifications.
