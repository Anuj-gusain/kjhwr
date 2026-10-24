import React, { useState, useEffect } from 'react';
import { 
  CalendarDays, 
  ArrowUpDown, 
  Search, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';

export default function DailyLedger({ onSelectDay }) {
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('date');
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    async function fetchLedger() {
      setLoading(true);
      try {
        const res = await fetch('/api/analytics/daily-ledger?cutoff_hour=11');
        const json = await res.json();
        setLedger(json);
      } catch (err) {
        console.error('Failed to load ledger', err);
      } finally {
        setLoading(false);
      }
    }
    fetchLedger();
  }, []);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const filtered = ledger
    .filter((d) => d.date.includes(searchTerm))
    .sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">
            <CalendarDays size={18} color="var(--forecast-cyan)" />
            <span>January 2026 Daily Performance Ledger</span>
          </div>
          <div className="card-description">
            Complete 31-day retrospective performance audit with Elexon BMRS day-ahead forecast metrics
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search date (e.g. 2026-01-15)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '32px' }}
            />
          </div>

          <a 
            href="/api/data/export-csv?date_from=2026-01-01&date_to=2026-01-31" 
            className="btn btn-primary"
            style={{ textDecoration: 'none' }}
          >
            <FileSpreadsheet size={14} />
            <span>Export Full Month CSV</span>
          </a>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th onClick={() => handleSort('date')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Delivery Date</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th onClick={() => handleSort('avg_actual_mw')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Actual Mean (MW)</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th onClick={() => handleSort('avg_forecast_mw')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Forecast Mean (MW)</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th onClick={() => handleSort('peak_actual_mw')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Peak Actual (MW)</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th onClick={() => handleSort('mae_mw')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>MAE (MW)</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th onClick={() => handleSort('rmse_mw')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>RMSE (MW)</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th onClick={() => handleSort('wape_pct')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>WAPE (%)</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th onClick={() => handleSort('mean_error_bias_mw')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Bias (MW)</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => {
              const isOver = d.mean_error_bias_mw > 0;
              return (
                <tr key={d.date}>
                  <td style={{ fontWeight: '600', color: '#fff' }}>{d.date}</td>
                  <td style={{ color: 'var(--wind-emerald)' }}>{Math.round(d.avg_actual_mw).toLocaleString()}</td>
                  <td style={{ color: 'var(--forecast-cyan)' }}>{Math.round(d.avg_forecast_mw).toLocaleString()}</td>
                  <td>{Math.round(d.peak_actual_mw).toLocaleString()}</td>
                  <td style={{ fontWeight: '600' }}>{d.mae_mw.toLocaleString()}</td>
                  <td>{d.rmse_mw.toLocaleString()}</td>
                  <td style={{ fontWeight: '700', color: d.wape_pct < 15 ? 'var(--wind-emerald)' : d.wape_pct < 30 ? 'var(--thermal-amber)' : 'var(--risk-rose)' }}>
                    {d.wape_pct}%
                  </td>
                  <td style={{ color: isOver ? 'var(--risk-rose)' : 'var(--wind-emerald)', fontWeight: '600' }}>
                    {isOver ? `+${Math.round(d.mean_error_bias_mw)}` : Math.round(d.mean_error_bias_mw)}
                  </td>
                  <td>
                    <span className={`badge ${d.wape_pct < 15 ? 'badge-emerald' : d.wape_pct < 30 ? 'badge-amber' : 'badge-rose'}`}>
                      {d.wape_pct < 15 ? 'Accurate' : d.wape_pct < 30 ? 'Moderate' : 'Severe Bias'}
                    </span>
                  </td>
                  <td>
                    <button 
                      className="btn" 
                      style={{ padding: '3px 8px', fontSize: '11px' }}
                      onClick={() => onSelectDay && onSelectDay(d.date)}
                    >
                      Open Desk
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
