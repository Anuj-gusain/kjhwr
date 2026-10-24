import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  Wind, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  Layers, 
  Download,
  Info
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend, 
  ReferenceLine 
} from 'recharts';

export default function DayAheadDesk() {
  const [selectedDate, setSelectedDate] = useState('2026-01-15');
  const [cutoffHour, setCutoffHour] = useState('11'); // 07, 09, 11, 15, 22
  const [resolution, setResolution] = useState('half_hourly'); // half_hourly or hourly
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Available dates in Jan 2026
  const dates = Array.from({ length: 31 }, (_, i) => `2026-01-${String(i + 1).padStart(2, '0')}`);

  useEffect(() => {
    async function fetchSeries() {
      setLoading(true);
      setError(null);
      try {
        // Compute D-1 date for cutoff string
        const dt = new Date(selectedDate);
        dt.setDate(dt.getDate() - 1);
        const dMinus1Str = dt.toISOString().split('T')[0];
        const cutoffTime = `${dMinus1Str}T${cutoffHour.padStart(2, '0')}:00:00Z`;

        const url = `/api/dayahead/matched?date=${selectedDate}&cutoff_time=${cutoffTime}&resolution=${resolution}`;
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Failed to fetch day-ahead data: ${res.statusText}`);
        }
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchSeries();
  }, [selectedDate, cutoffHour, resolution]);

  // Format chart series
  const chartData = data?.series?.map((r) => {
    const timeLabel = r.settlement_period 
      ? `${String(Math.floor((r.settlement_period - 1) / 2)).padStart(2, '0')}:${r.settlement_period % 2 === 0 ? '30' : '00'}`
      : r.start_time?.slice(11, 16);

    const actual = Math.round(r.actual_mw);
    const forecast = Math.round(r.forecast_mw);
    const error = Math.round(r.error_mw);

    return {
      time: timeLabel,
      period: r.settlement_period,
      actual,
      forecast,
      error,
      // Positive error means forecast > actual (Shortfall risk)
      shortfall: error > 0 ? error : 0,
      surplus: error < 0 ? Math.abs(error) : 0,
      publishTime: r.publish_time,
    };
  }) || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Controls Bar */}
      <div className="controls-bar">
        <div className="control-group">
          <div>
            <div className="control-label" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
              <Calendar size={13} color="var(--forecast-cyan)" />
              <span>Target Delivery Date</span>
            </div>
            <select 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              id="select-delivery-date"
              style={{ fontWeight: '600' }}
            >
              {dates.map((d) => (
                <option key={d} value={d}>
                  {d} {d === '2026-01-20' ? '★ (Best 6.1%)' : d === '2026-01-28' ? '⚠ (Worst 91.8%)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="control-label" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
              <Clock size={13} color="var(--thermal-amber)" />
              <span>D-1 Gate Closure Cutoff</span>
            </div>
            <select 
              value={cutoffHour} 
              onChange={(e) => setCutoffHour(e.target.value)}
              id="select-cutoff-hour"
            >
              <option value="07">07:00 UTC (Early Morning)</option>
              <option value="09">09:30 UTC (Pre-Gate Vintage)</option>
              <option value="11">11:00 UTC (UK EPEX Gate Closure - Default)</option>
              <option value="15">15:30 UTC (Afternoon Re-run)</option>
              <option value="22">22:30 UTC (Intraday Final)</option>
            </select>
          </div>

          <div>
            <div className="control-label" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
              <Layers size={13} color="var(--wind-emerald)" />
              <span>Market Resolution</span>
            </div>
            <div className="pill-group">
              <button
                className={`pill-btn ${resolution === 'half_hourly' ? 'active' : ''}`}
                onClick={() => setResolution('half_hourly')}
                id="res-half-hourly-btn"
              >
                Half-Hourly (48 SP)
              </button>
              <button
                className={`pill-btn ${resolution === 'hourly' ? 'active' : ''}`}
                onClick={() => setResolution('hourly')}
                id="res-hourly-btn"
              >
                Hourly (24 H)
              </button>
            </div>
          </div>
        </div>

        {/* Quick Jump Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Quick Jump:</span>
          <button 
            className="btn" 
            style={{ padding: '4px 10px', fontSize: '11px' }}
            onClick={() => setSelectedDate('2026-01-20')}
          >
            Best Day (Jan 20)
          </button>
          <button 
            className="btn" 
            style={{ padding: '4px 10px', fontSize: '11px', borderColor: 'rgba(244, 63, 94, 0.4)', color: 'var(--risk-rose)' }}
            onClick={() => setSelectedDate('2026-01-28')}
          >
            Severe Miss (Jan 28)
          </button>
          <button 
            className="btn" 
            style={{ padding: '4px 10px', fontSize: '11px' }}
            onClick={() => setSelectedDate('2026-01-15')}
          >
            Mid-Month (Jan 15)
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div className="brand-icon-box" style={{ margin: '0 auto 12px' }}>
            <Wind size={20} />
          </div>
          <span>Retrieving day-ahead matched curves from Elexon database...</span>
        </div>
      )}

      {error && (
        <div style={{ padding: '20px', background: 'rgba(244,63,94,0.1)', border: '1px solid var(--risk-rose)', borderRadius: 'var(--radius-md)', color: '#fff' }}>
          Error: {error}
        </div>
      )}

      {data && !loading && (
        <>
          {/* Day Scorecard KPIs */}
          <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <div className="kpi-card">
              <div className="kpi-top">
                <span className="kpi-label">Day MAE</span>
                <span className="badge badge-cyan">{data.metrics.nmae_capacity_pct}% Cap</span>
              </div>
              <div className="kpi-value">
                {data.metrics.mae_mw?.toLocaleString()}
                <span className="kpi-unit">MW</span>
              </div>
              <div className="kpi-subtext">RMSE: {data.metrics.rmse_mw?.toLocaleString()} MW</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-top">
                <span className="kpi-label">Day WAPE</span>
                <span className={`badge ${data.metrics.wape_pct < 15 ? 'badge-emerald' : data.metrics.wape_pct < 30 ? 'badge-amber' : 'badge-rose'}`}>
                  {data.metrics.wape_pct < 15 ? 'High Accuracy' : data.metrics.wape_pct < 30 ? 'Moderate' : 'High Risk'}
                </span>
              </div>
              <div className="kpi-value" style={{ color: data.metrics.wape_pct < 15 ? 'var(--wind-emerald)' : data.metrics.wape_pct < 30 ? 'var(--thermal-amber)' : 'var(--risk-rose)' }}>
                {data.metrics.wape_pct}%
              </div>
              <div className="kpi-subtext">Weighted % Error</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-top">
                <span className="kpi-label">Net Bias</span>
                <span className={`badge ${data.metrics.mean_error_bias_mw > 0 ? 'badge-rose' : 'badge-emerald'}`}>
                  {data.metrics.mean_error_bias_mw > 0 ? 'Shortfall Risk' : 'Surplus Long'}
                </span>
              </div>
              <div className="kpi-value" style={{ color: data.metrics.mean_error_bias_mw > 0 ? 'var(--risk-rose)' : 'var(--wind-emerald)' }}>
                {data.metrics.mean_error_bias_mw > 0 ? `+${data.metrics.mean_error_bias_mw}` : data.metrics.mean_error_bias_mw}
                <span className="kpi-unit">MW</span>
              </div>
              <div className="kpi-subtext">Mean (Forecast - Actual)</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-top">
                <span className="kpi-label">Peak Generation</span>
                <span className="badge badge-emerald">Max Outturn</span>
              </div>
              <div className="kpi-value">
                {Math.round(Math.max(...data.series.map(s => s.actual_mw)))?.toLocaleString()}
                <span className="kpi-unit">MW</span>
              </div>
              <div className="kpi-subtext">Forecast Peak: {Math.round(Math.max(...data.series.map(s => s.forecast_mw)))?.toLocaleString()} MW</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-top">
                <span className="kpi-label">Total Day Energy</span>
                <span className="badge badge-cyan">MWh</span>
              </div>
              <div className="kpi-value">
                {(data.metrics.total_actual_mwh / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                <span className="kpi-unit">GWh</span>
              </div>
              <div className="kpi-subtext">Correlation r = {data.metrics.correlation_r}</div>
            </div>
          </div>

          {/* Interactive Time Series Chart */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">
                  <Wind size={20} color="var(--wind-emerald)" />
                  <span>Delivery Day Profile: {selectedDate}</span>
                </div>
                <div className="card-description">
                  Actual wind generation vs latest WINDFOR forecast published prior to cutoff ({data.cutoff_time})
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div className="legend-item">
                  <div className="legend-color" style={{ background: 'var(--wind-emerald)' }}></div>
                  <span>Actual (FUELHH)</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color" style={{ background: 'var(--forecast-cyan)' }}></div>
                  <span>Day-Ahead Forecast (WINDFOR)</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color" style={{ background: 'rgba(244, 63, 94, 0.5)' }}></div>
                  <span>Over-Forecast Shortfall</span>
                </div>
              </div>
            </div>

            <div style={{ width: '100%', height: 420 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 15, right: 15, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorActualDay" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--wind-emerald)" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="var(--wind-emerald)" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="colorShortfall" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--risk-rose)" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="var(--risk-rose)" stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={11} interval={resolution === 'half_hourly' ? 3 : 1} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={(v) => `${(v/1000).toFixed(1)}k`} domain={[0, 'auto']} />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'rgba(15, 23, 42, 0.96)', 
                      borderColor: 'var(--border-subtle)', 
                      borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--shadow-lg)',
                      fontSize: '12px'
                    }}
                    formatter={(val, name) => {
                      if (name === 'actual') return [`${val.toLocaleString()} MW`, 'Actual Generation'];
                      if (name === 'forecast') return [`${val.toLocaleString()} MW`, 'Latest Forecast'];
                      if (name === 'shortfall') return [`${val.toLocaleString()} MW`, 'Over-forecast Shortfall'];
                      return [val, name];
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="actual" 
                    stroke="var(--wind-emerald)" 
                    strokeWidth={2.5}
                    fillOpacity={1} 
                    fill="url(#colorActualDay)" 
                    name="actual" 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="forecast" 
                    stroke="var(--forecast-cyan)" 
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 2, fill: 'var(--forecast-cyan)' }}
                    name="forecast" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="shortfall" 
                    stroke="transparent" 
                    fill="url(#colorShortfall)" 
                    name="shortfall" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Half-Hour Inspection Table */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">
                  <Clock size={18} color="var(--forecast-cyan)" />
                  <span>Settlement Period Drill-Down</span>
                </div>
                <div className="card-description">
                  {resolution === 'half_hourly' ? 'All 48 half-hourly settlement periods for physical trading review' : '24 hourly periods'}
                </div>
              </div>
            </div>

            <div className="table-container" style={{ maxHeight: '420px' }}>
              <table>
                <thead>
                  <tr>
                    <th>Settlement Period</th>
                    <th>Target Time (UTC)</th>
                    <th>Actual Wind (MW)</th>
                    <th>Day-Ahead Forecast (MW)</th>
                    <th>Error (MW)</th>
                    <th>% Error</th>
                    <th>Imbalance Position</th>
                    <th>Forecast Publish Time</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((row, idx) => {
                    const isShort = row.error > 0;
                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: '600', color: '#fff' }}>
                          SP {row.period || idx + 1}
                        </td>
                        <td>{row.time}</td>
                        <td style={{ color: 'var(--wind-emerald)', fontWeight: '600' }}>
                          {row.actual.toLocaleString()}
                        </td>
                        <td style={{ color: 'var(--forecast-cyan)', fontWeight: '600' }}>
                          {row.forecast.toLocaleString()}
                        </td>
                        <td style={{ color: isShort ? 'var(--risk-rose)' : 'var(--wind-emerald)', fontWeight: '600' }}>
                          {row.error > 0 ? `+${row.error.toLocaleString()}` : row.error.toLocaleString()}
                        </td>
                        <td>
                          {row.actual > 0 ? `${((row.error / row.actual) * 100).toFixed(1)}%` : '0%'}
                        </td>
                        <td>
                          <span className={`badge ${isShort ? 'badge-rose' : 'badge-emerald'}`}>
                            {isShort ? 'SHORT (Under-Procured)' : 'LONG (Surplus Spill)'}
                          </span>
                        </td>
                        <td style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                          {row.publishTime ? row.publishTime.replace('T', ' ').replace('Z', '') : 'N/A'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
