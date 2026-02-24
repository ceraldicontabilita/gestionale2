import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAnnoGlobale } from '../contexts/AnnoContext';
import { PageLayout, PageLoading } from '../components/PageLayout';
import { FileText, RefreshCw, Shield, BarChart3, Mail } from 'lucide-react';

// Lazy-load the two existing pages as tab content
const F24Content = lazy(() => import('./F24.jsx'));
const RiconciliazioneF24Content = lazy(() => import('./RiconciliazioneF24.jsx'));

const TABS = [
  { id: 'modelli', label: 'F24 / Tributi', icon: <FileText size={16} />, desc: 'Modelli F24 e dashboard pagamenti' },
  { id: 'riconciliazione', label: 'Riconciliazione', icon: <Shield size={16} />, desc: 'Commercialista → Quietanza → Verifica' },
];

export default function F24Unificato() {
  const { anno } = useAnnoGlobale();
  const navigate = useNavigate();
  const location = useLocation();

  const getTabFromPath = () => {
    const match = location.pathname.match(/\/f24\/(riconciliazione|modelli)/);
    return match ? match[1] : 'modelli';
  };

  const [activeTab, setActiveTab] = useState(getTabFromPath());

  useEffect(() => {
    const tab = getTabFromPath();
    if (tab !== activeTab) setActiveTab(tab);
  }, [location.pathname]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    navigate(`/f24/${tabId}`);
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
        {activeTab === 'modelli' && <F24Content />}
        {activeTab === 'riconciliazione' && <RiconciliazioneF24Content />}
      </Suspense>
    </div>
  );
}
