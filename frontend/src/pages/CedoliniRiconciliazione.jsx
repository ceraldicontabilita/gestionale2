/**
 * CedoliniRiconciliazione.jsx
 * 
 * Gestione Buste Paga - Stile Dipendenti in Cloud
 * Features:
 * - Tabs per mesi con conteggi e totali
 * - Tabella cedolini per mese
 * - Dettaglio cedolino con pannello laterale
 * - Caricamento PDF buste paga
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../api';
import { useAnnoGlobale } from '../contexts/AnnoContext';
import { PageLayout } from '../components/PageLayout';
import { 
  ChevronLeft, ChevronRight, RefreshCw, Upload, Download,
  Search, FileText, MoreHorizontal, X, Calendar,
  Check, Euro, User, Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { STYLES, COLORS, button, badge, formatEuro, formatDateIT } from '../lib/utils';

// Hook per rilevare mobile
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return isMobile;
};

// Mesi con chiavi
const MESI = [
  { key: 1, label: 'Gennaio', short: 'Gen' },
  { key: 2, label: 'Febbraio', short: 'Feb' },
  { key: 3, label: 'Marzo', short: 'Mar' },
  { key: 4, label: 'Aprile', short: 'Apr' },
  { key: 5, label: 'Maggio', short: 'Mag' },
  { key: 6, label: 'Giugno', short: 'Giu' },
  { key: 7, label: 'Luglio', short: 'Lug' },
  { key: 8, label: 'Agosto', short: 'Ago' },
  { key: 9, label: 'Settembre', short: 'Set' },
  { key: 10, label: 'Ottobre', short: 'Ott' },
  { key: 11, label: 'Novembre', short: 'Nov' },
  { key: 12, label: 'Dicembre', short: 'Dic' },
  { key: 13, label: '13esima', short: '13°' },
  { key: 14, label: '14esima', short: '14°' },
];

// Formatta importo

// Formatta importo in formato italiano (es. € 1.549)
const formatEuroItaliano = (value) => {
  if (!value || value === 0) return '-';
  const formatted = Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return '€ ' + formatted;
};

// Formatta data
const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

const formatDateShort = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('it-IT');
  } catch {
    return dateStr;
  }
};

export default function CedoliniRiconciliazione() {
  const { anno, setAnno } = useAnnoGlobale();
  const [loading, setLoading] = useState(true);
  const [cedolini, setCedolini] = useState([]);
  const [employees, setEmployees] = useState([]);
  const isMobile = useIsMobile();
  
  // Filtri
  const [meseSelezionato, setMeseSelezionato] = useState(1);
  const [filtroEmployee, setFiltroEmployee] = useState('');
  const [searchText, setSearchText] = useState('');
  
  // Dettaglio cedolino
  const [showDettaglio, setShowDettaglio] = useState(false);
  const [cedolinoSelezionato, setCedolinoSelezionato] = useState(null);
  
  // Upload
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Carica dati
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      const [cedRes, empRes] = await Promise.all([
        api.get(`/api/cedolini?anno=${anno}`),
        api.get('/api/employees?limit=200')
      ]);
      
      const cedoliniData = cedRes.data.cedolini || cedRes.data || [];
      setCedolini(cedoliniData);
      
      // Estrai lista dipendenti SOLO dai cedolini (più affidabile)
      const dipendentiMap = new Map();
      cedoliniData.forEach(c => {
        const nome = c.dipendente_nome || c.nome_dipendente || c.employee_nome;
        if (nome) {
          const nomeKey = nome.toUpperCase().trim();
          if (!dipendentiMap.has(nomeKey)) {
            dipendentiMap.set(nomeKey, {
              id: c.dipendente_id || nomeKey,
              nome_completo: nome.toUpperCase().trim() // Usa sempre MAIUSCOLO per consistenza
            });
          }
        }
      });
      
      // Ordina per nome
      const employeesList = Array.from(dipendentiMap.values())
        .sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));
      setEmployees(employeesList);
      
    } catch (error) {
      console.error('Errore caricamento:', error);
    } finally {
      setLoading(false);
    }
  }, [anno]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calcola stats per mese
  const stats = useMemo(() => {
    const result = {};
    MESI.forEach(m => {
      const meseCedolini = cedolini.filter(c => c.mese === m.key);
      result[m.key] = {
        count: meseCedolini.length,
        totale: meseCedolini.reduce((sum, c) => sum + (c.netto || c.netto_mese || 0), 0)
      };
    });
    return result;
  }, [cedolini]);

  // Filtra cedolini
  const cedoliniFiltrati = useMemo(() => {
    return cedolini.filter(c => {
      // Se è selezionato un dipendente, mostra TUTTE le sue buste (tutti i mesi)
      // Altrimenti mostra solo il mese selezionato
      if (!filtroEmployee && c.mese !== meseSelezionato) return false;
      
      if (filtroEmployee) {
        // Filtra per nome dipendente (più affidabile di dipendente_id)
        const nome = (c.dipendente_nome || c.nome_dipendente || c.employee_nome || '').toUpperCase();
        if (!nome.includes(filtroEmployee.toUpperCase())) return false;
      }
      if (searchText) {
        const search = searchText.toLowerCase();
        const nome = (c.dipendente_nome || c.nome_dipendente || c.employee_nome || '').toLowerCase();
        return nome.includes(search);
      }
      return true;
    }).sort((a, b) => {
      // Ordina per mese quando si vede un singolo dipendente
      if (filtroEmployee) {
        return (a.mese || 0) - (b.mese || 0);
      }
      return 0;
    });
  }, [cedolini, meseSelezionato, filtroEmployee, searchText]);

  // Apri dettaglio
  const openDettaglio = async (cedolino) => {
    setCedolinoSelezionato(cedolino);
    setShowDettaglio(true);
    
    // Recupera i dati completi del cedolino (incluso pdf_data) se ha un id
    if (cedolino.id) {
      try {
        const res = await api.get(`/api/cedolini/${cedolino.id}`);
        if (res.data) {
          setCedolinoSelezionato(prev => ({
            ...prev,
            ...res.data
          }));
        }
      } catch (error) {
        console.error('Errore recupero dettaglio cedolino:', error);
      }
    }
  };

  // Upload PDF
  const handleUploadPDF = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/api/employees/paghe/upload-pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(`Caricato: ${res.data?.cedolini_creati || 0} cedolini`);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Errore upload');
    } finally {
      setUploading(false);
      e.target.value = '';
      setShowUpload(false);
    }
  };

  // Naviga anno
  const navigateAnno = (delta) => {
    setAnno(prev => prev + delta);
  };

  // Get nome dipendente
  const getNomeDipendente = (ced) => {
    return ced.dipendente_nome || ced.nome_dipendente || ced.employee_nome || 'N/D';
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <RefreshCw style={{ width: 32, height: 32, animation: 'spin 1s linear infinite', color: '#3b82f6' }} />
      </div>
    );
  }

  return (
    <PageLayout title="Buste Paga" subtitle="Gestione cedolini e buste paga dipendenti">
    <div style={{ maxWidth: 1400, margin: '0 auto' }} data-testid="cedolini-page">
      {/* Header - RESPONSIVE */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        marginBottom: 20,
        padding: '15px 16px',
        background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%)',
        borderRadius: 12,
        color: 'white',
        gap: 12
      }}>
        {/* Titolo e Anno */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 'bold' }}>📄 Buste Paga</h1>
            <p className="hidden sm:block" style={{ margin: '4px 0 0 0', fontSize: 13, opacity: 0.9 }}>
              Gestione cedolini e buste paga dipendenti
            </p>
          </div>
          
          {/* Navigazione Anno */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => navigateAnno(-1)}
              style={{
                padding: '8px 10px',
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                color: 'white'
              }}
            >
              <ChevronLeft style={{ width: 18, height: 18 }} />
            </button>
            <span style={{ 
              padding: '8px 16px', 
              background: 'rgba(255,255,255,0.95)', 
              color: '#1e3a5f',
              borderRadius: 6,
              fontWeight: 'bold',
              fontSize: 16
            }}>
              {anno}
            </span>
            <button
              onClick={() => navigateAnno(1)}
              style={{
                padding: '8px 10px',
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                color: 'white'
              }}
            >
              <ChevronRight style={{ width: 18, height: 18 }} />
            </button>
          </div>
        </div>
        
        {/* Bottoni Azioni */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button 
            onClick={loadData}
            style={{ 
              padding: '10px 16px',
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <RefreshCw style={{ width: 16, height: 16 }} />
            <span className="hidden sm:inline">Aggiorna</span>
          </button>
          <button 
            onClick={() => setShowUpload(true)}
            style={{ 
              flex: '1 1 auto',
              padding: '10px 16px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontSize: 14
            }}
            data-testid="btn-carica-cedolino"
          >
            <Upload style={{ width: 16, height: 16 }} />
            <span>Carica buste paga</span>
          </button>
        </div>
      </div>

      {/* Tabs Mesi con Stats - LAYOUT RESPONSIVE */}
      <div style={{ 
        background: 'white', 
        borderRadius: 12, 
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        marginBottom: 20,
        overflow: 'hidden'
      }}>
        {/* Mobile: Select dropdown per mesi */}
        {isMobile && (
          <div style={{ padding: '12px', background: '#f1f5f9' }}>
            <select
              value={meseSelezionato}
              onChange={(e) => setMeseSelezionato(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '16px',
                fontWeight: 600,
                border: '2px solid #1e3a5f',
                borderRadius: 8,
                background: 'white',
                color: '#1e3a5f'
              }}
              data-testid="select-mese-mobile"
            >
              {MESI.map(mese => {
                const meseStats = stats[mese.key] || { count: 0, totale: 0 };
                return (
                  <option key={mese.key} value={mese.key}>
                    {mese.label} - {formatEuroItaliano(meseStats.totale)}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {/* Desktop/Tablet: Grid tabs */}
        {!isMobile && (
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(14, 1fr)',
            gap: 4,
            padding: '12px 12px 0 12px',
            background: '#f1f5f9'
          }}>
            {MESI.map(mese => {
              const meseStats = stats[mese.key] || { count: 0, totale: 0 };
              const isActive = meseSelezionato === mese.key;
              
              return (
                <button
                  key={mese.key}
                  onClick={() => setMeseSelezionato(mese.key)}
                  style={{
                    padding: '10px 4px',
                    minWidth: 0,
                    background: isActive ? COLORS.primary : '#f8fafc',
                    border: isActive ? 'none' : '1px solid #e2e8f0',
                    borderRadius: isActive ? '8px 8px 0 0' : 8,
                    borderBottom: isActive ? `3px solid ${COLORS.success}` : 'none',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s',
                    boxShadow: isActive ? '0 -2px 8px rgba(0,0,0,0.1)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  data-testid={`tab-mese-${mese.key}`}
                >
                  <div style={{ 
                    fontSize: 12, 
                    fontWeight: 700,
                    color: isActive ? 'white' : COLORS.primary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px',
                    marginBottom: 2
                  }}>
                    {mese.short}
                  </div>
                  <div style={{ 
                    fontSize: 10, 
                    color: isActive ? 'rgba(255,255,255,0.95)' : '#64748b',
                    fontWeight: 600,
                    whiteSpace: 'nowrap'
                  }}>
                    {formatEuroItaliano(meseStats.totale)}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Filtri - RESPONSIVE */}
        <div style={{ 
          padding: '12px 16px', 
          display: 'flex', 
          gap: 8, 
          alignItems: 'center',
          flexWrap: 'wrap',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <select
            value={filtroEmployee}
            onChange={(e) => setFiltroEmployee(e.target.value)}
            style={{
              padding: '10px 12px',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              fontSize: 14,
              flex: '1 1 150px',
              minWidth: 0,
              maxWidth: '100%'
            }}
            data-testid="filtro-employee"
          >
            <option value="">Tutti i dipendenti</option>
            {employees.map(e => (
              <option key={e.id || e.nome_completo} value={e.nome_completo}>{e.nome_completo}</option>
            ))}
          </select>
          
          <div style={{ position: 'relative', flex: '1 1 150px', minWidth: 0 }}>
            <Search style={{ 
              position: 'absolute', 
              left: 10, 
              top: '50%', 
              transform: 'translateY(-50%)',
              width: 16, 
              height: 16, 
              color: '#9ca3af' 
            }} />
            <input
              type="text"
              placeholder="Cerca"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px 10px 36px',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                fontSize: 14
              }}
              data-testid="search-cedolini"
            />
          </div>
          
          {!isMobile && (
            <button
              style={{
                padding: '10px 16px',
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap'
              }}
            >
              <Download style={{ width: 14, height: 14 }} />
              Esporta
            </button>
          )}
        </div>

        {/* Vista Mobile - Card Layout */}
        {isMobile && (
          <div style={{ padding: '12px' }}>
            {cedoliniFiltrati.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
                <FileText style={{ width: 48, height: 48, margin: '0 auto 16px', opacity: 0.3 }} />
                <p style={{ margin: 0 }}>Nessun cedolino per {MESI.find(m => m.key === meseSelezionato)?.label} {anno}</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {cedoliniFiltrati.map((cedolino, idx) => {
                  const nome = getNomeDipendente(cedolino);
                  return (
                    <div 
                      key={cedolino.id || idx} 
                      onClick={() => openDettaglio(cedolino)}
                      style={{ 
                        background: '#f9fafb', 
                        borderRadius: 10, 
                        padding: 16,
                        border: '1px solid #e5e7eb',
                        cursor: 'pointer'
                      }}
                      data-testid={`card-cedolino-${idx}`}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ 
                            width: 36, height: 36, borderRadius: '50%', 
                            background: '#e0e7ff', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 13, fontWeight: 600, color: '#4338ca'
                          }}>
                            {nome.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#1e3a5f', fontSize: 15 }}>{nome}</div>
                            <div style={{ fontSize: 12, color: '#6b7280' }}>
                              {cedolino.periodo || `${MESI.find(m => m.key === cedolino.mese)?.label || ''} ${cedolino.anno}`}
                            </div>
                          </div>
                        </div>
                        {cedolino.pagato ? (
                          <span style={{ 
                            padding: '4px 10px', background: '#dcfce7', color: '#166534', 
                            borderRadius: 12, fontSize: 11, fontWeight: 600 
                          }}>
                            ✓ Pagato
                          </span>
                        ) : (
                          <span style={{ 
                            padding: '4px 10px', background: '#fef3c7', color: '#92400e', 
                            borderRadius: 12, fontSize: 11, fontWeight: 600 
                          }}>
                            Da pagare
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>Netto a pagare</span>
                        <span style={{ fontSize: 20, fontWeight: 700, color: '#166534' }}>
                          {formatEuro(cedolino.netto || cedolino.netto_mese)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Vista Desktop - Tabella */}
        {!isMobile && (
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ width: 40, padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>
                  <input type="checkbox" />
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, color: '#6b7280', fontSize: 13, borderBottom: '1px solid #e5e7eb' }}>
                  Dipendente ↑
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, color: '#6b7280', fontSize: 13, borderBottom: '1px solid #e5e7eb' }}>
                  Mese di competenza
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500, color: '#6b7280', fontSize: 13, borderBottom: '1px solid #e5e7eb' }}>
                  Netto
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 500, color: '#6b7280', fontSize: 13, borderBottom: '1px solid #e5e7eb' }}>
                  Stato
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, color: '#6b7280', fontSize: 13, borderBottom: '1px solid #e5e7eb' }}>
                  Data emissione
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 500, color: '#6b7280', fontSize: 13, borderBottom: '1px solid #e5e7eb' }}>
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody>
              {cedoliniFiltrati.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
                    <FileText style={{ width: 48, height: 48, margin: '0 auto 16px', opacity: 0.3 }} />
                    <p style={{ margin: 0 }}>Nessun cedolino per {MESI.find(m => m.key === meseSelezionato)?.label} {anno}</p>
                  </td>
                </tr>
              ) : (
                cedoliniFiltrati.map((cedolino, idx) => {
                  const nome = getNomeDipendente(cedolino);
                  return (
                    <tr key={cedolino.id || idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <input type="checkbox" />
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ 
                            width: 32, height: 32, borderRadius: '50%', 
                            background: '#e0e7ff', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 600, color: '#4338ca'
                          }}>
                            {nome.substring(0, 2).toUpperCase()}
                          </div>
                          <span 
                            style={{ color: '#3b82f6', fontWeight: 500, cursor: 'pointer' }}
                            onClick={() => openDettaglio(cedolino)}
                          >
                            {nome}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#6b7280' }}>
                        {cedolino.periodo || `${MESI.find(m => m.key === cedolino.mese)?.label || ''} ${cedolino.anno}`}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500 }}>
                        {formatEuro(cedolino.netto || cedolino.netto_mese)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {cedolino.pagato ? (
                          <span style={{ 
                            padding: '4px 10px', background: '#dcfce7', color: '#166534', 
                            borderRadius: 12, fontSize: 11, fontWeight: 600 
                          }}>
                            ✓ Pagato
                          </span>
                        ) : cedolino.stato === 'confermato' ? (
                          <span style={{ 
                            padding: '4px 10px', background: '#dbeafe', color: '#1e40af', 
                            borderRadius: 12, fontSize: 11, fontWeight: 600 
                          }}>
                            Confermato
                          </span>
                        ) : (
                          <span style={{ 
                            padding: '4px 10px', background: '#fef3c7', color: '#92400e', 
                            borderRadius: 12, fontSize: 11, fontWeight: 600 
                          }}>
                            Da pagare
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#6b7280' }}>
                        {formatDateShort(cedolino.created_at || cedolino.data_emissione)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                          <button
                            onClick={() => openDettaglio(cedolino)}
                            style={{
                              padding: '6px 12px', background: 'transparent',
                              border: '1px solid #e5e7eb', borderRadius: 6,
                              cursor: 'pointer', fontSize: 12, color: '#3b82f6', fontWeight: 500
                            }}
                            data-testid={`vedi-dettaglio-${idx}`}
                          >
                            Vedi dettaglio
                          </button>
                          <button style={{
                            padding: '6px 8px', background: 'transparent',
                            border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer'
                          }}>
                            <MoreHorizontal style={{ width: 14, height: 14, color: '#6b7280' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        )}

        {/* Totale - RESPONSIVE */}
        {cedoliniFiltrati.length > 0 && (
          <div style={{ 
            padding: '14px 16px', 
            background: '#f0fdf4', 
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8
          }}>
            <span style={{ fontWeight: 500, color: '#166534', fontSize: 14 }}>
              Totale {filtroEmployee ? filtroEmployee : MESI.find(m => m.key === meseSelezionato)?.label}: {cedoliniFiltrati.length} buste
            </span>
            <span style={{ fontWeight: 700, color: '#166534', fontSize: 20 }}>
              {formatEuro(cedoliniFiltrati.reduce((sum, c) => sum + (c.netto || c.netto_mese || 0), 0))}
            </span>
          </div>
        )}
      </div>

      {/* Modale Dettaglio - RESPONSIVE */}
      {showDettaglio && cedolinoSelezionato && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row',
          zIndex: 1000,
          overflow: 'auto'
        }}>
          {/* PDF Viewer - Nascosto su mobile */}
          {!isMobile && (
            <div style={{ flex: 1, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {cedolinoSelezionato.pdf_data ? (
                <iframe 
                  src={`data:application/pdf;base64,${cedolinoSelezionato.pdf_data}`} 
                  style={{ width: '100%', height: '100%', border: 'none' }} 
                  title="Busta Paga PDF" 
                />
              ) : cedolinoSelezionato.pdf_url ? (
                <iframe src={cedolinoSelezionato.pdf_url} style={{ width: '100%', height: '100%', border: 'none' }} title="Busta Paga PDF" />
              ) : (
                <div style={{ textAlign: 'center', color: '#9ca3af' }}>
                  <FileText style={{ width: 64, height: 64, margin: '0 auto 16px', opacity: 0.3 }} />
                  <p>Nessun PDF allegato</p>
                </div>
              )}
            </div>
          )}

          {/* Pannello Dettaglio - Full width su mobile */}
          <div style={{ 
            width: isMobile ? '100%' : 400, 
            background: 'white', 
            boxShadow: '-4px 0 20px rgba(0,0,0,0.1)', 
            display: 'flex', 
            flexDirection: 'column',
            height: isMobile ? '100%' : 'auto',
            overflow: 'auto'
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'sticky', top: 0, background: 'white', zIndex: 10 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, color: '#1e3a5f' }}>
                  {cedolinoSelezionato.periodo || `${MESI.find(m => m.key === cedolinoSelezionato.mese)?.label} ${cedolinoSelezionato.anno}`}
                </h2>
                <p style={{ margin: '4px 0 0 0', color: '#6b7280' }}>{getNomeDipendente(cedolinoSelezionato)}</p>
              </div>
              <button onClick={() => setShowDettaglio(false)} style={{ padding: 8, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X style={{ width: 20, height: 20, color: '#6b7280' }} />
              </button>
            </div>

            <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
              {/* PDF Download buttons su mobile */}
              {isMobile && cedolinoSelezionato.pdf_data && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Documento PDF</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <a 
                      href={`data:application/pdf;base64,${cedolinoSelezionato.pdf_data}`}
                      download={`cedolino_${getNomeDipendente(cedolinoSelezionato).replace(/\s+/g, '_')}_${cedolinoSelezionato.mese}_${cedolinoSelezionato.anno}.pdf`}
                      style={{
                        flex: 1, padding: '12px', background: '#3b82f6', color: 'white',
                        borderRadius: 8, textAlign: 'center', textDecoration: 'none',
                        fontWeight: 600, fontSize: 14
                      }}
                    >
                      📥 Scarica PDF
                    </a>
                    <button
                      onClick={() => {
                        const pdfWindow = window.open('', '_blank');
                        pdfWindow.document.write(`<iframe width="100%" height="100%" src="data:application/pdf;base64,${cedolinoSelezionato.pdf_data}"></iframe>`);
                      }}
                      style={{
                        flex: 1, padding: '12px', background: '#f1f5f9', color: '#1e3a5f',
                        borderRadius: 8, border: 'none', cursor: 'pointer',
                        fontWeight: 600, fontSize: 14
                      }}
                    >
                      👁️ Visualizza
                    </button>
                  </div>
                </div>
              )}

                <h3 style={{ margin: '0 0 16px 0', fontSize: 14, color: '#374151' }}>Informazioni Generali</h3>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Dipendente</label>
                  <div style={{ padding: '10px 12px', background: '#f9fafb', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: '#4338ca' }}>
                      {getNomeDipendente(cedolinoSelezionato).substring(0, 2).toUpperCase()}
                    </div>
                    <span>{getNomeDipendente(cedolinoSelezionato)}</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Netto</label>
                    <div style={{ padding: '10px 12px', background: '#f0fdf4', borderRadius: 6, fontWeight: 600, color: '#166534' }}>
                      {formatEuro(cedolinoSelezionato.netto || cedolinoSelezionato.netto_mese)}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Lordo</label>
                    <div style={{ padding: '10px 12px', background: '#f9fafb', borderRadius: 6 }}>
                      {formatEuro(cedolinoSelezionato.lordo)}
                    </div>
                  </div>
                </div>

                {cedolinoSelezionato.costo_azienda && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Costo Azienda</label>
                    <div style={{ padding: '10px 12px', background: '#fef2f2', borderRadius: 6, fontWeight: 500, color: '#991b1b' }}>
                      {formatEuro(cedolinoSelezionato.costo_azienda)}
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>INPS Dipendente</label>
                    <div style={{ padding: '10px 12px', background: '#f9fafb', borderRadius: 6 }}>
                      {formatEuro(cedolinoSelezionato.inps_dipendente)}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>IRPEF</label>
                    <div style={{ padding: '10px 12px', background: '#f9fafb', borderRadius: 6 }}>
                      {formatEuro(cedolinoSelezionato.irpef)}
                    </div>
                  </div>
                </div>

                {cedolinoSelezionato.ore_lavorate && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Ore Lavorate</label>
                      <div style={{ padding: '10px 12px', background: '#f9fafb', borderRadius: 6 }}>
                        {cedolinoSelezionato.ore_lavorate}h
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Giorni</label>
                      <div style={{ padding: '10px 12px', background: '#f9fafb', borderRadius: 6 }}>
                        {cedolinoSelezionato.giorni_lavorati}gg
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Stato Pagamento</label>
                  <div style={{ padding: '10px 12px', background: '#f9fafb', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{cedolinoSelezionato.pagato ? '✓ Pagato' : 'Da pagare'}</span>
                    {cedolinoSelezionato.metodo_pagamento && (
                      <span style={{ fontSize: 12, color: '#6b7280' }}>{cedolinoSelezionato.metodo_pagamento}</span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ padding: '16px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 12, justifyContent: 'flex-end', position: 'sticky', bottom: 0, background: 'white' }}>
                <button onClick={() => setShowDettaglio(false)} style={{ padding: '12px 20px', background: 'white', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', fontWeight: 500, fontSize: 14 }}>
                  Chiudi
                </button>
                <button style={{ padding: '12px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 500, fontSize: 14 }}>
                  Aggiorna dati
                </button>
              </div>
            </div>
        </div>
      )}

      {/* Modale Upload - RESPONSIVE */}
      {showUpload && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: 16
        }}>
          <div style={{ background: 'white', borderRadius: 12, width: '100%', maxWidth: 450, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Carica Buste Paga</h2>
              <button onClick={() => setShowUpload(false)} style={{ padding: 8, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>

            <div style={{ 
              padding: 24, background: '#f9fafb', borderRadius: 8,
              border: '2px dashed #e5e7eb', textAlign: 'center'
            }}>
              <Upload style={{ width: 40, height: 40, margin: '0 auto 16px', color: '#3b82f6' }} />
              <p style={{ margin: '0 0 8px 0', fontWeight: 500, fontSize: 15 }}>
                {uploading ? 'Caricamento in corso...' : 'Carica PDF buste paga'}
              </p>
              <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#6b7280' }}>
                PDF singolo o archivio ZIP/RAR
              </p>
              <label style={{
                display: 'inline-block', padding: '12px 24px',
                background: '#3b82f6', color: 'white', borderRadius: 8,
                cursor: 'pointer', fontWeight: 600, fontSize: 15
              }}>
                Seleziona file
                <input type="file" accept=".pdf,.zip,.rar" onChange={handleUploadPDF} style={{ display: 'none' }} />
              </label>
            </div>

            <div style={{ marginTop: 16, padding: 12, background: '#eff6ff', borderRadius: 6, fontSize: 13, color: '#1e40af' }}>
              <strong>Formati supportati:</strong> PDF, ZIP, RAR
            </div>
          </div>
        </div>
      )}
    </div>
    </PageLayout>
  );
}
