import React, { useEffect, useState } from 'react';
import { 
  AlertTriangle, 
  ShieldCheck, 
  TrendingUp, 
  Zap, 
  Wind, 
  BarChart2, 
  ArrowRight,
  Flame,
  CheckCircle2
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';

export default function ExecutiveOverview({ onNavigateToDesk, onNavigateToSimulator }) {
  const [overview, setOverview] = useState(null);
  const [dailyLedger, setDailyLedger] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [resOverview, resLedger] = await Promise.all([
          fetch('/api/analytics/overview?cutoff_hour=11'),
          fetch('/api/analytics/daily-ledger?cutoff_hour=11')
        ]);
        const dataOverview = await resOverview.json();
        const dataLedger = await resLedger.json();
        setOverview(dataOverview);
        setDailyLedger(dataLedger);
      } catch (err) {
        console.error('Failed to load overview data', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading || !overview) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
        <div className="brand-icon-box" style={{ margin: '0 auto 16px', animation: 'spin 2s linear infinite' }}>
          <Wind size={24} />
        </div>
        <p style={{ fontSize: '15px' }}>Loading National Grid ESO / Elexon January 2026 Analytics...</p>
      </div>
    );
  }

  // Format month trend data for chart
  const trendChartData = dailyLedger.map((d) => ({
    date: d.date.replace('2026-01-', 'Jan '),
    actual: Math.round(d.avg_actual_mw),
    forecast: Math.round(d.avg_forecast_mw),
    mae: Math.round(d.mae_mw),
    wape: d.wape_pct,
    bias: Math.round(d.mean_error_bias_mw)
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Hero Pitch Banner */}
      <div 
        style={{
          background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(99, 102, 241, 0.08) 50%, rgba(15, 23, 42, 0.9) 100%)',
          border: '1px solid rgba(6, 182, 212, 0.3)',
          borderRadius: 'var(--radius-xl)',
          padding: '32px 36px',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-glow-cyan)'
        }}
      >
        <div style={{ maxWidth: '880px', position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span className="badge badge-cyan">
              <Zap size={12} />
              UK DAY-AHEAD WHOLESALE POWER DESK
            </span>
            <span className="badge badge-emerald">
              <CheckCircle2 size={12} />
              ELEXON BMRS BINDING PROVENANCE
            </span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: '800', color: '#fff', lineHeight: '1.2', margin: '0 0 14px' }}>
            Quantified Renewable Forecasts for Confident Day-Ahead Power Procurement
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.6', margin: '0 0 24px' }}>
            UK Day-Ahead auction decisions must be committed at <strong>11:00 GMT on D-1</strong>, a full 13 to 37 hours before physical delivery. 
            In January 2026, National Grid ESO wind forecasts experienced an average error of <strong>2,107 MW</strong> with a persistent 
            over-forecast bias on <strong>26 of 31 days</strong>. Our platform quantifies forecast error distributions into actionable thermal hedge buffers, 
            eliminating unhedged imbalance penalties.
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button 
              className="btn btn-primary" 
              onClick={onNavigateToDesk}
              id="hero-open-desk-btn"
            >
              <span>Explore Day-Ahead Trading Desk</span>
              <ArrowRight size={16} />
            </button>
            <button 
              className="btn" 
              onClick={onNavigateToSimulator}
              id="hero-open-sim-btn"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              <Sliders size={16} />
              <span>Simulate Procurement & Thermal Hedge</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Total Wind Delivered</span>
            <div className="kpi-icon-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--wind-emerald)' }}>
              <Wind size={18} />
            </div>
          </div>
          <div className="kpi-value">
            {(overview.total_month_actual_mwh / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}
            <span className="kpi-unit">GWh</span>
          </div>
          <div className="kpi-subtext">
            <span>Avg power: ~11,581 MW (Jan 2026)</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Mean Absolute Error (MAE)</span>
            <div className="kpi-icon-badge" style={{ background: 'rgba(6, 182, 212, 0.15)', color: 'var(--forecast-cyan)' }}>
              <BarChart2 size={18} />
            </div>
          </div>
          <div className="kpi-value">
            {overview.overall_mean_mae_mw?.toLocaleString()}
            <span className="kpi-unit">MW</span>
          </div>
          <div className="kpi-subtext">
            <span>RMSE: {overview.overall_mean_rmse_mw?.toLocaleString()} MW</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Month Average WAPE</span>
            <div className="kpi-icon-badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--thermal-amber)' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: 'var(--thermal-amber)' }}>
            {overview.overall_mean_wape_pct}%
          </div>
          <div className="kpi-subtext">
            <span>Weighted Absolute Percentage Error</span>
          </div>
        </div>

        <div className="kpi-card" style={{ borderColor: 'rgba(244, 63, 94, 0.3)' }}>
          <div className="kpi-top">
            <span className="kpi-label">Systemic Forecast Bias</span>
            <div className="kpi-icon-badge" style={{ background: 'rgba(244, 63, 94, 0.15)', color: 'var(--risk-rose)' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: 'var(--risk-rose)' }}>
            +{overview.overall_mean_bias_mw?.toLocaleString()}
            <span className="kpi-unit">MW</span>
          </div>
          <div className="kpi-subtext" style={{ color: 'var(--risk-rose)' }}>
            <span>Over-forecasted on {overview.days_overforecasted} of 31 days</span>
          </div>
        </div>
      </div>

      {/* Critical Commercial Finding Alert */}
      <div 
        style={{
          background: 'rgba(244, 63, 94, 0.08)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          borderRadius: 'var(--radius-lg)',
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div style={{ color: 'var(--risk-rose)', flexShrink: 0 }}>
          <Flame size={28} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: '700', color: '#fff', fontSize: '14px', marginBottom: '3px' }}>
            Commercial Risk Exposure: +1,840 MW Net Day-Ahead Over-Forecast
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Because WINDFOR forecasts consistently exceeded actual outturn generation in January 2026, a utility procurement desk 
            relying solely on unadjusted forecasts would have under-bought thermal power in the Day-Ahead auction, leaving an average shortfall of 
            <strong> ~1,840 MW per hour</strong> to be settled at punitive real-time System Buy cashout prices.
          </div>
        </div>
        <button 
          className="btn" 
          onClick={onNavigateToSimulator}
          style={{ background: 'rgba(244, 63, 94, 0.18)', borderColor: 'rgba(244, 63, 94, 0.4)', color: '#fff', flexShrink: 0 }}
        >
          View Thermal Hedge Solution
        </button>
      </div>

      {/* Month at a Glance Chart */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">
              <TrendingUp size={20} color="var(--forecast-cyan)" />
              <span>January 2026 Daily Profile: Actual vs Day-Ahead Forecast</span>
            </div>
            <div className="card-description">
              Comparing average daily actual wind generation against the latest forecast published prior to Day-Ahead Gate Closure (11:00 UTC D-1)
            </div>
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div className="legend-item">
              <div className="legend-color" style={{ background: 'var(--wind-emerald)' }}></div>
              <span>Actual Wind (MW)</span>
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ background: 'var(--forecast-cyan)' }}></div>
              <span>D-1 11:00 Forecast (MW)</span>
            </div>
          </div>
        </div>

        <div style={{ width: '100%', height: 340 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--wind-emerald)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--wind-emerald)" stopOpacity={0.0}/>
                </linearGradient>
                <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--forecast-cyan)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--forecast-cyan)" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
              <Tooltip 
                contentStyle={{ 
                  background: 'rgba(15, 23, 42, 0.95)', 
                  borderColor: 'var(--border-subtle)', 
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-lg)'
                }} 
                formatter={(val, name) => [`${val.toLocaleString()} MW`, name === 'actual' ? 'Actual Generation' : 'Day-Ahead Forecast']}
              />
              <Area 
                type="monotone" 
                dataKey="actual" 
                stroke="var(--wind-emerald)" 
                strokeWidth={2.5}
                fillOpacity={1} 
                fill="url(#colorActual)" 
                name="actual"
              />
              <Area 
                type="monotone" 
                dataKey="forecast" 
                stroke="var(--forecast-cyan)" 
                strokeWidth={2}
                strokeDasharray="4 4"
                fillOpacity={1} 
                fill="url(#colorForecast)" 
                name="forecast"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Strategic Pillars Table */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        <div className="card">
          <div className="card-title" style={{ fontSize: '15px', marginBottom: '12px' }}>
            <ShieldCheck size={18} color="var(--wind-emerald)" />
            <span>Quantified Error Mitigation</span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            Rather than treating point forecasts as ground truth, our platform calculates empirical error percentiles (P10 to P95) 
            tailored to each settlement period. This allows trading heads to size spinning reserve and thermal commitments to exact risk tolerances.
          </p>
        </div>

        <div className="card">
          <div className="card-title" style={{ fontSize: '15px', marginBottom: '12px' }}>
            <Zap size={18} color="var(--forecast-cyan)" />
            <span>Gate Closure Temporal Sync</span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            The desk views only the latest forecast vintage published strictly prior to auction cutoffs (e.g. 11:00 GMT on D-1), 
            preventing look-ahead bias and guaranteeing that decision simulations reflect genuine market conditions.
          </p>
        </div>

        <div className="card">
          <div className="card-title" style={{ fontSize: '15px', marginBottom: '12px' }}>
            <BarChart2 size={18} color="var(--thermal-amber)" />
            <span>High-Fidelity Settlement Alignment</span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            Smoothly bridges Elexon FUELHH 30-minute settlement periods (1 to 48) with WINDFOR rolling 72-hour hourly forecast curves 
            using standardized piecewise linear interpolation, matching GB market settlement rules.
          </p>
        </div>
      </div>
    </div>
  );
}
