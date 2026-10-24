import React from 'react';
import { 
  Wind, 
  TrendingUp, 
  Sliders, 
  BarChart3, 
  CalendarDays, 
  Cpu, 
  FileSpreadsheet, 
  ExternalLink 
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'overview', label: 'Executive Overview', icon: TrendingUp },
    { id: 'desk', label: 'Day-Ahead Trading Desk', icon: Wind },
    { id: 'simulator', label: 'Procurement Simulator', icon: Sliders },
    { id: 'accuracy', label: 'Forecast Accuracy Lab', icon: BarChart3 },
    { id: 'ledger', label: 'Daily Performance Ledger', icon: CalendarDays },
    { id: 'tech', label: 'Technical Architecture', icon: Cpu },
  ];

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <div className="nav-brand">
          <div className="brand-icon-box">
            <Wind size={22} />
          </div>
          <div>
            <div className="brand-title">
              GRID IQ <span style={{ color: 'var(--forecast-cyan)', fontSize: '13px', fontWeight: '500' }}>UK Day-Ahead</span>
            </div>
            <div className="brand-subtitle">Elexon BMRS National Wind Generation Desk</div>
          </div>
          <div className="market-badge" style={{ marginLeft: '12px' }}>
            <span className="dot"></span>
            Jan 2026 Live
          </div>
        </div>

        {/* Tab Switcher */}
        <nav className="nav-tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`nav-tab-btn ${isActive ? 'active' : ''}`}
                id={`nav-tab-${tab.id}`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Meta & Links */}
        <div className="nav-meta">
          <a
            href="http://127.0.0.1:8000/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="meta-chip"
            style={{ textDecoration: 'none', color: 'inherit' }}
            title="Open FastAPI Swagger API Docs"
          >
            <span>API Docs</span>
            <ExternalLink size={12} />
          </a>
          <a
            href="/api/data/export-csv?date_from=2026-01-01&date_to=2026-01-31"
            className="btn btn-primary"
            style={{ padding: '6px 12px', fontSize: '12px', textDecoration: 'none' }}
            title="Download complete January 2026 dataset"
          >
            <FileSpreadsheet size={14} />
            <span>Export CSV</span>
          </a>
        </div>
      </div>
    </header>
  );
}
