import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Activity, 
  Clock, 
  Sigma, 
  AlertTriangle, 
  HelpCircle,
  TrendingDown,
  Layers
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
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

export default function AccuracyLab() {
  const [diurnalData, setDiurnalData] = useState([]);
  const [distData, setDistData] = useState(null);
  const [decayData, setDecayData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLabData() {
      setLoading(true);
      try {
        const [resDiurnal, resDist, resDecay] = await Promise.all([
          fetch('/api/analytics/diurnal?cutoff_hour=11'),
          fetch('/api/analytics/distribution?cutoff_hour=11'),
          fetch('/api/analytics/lead-time-decay')
        ]);
        const jsonDiurnal = await resDiurnal.json();
        const jsonDist = await resDist.json();
        const jsonDecay = await resDecay.json();

        setDiurnalData(jsonDiurnal);
        setDistData(jsonDist);
        setDecayData(jsonDecay);
      } catch (err) {
        console.error('Error loading accuracy lab data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadLabData();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div className="brand-icon-box" style={{ margin: '0 auto 12px' }}>
          <Activity size={24} />
        </div>
        <span>Computing statistical forecast error distributions and lead-time decay models...</span>
      </div>
    );
  }

  const quantiles = distData?.quantiles || {};
  const histogram = distData?.histogram || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Diurnal Error Profile Card */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">
              <Clock size={18} color="var(--forecast-cyan)" />
              <span>Diurnal Error Profile Across 48 Settlement Periods</span>
            </div>
            <div className="card-description">
              Analysis of average wind forecast bias (MW) and absolute error (MAE) for every half-hour of the day in January 2026
            </div>
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div className="legend-item">
              <div className="legend-color" style={{ background: 'var(--thermal-amber)' }}></div>
              <span>Mean Bias (Over/Under MW)</span>
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ background: 'var(--risk-rose)' }}></div>
              <span>P90 Risk Margin (MW)</span>
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ background: 'var(--wind-emerald)' }}></div>
              <span>Actual Wind MW</span>
            </div>
          </div>
        </div>

        <div style={{ width: '100%', height: 360 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={diurnalData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="time_label" stroke="var(--text-muted)" fontSize={11} interval={3} />
              <YAxis stroke="var(--text-muted)" fontSize={11} />
              <Tooltip 
                contentStyle={{ 
                  background: 'rgba(15, 23, 42, 0.96)', 
                  borderColor: 'var(--border-subtle)', 
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-lg)'
                }} 
              />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
              <Bar 
                dataKey="bias_mw" 
                fill="var(--thermal-amber)" 
                name="Mean Forecast Bias (MW)" 
                radius={[3, 3, 0, 0]}
              />
              <Line 
                type="monotone" 
                dataKey="mae_mw" 
                stroke="var(--forecast-cyan)" 
                strokeWidth={2} 
                dot={false}
                name="Mean Absolute Error (MAE MW)" 
              />
              <Line 
                type="monotone" 
                dataKey="p90_risk_mw" 
                stroke="var(--risk-rose)" 
                strokeWidth={2} 
                strokeDasharray="4 4"
                dot={false}
                name="P90 Risk Margin (MW)" 
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Two Column: Distribution Histogram & Quantiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* Error Distribution Histogram */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">
                <BarChart3 size={18} color="var(--wind-emerald)" />
                <span>Forecast Error Frequency Distribution</span>
              </div>
              <div className="card-description">
                Histogram of forecast errors (MW) showing positive skew and right tail over-forecast risk
              </div>
            </div>
          </div>

          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogram} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="bin_center_mw" stroke="var(--text-muted)" fontSize={10} tickFormatter={(v) => `${(v/1000).toFixed(1)}k`} />
                <YAxis stroke="var(--text-muted)" fontSize={10} />
                <Tooltip 
                  contentStyle={{ 
                    background: 'rgba(15, 23, 42, 0.96)', 
                    borderColor: 'var(--border-subtle)', 
                    borderRadius: 'var(--radius-md)'
                  }}
                  formatter={(val, name, props) => [
                    `${val} periods (${props.payload.pct}%)`, 
                    `Error Bin: ${props.payload.bin_start_mw} to ${props.payload.bin_end_mw} MW`
                  ]}
                />
                <ReferenceLine x={0} stroke="#ffffff" strokeDasharray="3 3" label="Zero Error" />
                <Bar dataKey="count" fill="var(--forecast-cyan)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quantile Safety Buffer Matrix */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">
                <Sigma size={18} color="var(--risk-rose)" />
                <span>Empirical Error Quantiles & Safety Buffers</span>
              </div>
              <div className="card-description">
                Percentiles derived from January 2026 data for sizing thermal hedge commitments
              </div>
            </div>
            <span className="badge badge-rose">1,488 Periods</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ background: 'var(--bg-surface)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>P10 (Severe Under-forecast)</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--wind-emerald)' }}>
                {quantiles.p10?.toLocaleString()} MW
              </div>
            </div>

            <div style={{ background: 'var(--bg-surface)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>P50 Median Bias</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--forecast-cyan)' }}>
                +{quantiles.p50_median?.toLocaleString()} MW
              </div>
            </div>

            <div style={{ background: 'var(--bg-surface)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
              <div style={{ fontSize: '11px', color: 'var(--thermal-amber)', fontWeight: '600' }}>P90 Shortfall Buffer</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--thermal-amber)' }}>
                +{quantiles.p90?.toLocaleString()} MW
              </div>
            </div>

            <div style={{ background: 'var(--bg-surface)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(244, 63, 94, 0.4)' }}>
              <div style={{ fontSize: '11px', color: 'var(--risk-rose)', fontWeight: '600' }}>P95 Extreme Tail Risk</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--risk-rose)' }}>
                +{quantiles.p95?.toLocaleString()} MW
              </div>
            </div>
          </div>

          <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            <strong>Desk Sizing Rule:</strong> To protect against 90% of wind under-delivery events, the utility trading desk should procure an additional 
            <strong> {quantiles.p90?.toLocaleString()} MW</strong> of thermal capacity (scaled to utility portfolio share) beyond naive net demand.
          </div>
        </div>
      </div>

      {/* Lead-Time Horizon Accuracy Decay */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">
              <TrendingDown size={18} color="var(--forecast-cyan)" />
              <span>Forecast Horizon Value Decay (Lead-Time Analysis)</span>
            </div>
            <div className="card-description">
              How forecast error (WAPE % and MAE) improves as delivery approaches from 48 hours to 2 hours before gate closure
            </div>
          </div>
        </div>

        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={decayData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="horizon_label" stroke="var(--text-muted)" fontSize={11} />
              <YAxis yAxisId="left" stroke="var(--forecast-cyan)" fontSize={11} tickFormatter={(v) => `${v} MW`} />
              <YAxis yAxisId="right" orientation="right" stroke="var(--thermal-amber)" fontSize={11} tickFormatter={(v) => `${v}%`} />
              <Tooltip 
                contentStyle={{ 
                  background: 'rgba(15, 23, 42, 0.96)', 
                  borderColor: 'var(--border-subtle)', 
                  borderRadius: 'var(--radius-md)'
                }} 
              />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="mean_mae_mw" 
                stroke="var(--forecast-cyan)" 
                strokeWidth={3}
                dot={{ r: 5, fill: 'var(--forecast-cyan)' }}
                name="MAE (MW)" 
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="mean_wape_pct" 
                stroke="var(--thermal-amber)" 
                strokeWidth={2.5}
                strokeDasharray="4 4"
                dot={{ r: 4, fill: 'var(--thermal-amber)' }}
                name="WAPE (%)" 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
