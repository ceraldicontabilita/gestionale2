import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { formatEuro } from '../lib/utils';
import api from '../api';
import { useAnnoGlobale } from '../contexts/AnnoContext';
import { PageLayout, PageSection, PageGrid, PageLoading, PageEmpty } from '../components/PageLayout';
import { Wallet, Calendar, PiggyBank, ArrowDownCircle, ArrowUpCircle, Users } from 'lucide-react';

export default function TFR() {
  const { anno } = useAnnoGlobale();
  const [dipendenti, setDipendenti] = useState([]);
  const [selectedDipendente, setSelectedDipendente] = useState(null);
  const [situazioneTFR, setSituazioneTFR] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  
  const getTabFromPath = () => {
    const match = location.pathname.match(/\/tfr\/([\w-]+)/);
    return match ? match[1] : 'riepilogo';
  };
  
  const [activeTab, setActiveTab] = useState(getTabFromPath());
  
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    navigate(`/tfr/${tabId}`);
  };
  
  useEffect(() => {
    const tab = getTabFromPath();
    if (tab !== activeTab) setActiveTab(tab);
  }, [location.pathname]);

  useEffect(() => {
    const loadDipendenti = async () => {
      try {
        const res = await api.get('/api/dipendenti');
        const data = res.data.dipendenti || res.data || [];
        setDipendenti(data);
        if (data.length > 0) setSelectedDipendente(data[0].id);
      } catch (err) {
        console.error('Errore caricamento dipendenti:', err);
      } finally {
        setLoading(false);
      }
    };
    loadDipendenti();
  }, []);

  const loadSituazioneTFR = useCallback(async () => {
    if (!selectedDipendente) return;
    try {
      const res = await api.get(`/api/tfr/situazione/${selectedDipendente}`);
      setSituazioneTFR(res.data);
    } catch (err) {
      console.error('Errore caricamento TFR:', err);
      setSituazioneTFR(null);
    }
  }, [selectedDipendente]);

  useEffect(() => { loadSituazioneTFR(); }, [loadSituazioneTFR]);

  const handleAccantonamento = async () => {
    if (!selectedDipendente) return;
    const retribuzione = prompt('Inserisci retribuzione annua lorda:');
    if (!retribuzione) return;
    try {
      const res = await api.post('/api/tfr/accantonamento', {
        dipendente_id: selectedDipendente, anno,
        retribuzione_annua: parseFloat(retribuzione),
        indice_istat: 5.4
      });
      alert(`Accantonamento registrato: €${res.data.quota_tfr?.toFixed(2) || 0}`);
      loadSituazioneTFR();
    } catch (err) {
      alert('Errore accantonamento: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleLiquidazione = async () => {
    if (!selectedDipendente) return;
    const motivo = prompt('Motivo (dimissioni/licenziamento/pensionamento/anticipo):');
    if (!motivo) return;
    let importo = null;
    if (motivo === 'anticipo') importo = prompt('Importo anticipo richiesto:');
    try {
      const res = await api.post('/api/tfr/liquidazione', {
        dipendente_id: selectedDipendente,
        data_liquidazione: new Date().toISOString().split('T')[0],
        motivo,
        importo_richiesto: importo ? parseFloat(importo) : null
      });
      alert(`Liquidazione registrata: €${res.data.importo_lordo?.toFixed(2) || 0} lordo, €${res.data.importo_netto?.toFixed(2) || 0} netto`);
      loadSituazioneTFR();
    } catch (err) {
      alert('Errore liquidazione: ' + (err.response?.data?.detail || err.message));
    }
  };

  const tabs = [
    { id: 'riepilogo', label: 'Riepilogo', icon: '📊' },
    { id: 'accantonamenti', label: 'Accantonamenti', icon: '📥' },
    { id: 'liquidazioni', label: 'Liquidazioni', icon: '📤' }
  ];

  const MetricCard = ({ label, value, subtext, icon: Icon, color, bgColor, gradient }) => (
    <div style={{ 
      background: gradient || bgColor || 'white', 
      borderRadius: 12, 
      padding: 20,
      border: gradient ? 'none' : '1px solid #e2e8f0',
      color: gradient ? 'white' : 'inherit'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {Icon && <Icon size={18} color={gradient ? 'white' : color} />}
        <span style={{ fontSize: 13, opacity: gradient ? 0.9 : 1, color: gradient ? 'white' : '#64748b' }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: gradient ? 'white' : (color || '#1e293b') }}>{value}</div>
      {subtext && <div style={{ fontSize: 11, marginTop: 6, opacity: gradient ? 0.8 : 1, color: gradient ? 'white' : '#94a3b8' }}>{subtext}</div>}
    </div>
  );

  if (loading) {
    return (
      <PageLayout title="TFR e Accantonamenti" icon={<Wallet size={28} />}>
        <PageLoading message="Caricamento dipendenti..." />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="TFR e Accantonamenti"
      icon={<Wallet size={28} />}
      subtitle="Gestione Trattamento Fine Rapporto • Accantonamenti • Rivalutazioni ISTAT • Liquidazioni"
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleAccantonamento} disabled={!selectedDipendente} data-testid="tfr-accantona-btn"
            style={{ padding: '10px 16px', background: selectedDipendente ? '#10b981' : '#d1d5db', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: selectedDipendente ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowDownCircle size={16} /> Accantona TFR
          </button>
          <button onClick={handleLiquidazione} disabled={!selectedDipendente} data-testid="tfr-liquida-btn"
            style={{ padding: '10px 16px', background: selectedDipendente ? '#ef4444' : '#d1d5db', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: selectedDipendente ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowUpCircle size={16} /> Liquida TFR
          </button>
        </div>
      }
    >
      {/* Selezione Dipendente */}
      <PageSection title="Selezione Dipendente" icon={<Users size={16} />}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Dipendente</label>
            <select value={selectedDipendente || ''} onChange={(e) => setSelectedDipendente(e.target.value)} data-testid="tfr-select-dipendente"
              style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', minWidth: 250, fontSize: 14 }}>
              <option value="">-- Seleziona --</option>
              {dipendenti.map(d => (<option key={d.id} value={d.id}>{d.nome_completo || `${d.cognome || ''} ${d.nome || ''}`.trim()}</option>))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Anno</label>
            <div style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 14, color: '#1e293b', fontWeight: 600 }}>
              {anno} <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>(globale)</span>
            </div>
          </div>
        </div>
      </PageSection>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginTop: 20, background: '#f1f5f9', padding: 4, borderRadius: 10, width: 'fit-content' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => handleTabChange(tab.id)}
            style={{
              padding: '10px 18px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
              background: activeTab === tab.id ? 'white' : 'transparent',
              color: activeTab === tab.id ? '#1e293b' : '#64748b',
              boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Contenuto */}
      <div style={{ marginTop: 20 }}>
        {!selectedDipendente ? (
          <PageEmpty icon="👆" message="Seleziona un dipendente per visualizzare la situazione TFR" />
        ) : activeTab === 'riepilogo' ? (
          <PageGrid cols={4} gap={16}>
            <MetricCard label="TFR Maturato Totale" value={formatEuro(situazioneTFR?.tfr_maturato || 0)} subtext="Inclusa rivalutazione ISTAT" icon={PiggyBank} gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)" />
            <MetricCard label="Anni di Anzianità" value={situazioneTFR?.anni_anzianita || 0} subtext={`Assunzione: ${situazioneTFR?.data_assunzione || 'N/D'}`} icon={Calendar} color="#1e293b" />
            <MetricCard label="Ultimo Accantonamento" value={formatEuro(situazioneTFR?.ultimo_accantonamento?.importo || 0)} subtext={`Anno: ${situazioneTFR?.ultimo_accantonamento?.anno || 'N/D'}`} icon={ArrowDownCircle} color="#10b981" bgColor="#f0fdf4" />
            <MetricCard label="Anticipi Erogati" value={formatEuro(situazioneTFR?.anticipi_totali || 0)} subtext={`${situazioneTFR?.numero_anticipi || 0} anticipi`} icon={ArrowUpCircle} color="#f59e0b" bgColor="#fffbeb" />
          </PageGrid>
        ) : activeTab === 'accantonamenti' ? (
          <PageSection title="Storico Accantonamenti">
            {situazioneTFR?.storico_accantonamenti?.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Anno</th>
                  <th style={{ padding: 12, textAlign: 'right', fontWeight: 600 }}>Retribuzione</th>
                  <th style={{ padding: 12, textAlign: 'right', fontWeight: 600 }}>Quota TFR</th>
                  <th style={{ padding: 12, textAlign: 'right', fontWeight: 600 }}>Rivalutazione</th>
                </tr></thead>
                <tbody>
                  {situazioneTFR.storico_accantonamenti.map((acc, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: 12 }}>{acc.anno}</td>
                      <td style={{ padding: 12, textAlign: 'right' }}>{formatEuro(acc.retribuzione_annua)}</td>
                      <td style={{ padding: 12, textAlign: 'right', fontWeight: 600, color: '#10b981' }}>{formatEuro(acc.quota_tfr)}</td>
                      <td style={{ padding: 12, textAlign: 'right', color: '#3b82f6' }}>{formatEuro(acc.rivalutazione)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (<PageEmpty icon="📥" message="Nessun accantonamento registrato" />)}
          </PageSection>
        ) : activeTab === 'liquidazioni' ? (
          <PageSection title="Storico Liquidazioni e Anticipi">
            {situazioneTFR?.storico_liquidazioni?.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Data</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Motivo</th>
                  <th style={{ padding: 12, textAlign: 'right', fontWeight: 600 }}>Lordo</th>
                  <th style={{ padding: 12, textAlign: 'right', fontWeight: 600 }}>Netto</th>
                </tr></thead>
                <tbody>
                  {situazioneTFR.storico_liquidazioni.map((liq, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: 12 }}>{liq.data}</td>
                      <td style={{ padding: 12 }}>
                        <span style={{ padding: '2px 8px', background: liq.motivo === 'anticipo' ? '#fef3c7' : '#fee2e2', color: liq.motivo === 'anticipo' ? '#92400e' : '#dc2626', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{liq.motivo}</span>
                      </td>
                      <td style={{ padding: 12, textAlign: 'right' }}>{formatEuro(liq.importo_lordo)}</td>
                      <td style={{ padding: 12, textAlign: 'right', fontWeight: 600, color: '#10b981' }}>{formatEuro(liq.importo_netto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (<PageEmpty icon="📤" message="Nessuna liquidazione registrata" />)}
          </PageSection>
        ) : null}
      </div>

      {/* Info Box */}
      <PageSection title="Calcolo TFR" icon="ℹ️" style={{ marginTop: 24 }}>
        <ul style={{ margin: 0, paddingLeft: 18, color: '#0c4a6e', fontSize: 12, lineHeight: 1.8 }}>
          <li><strong>Quota annuale</strong>: Retribuzione annua ÷ 13,5 (art. 2120 c.c.)</li>
          <li><strong>Rivalutazione</strong>: 1,5% fisso + 75% indice ISTAT</li>
          <li><strong>Tassazione</strong>: Aliquota separata ~23% (media quinquennio)</li>
          <li><strong>Anticipo</strong>: Max 70% del TFR maturato (dopo 8 anni)</li>
        </ul>
      </PageSection>
    </PageLayout>
  );
}
