import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAnnoGlobale } from '../contexts/AnnoContext';
import { PageLoading } from '../components/PageLayout';
import { Receipt, Calculator } from 'lucide-react';

const IVAContent = lazy(() => import('./IVA.jsx'));
const LiquidazioneIVAContent = lazy(() => import('./LiquidazioneIVA.jsx'));

const TABS = [
  { id: 'calcolo', label: 'Calcolo IVA', icon: <Receipt size={16} />, desc: 'Debito/Credito mensile, trimestrale, annuale' },
  { id: 'liquidazione', label: 'Liquidazione IVA', icon: <Calculator size={16} />, desc: 'Calcolo preciso per commercialista' },
];

export default function IVAUnificata() {
  const { anno } = useAnnoGlobale();
  const navigate = useNavigate();
  const location = useLocation();

  const getTabFromPath = () => {
    const match = location.pathname.match(/\/iva\/(liquidazione|calcolo)/);
    return match ? match[1] : 'calcolo';
  };

  const [activeTab, setActiveTab] = useState(getTabFromPath());

  useEffect(() => {
    const tab = getTabFromPath();
    if (tab !== activeTab) setActiveTab(tab);
  }, [location.pathname]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    navigate(`/iva/${tabId}`);
  };

  return (
    <div>
      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', gap: 0, 
        borderBottom: '2px solid #e2e8f0', 
        background: 'white',
        padding: '0 24px',
        marginBottom: 0
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            style={{
              padding: '16px 24px',
              border: 'none',
              background: activeTab === tab.id ? '#1e293b' : 'transparent',
              color: activeTab === tab.id ? 'white' : '#64748b',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              borderRadius: '8px 8px 0 0',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s'
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <Suspense fallback={<PageLoading message="Caricamento..." />}>
        {activeTab === 'calcolo' && <IVAContent />}
        {activeTab === 'liquidazione' && <LiquidazioneIVAContent />}
      </Suspense>
    </div>
  );
}
