import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  Flame, 
  ShieldCheck, 
  TrendingDown, 
  PoundSterling, 
  Zap, 
  AlertTriangle,
  HelpCircle
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
  Legend 
} from 'recharts';

export default function ProcurementSimulator() {
  const [selectedDate, setSelectedDate] = useState('2026-01-15');
  const [confidenceLevel, setConfidenceLevel] = useState(0.90);
  const [utilityScale, setUtilityScale] = useState(0.25); // 25% of national load
  const [thermalPrice, setThermalPrice] = useState(75); // £75/MWh Day-Ahead
  const [cashoutPrice, setCashoutPrice] = useState(130); // £130/MWh Cashout penalty
  const [simData, setSimData] = useState(null);
  const [loading, setLoading] = useState(false);

  const dates = Array.from({ length: 31 }, (_, i) => `2026-01-${String(i + 1).padStart(2, '0')}`);

  useEffect(() => {
    async function runSim() {
      setLoading(true);
      try {
        const dt = new Date(selectedDate);
        dt.setDate(dt.getDate() - 1);
        const dMinus1 = dt.toISOString().split('T')[0];
        const cutoff = `${dMinus1}T11:00:00Z`;

        const url = `/api/dayahead/simulate?date=${selectedDate}&cutoff_time=${cutoff}&confidence_level=${confidenceLevel}&utility_scale_factor=${utilityScale}`;
        const res = await fetch(url);
        const json = await res.json();
        setSimData(json);
      } catch (err) {
        console.error('Simulation error:', err);
      } finally {
        setLoading(false);
      }
    }
    runSim();
  }, [selectedDate, confidenceLevel, utilityScale]);

  const summary = simData?.summary;

  // Chart data
  const chartData = simData?.periods?.map((p) => ({
    time: p.time_label,
    period: p.settlement_period,
    demand: p.demand_mw,
    actualWind: p.actual_wind_mw,
    forecastWind: p.forecast_wind_mw,
    deratedWind: p.derated_wind_mw,
    naiveThermal: p.naive_thermal_procure_mw,
    hedgedThermal: p.hedged_thermal_procure_mw,
    buffer: p.safety_buffer_mw,
  })) || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Intro Header */}
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.8) 100%)' }}>
        <div className="card-header">
          <div>
            <div className="card-title" style={{ fontSize: '18px' }}>
              <Sliders size={20} color="var(--thermal-amber)" />
              <span>Day-Ahead Power Purchase & Thermal Hedging Simulator</span>
            </div>
            <div className="card-description">
              Translate quantified wind forecast uncertainty into optimal thermal plant procurement decisions for delivery day {selectedDate}
            </div>
          </div>
          <span className="badge badge-amber">
            Decision Gate: D-1 11:00 UTC
          </span>
        </div>

        {/* Simulator Parameter Controls */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', paddingTop: '10px' }}>
          <div>
            <label className="control-label" style={{ display: 'block', marginBottom: '8px' }}>
              Delivery Date
            </label>
            <select 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ width: '100%' }}
            >
              {dates.map((d) => (
                <option key={d} value={d}>
                  {d} {d === '2026-01-28' ? '⚠ (Severe Wind Drop)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label className="control-label">
                Forecast Risk Buffer Confidence: {(confidenceLevel * 100).toFixed(0)}%
              </label>
              <span style={{ fontSize: '12px', color: 'var(--forecast-cyan)', fontWeight: '600' }}>
                {confidenceLevel === 0.50 ? 'Zero Buffer (Naive)' : confidenceLevel === 0.90 ? 'Recommended (P90)' : 'High Protection'}
              </span>
            </div>
            <input 
              type="range" 
              min="0.50" 
              max="0.95" 
              step="0.05"
              value={confidenceLevel}
              onChange={(e) => setConfidenceLevel(parseFloat(e.target.value))}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
              <span>50% (Median)</span>
              <span>75%</span>
              <span>85%</span>
              <span>90% (P90)</span>
              <span>95% (P95)</span>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label className="control-label">
                Utility Portfolio Scale: {(utilityScale * 100).toFixed(0)}%
              </label>
              <span style={{ fontSize: '12px', color: 'var(--wind-emerald)' }}>
                ~{Math.round(utilityScale * 11500)} MW Wind
              </span>
            </div>
            <input 
              type="range" 
              min="0.05" 
              max="0.50" 
              step="0.05"
              value={utilityScale}
              onChange={(e) => setUtilityScale(parseFloat(e.target.value))}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
              <span>Small (5%)</span>
              <span>Regional (25%)</span>
              <span>Tier 1 (50%)</span>
            </div>
          </div>
        </div>
      </div>

      {summary && !loading && (
        <>
          {/* Strategy Comparison Scorecards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {/* Strategy A: Naive */}
            <div className="card" style={{ borderColor: 'rgba(244, 63, 94, 0.3)' }}>
              <div className="card-header" style={{ marginBottom: '14px' }}>
                <div>
                  <div className="card-title" style={{ fontSize: '15px', color: 'var(--risk-rose)' }}>
                    <AlertTriangle size={18} />
                    <span>Strategy A: Naive Point-Forecast</span>
                  </div>
                  <div className="card-description">
                    Procure thermal = Demand - Raw Wind Forecast (Zero Error Buffer)
                  </div>
                </div>
                <span className="badge badge-rose">High Risk</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Day-Ahead Thermal Bought:</span>
                  <span style={{ fontWeight: '600' }}>{summary.naive_strategy.thermal_procured_mwh.toLocaleString()} MWh</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--risk-rose)', fontWeight: '600' }}>Unhedged Imbalance Shortfall:</span>
                  <span style={{ color: 'var(--risk-rose)', fontWeight: '700' }}>
                    {summary.naive_strategy.unhedged_shortfall_mwh.toLocaleString()} MWh
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Cashout Penalty Exposure:</span>
                  <span style={{ color: 'var(--risk-rose)', fontWeight: '600' }}>
                    £{summary.naive_strategy.imbalance_penalty_gbp.toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px' }}>
                  <span style={{ fontWeight: '600', color: '#fff' }}>Total Settlement Cost:</span>
                  <span style={{ fontWeight: '700', color: '#fff', fontSize: '16px' }}>
                    £{summary.naive_strategy.total_procurement_cost_gbp.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Strategy B: Quantified Error Aware */}
            <div className="card" style={{ borderColor: 'rgba(16, 185, 129, 0.4)', background: 'linear-gradient(180deg, var(--bg-card) 0%, rgba(16, 185, 129, 0.05) 100%)' }}>
              <div className="card-header" style={{ marginBottom: '14px' }}>
                <div>
                  <div className="card-title" style={{ fontSize: '15px', color: 'var(--wind-emerald)' }}>
                    <ShieldCheck size={18} />
                    <span>Strategy B: Quantified Error Hedged</span>
                  </div>
                  <div className="card-description">
                    Procure thermal = Demand - Derated Wind (with {(confidenceLevel * 100).toFixed(0)}% Confidence Buffer)
                  </div>
                </div>
                <span className="badge badge-emerald">Optimal Protection</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Day-Ahead Thermal Bought:</span>
                  <span style={{ fontWeight: '600' }}>{summary.hedged_strategy.thermal_procured_mwh.toLocaleString()} MWh</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--wind-emerald)', fontWeight: '600' }}>Residual Shortfall:</span>
                  <span style={{ color: 'var(--wind-emerald)', fontWeight: '700' }}>
                    {summary.hedged_strategy.unhedged_shortfall_mwh.toLocaleString()} MWh
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Cashout Penalty Exposure:</span>
                  <span style={{ color: 'var(--wind-emerald)', fontWeight: '600' }}>
                    £{summary.hedged_strategy.imbalance_penalty_gbp.toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px' }}>
                  <span style={{ fontWeight: '600', color: '#fff' }}>Total Settlement Cost:</span>
                  <span style={{ fontWeight: '700', color: '#fff', fontSize: '16px' }}>
                    £{summary.hedged_strategy.total_procurement_cost_gbp.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Net Value Realized */}
            <div className="card" style={{ borderColor: 'rgba(6, 182, 212, 0.4)', background: 'linear-gradient(180deg, var(--bg-card) 0%, rgba(6, 182, 212, 0.05) 100%)' }}>
              <div className="card-header" style={{ marginBottom: '14px' }}>
                <div>
                  <div className="card-title" style={{ fontSize: '15px', color: 'var(--forecast-cyan)' }}>
                    <TrendingDown size={18} />
                    <span>Risk Reduction & Savings</span>
                  </div>
                  <div className="card-description">
                    Quantified commercial value delivered to the utility trading desk
                  </div>
                </div>
                <span className="badge badge-cyan">Hedging ROI</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Shortfall Volume Avoided</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '700', color: 'var(--forecast-cyan)' }}>
                    {summary.net_shortfall_reduction_pct}% Reduction
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Protected {(summary.naive_strategy.unhedged_shortfall_mwh - summary.hedged_strategy.unhedged_shortfall_mwh).toLocaleString()} MWh from cashout price spikes
                  </div>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Net Imbalance Penalty Saved</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '700', color: 'var(--wind-emerald)' }}>
                    £{(summary.naive_strategy.imbalance_penalty_gbp - summary.hedged_strategy.imbalance_penalty_gbp).toLocaleString()}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    By locking in Day-Ahead thermal prices (£{thermalPrice}/MWh) vs cashout penalties
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Stacked Dispatch Curve */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">
                  <Flame size={18} color="var(--thermal-amber)" />
                  <span>Half-Hourly Power Balance: Thermal Procurement vs Wind Generation</span>
                </div>
                <div className="card-description">
                  Customer demand profile covered by wind generation and thermal procurement under the {(confidenceLevel * 100).toFixed(0)}% error buffer
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="legend-item">
                  <div className="legend-color" style={{ background: '#fff' }}></div>
                  <span>Customer Demand</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color" style={{ background: 'var(--wind-emerald)' }}></div>
                  <span>Actual Wind Outturn</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color" style={{ background: 'var(--thermal-amber)' }}></div>
                  <span>Hedged Thermal Procured</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color" style={{ background: 'var(--forecast-cyan)' }}></div>
                  <span>Naive Thermal Procured</span>
                </div>
              </div>
            </div>

            <div style={{ width: '100%', height: 380 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={11} interval={3} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'rgba(15, 23, 42, 0.96)', 
                      borderColor: 'var(--border-subtle)', 
                      borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--shadow-lg)'
                    }} 
                    formatter={(val, name) => [`${Math.round(val).toLocaleString()} MW`, name]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="demand" 
                    stroke="#ffffff" 
                    strokeWidth={2} 
                    dot={false}
                    name="Customer Demand" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="actualWind" 
                    stroke="var(--wind-emerald)" 
                    fill="rgba(16, 185, 129, 0.2)" 
                    strokeWidth={2}
                    name="Actual Wind Outturn" 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="hedgedThermal" 
                    stroke="var(--thermal-amber)" 
                    strokeWidth={2.5} 
                    dot={false}
                    name="Hedged Thermal Procured" 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="naiveThermal" 
                    stroke="var(--forecast-cyan)" 
                    strokeDasharray="4 4"
                    strokeWidth={1.5} 
                    dot={false}
                    name="Naive Thermal Procured" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
