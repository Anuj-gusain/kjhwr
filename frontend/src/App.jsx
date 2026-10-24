import React, { useState } from 'react';
import Navbar from './components/Navbar';
import ExecutiveOverview from './components/ExecutiveOverview';
import DayAheadDesk from './components/DayAheadDesk';
import ProcurementSimulator from './components/ProcurementSimulator';
import AccuracyLab from './components/AccuracyLab';
import DailyLedger from './components/DailyLedger';
import TechnicalArchitecture from './components/TechnicalArchitecture';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="app-container" style={{ flex: 1 }}>
        {activeTab === 'overview' && (
          <ExecutiveOverview 
            onNavigateToDesk={() => setActiveTab('desk')}
            onNavigateToSimulator={() => setActiveTab('simulator')}
          />
        )}
        {activeTab === 'desk' && <DayAheadDesk />}
        {activeTab === 'simulator' && <ProcurementSimulator />}
        {activeTab === 'accuracy' && <AccuracyLab />}
        {activeTab === 'ledger' && (
          <DailyLedger 
            onSelectDay={(day) => {
              setActiveTab('desk');
            }} 
          />
        )}
        {activeTab === 'tech' && <TechnicalArchitecture />}
      </main>

      <footer style={{ 
        borderTop: '1px solid var(--border-subtle)', 
        padding: '24px', 
        textAlign: 'center', 
        fontSize: '12px', 
        color: 'var(--text-muted)',
        background: 'rgba(8, 12, 20, 0.9)',
        marginTop: 'auto'
      }}>
        <div style={{ maxWidth: '1480px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <strong>UK Day-Ahead Wind Analytics Platform</strong> &copy; 2026. Built for UK Wholesale Electricity Procurement Desks.
          </div>
          <div>
            Data Source: <a href="https://bmrs.elexon.co.uk" target="_blank" rel="noreferrer" style={{ color: 'var(--forecast-cyan)', textDecoration: 'none' }}>Elexon BMRS</a> (FUELHH Wind Actuals &amp; WINDFOR Forecast Streams).
          </div>
        </div>
      </footer>
    </div>
  );
}
