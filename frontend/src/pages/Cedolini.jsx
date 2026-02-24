/**
 * Cedolini.jsx
 * 
 * Gestione Buste Paga (Cedolini) - Stile Dipendenti in Cloud
 * Features:
 * - Visualizzazione cedolini per mese
 * - Caricamento PDF buste paga
 * - Dettaglio cedolino con visualizzatore PDF
 * - URL descrittivi per ogni cedolino
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import { useAnnoGlobale } from '../contexts/AnnoContext';
import { formatEuro, STYLES, COLORS, button, badge } from '../lib/utils';
import { PageLayout } from '../components/PageLayout';
import { 
  ChevronLeft, ChevronRight, RefreshCw, Upload, Download,
  Search, FileText, Eye, MoreHorizontal, X, Calendar,
  User, Euro, Check
} from 'lucide-react';
import { toast } from 'sonner';
import Breadcrumb from '../components/Breadcrumb';
import { toSlug, updatePageTitle } from '../utils/urlHelpers';

// Mesi
const MESI = [
  { key: 'gennaio', label: 'Gennaio', num: 1 },
  { key: 'febbraio', label: 'Febbraio', num: 2 },
  { key: 'marzo', label: 'Marzo', num: 3 },
  { key: 'aprile', label: 'Aprile', num: 4 },
  { key: 'maggio', label: 'Maggio', num: 5 },
  { key: 'giugno', label: 'Giugno', num: 6 },
  { key: 'luglio', label: 'Luglio', num: 7 },
  { key: 'agosto', label: 'Agosto', num: 8 },
  { key: 'settembre', label: 'Settembre', num: 9 },
  { key: 'ottobre', label: 'Ottobre', num: 10 },
  { key: 'novembre', label: 'Novembre', num: 11 },
  { key: 'dicembre', label: 'Dicembre', num: 12 },
  { key: '13esima', label: '13esima', num: 13 },
  { key: '14esima', label: '14esima', num: 14 },
];

// Formatta importo breve (es. €17k)
const formatEuroShort = (value) => {
  if (!value) return '€ 0';
  if (value >= 1000) {
    return `€ ${Math.round(value / 1000)}k`;
  }
  return formatEuro(value);
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

// Converti mese numerico in chiave stringa
const getMeseKey = (meseNum) => {
  const map = {
    1: 'gennaio', 2: 'febbraio', 3: 'marzo', 4: 'aprile',
    5: 'maggio', 6: 'giugno', 7: 'luglio', 8: 'agosto',
    9: 'settembre', 10: 'ottobre', 11: 'novembre', 12: 'dicembre',
    13: '13esima', 14: '14esima'
  };
  return map[meseNum] || 'gennaio';
};

export default function Cedolini() {
  const navigate = useNavigate();
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [cedolini, setCedolini] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [stats, setStats] = useState({});
  
  // Anno dal context globale
  const { anno } = useAnnoGlobale();
  const [meseSelezionato, setMeseSelezionato] = useState('gennaio');
  const [filtroEmployee, setFiltroEmployee] = useState('');
  const [searchText, setSearchText] = useState('');
  
  // Aggiorna title pagina
  useEffect(() => {
    updatePageTitle('Buste Paga', 'Dipendenti');
  }, []);
  
  // Dettaglio cedolino
  const [showDettaglio, setShowDettaglio] = useState(false);
  const [cedolinoSelezionato, setCedolinoSelezionato] = useState(null);
  
  // Upload
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    employee_id: '',
    mese: 'gennaio',
    anno: new Date().getFullYear(),
    netto: '',
    data_emissione: '',
    note: ''
  });
  
  // Cedolini da rivedere
  const [showDaRivedere, setShowDaRivedere] = useState(false);
  const [cedoliniDaRivedere, setCedoliniDaRivedere] = useState([]);
  const [statsParsingData, setStatsParsingData] = useState(null);
  
  // Carica cedolini da rivedere
  const loadDaRivedere = async () => {
    try {
      const [daRivedereRes, statsRes] = await Promise.all([
        api.get('/api/employees/cedolini/da-rivedere'),
        api.get('/api/employees/cedolini/statistiche-parsing')
      ]);
      setCedoliniDaRivedere(daRivedereRes.data.cedolini || []);
      setStatsParsingData(statsRes.data);
    } catch (error) {
      console.error('Errore caricamento cedolini da rivedere:', error);
    }
  };

  // Carica dati
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      const [cedRes, empRes] = await Promise.all([
        api.get(`/api/cedolini?anno=${anno}`),
        api.get('/api/employees?limit=200')
      ]);
      
      // Adatta struttura cedolini dal backend
      const cedoliniData = (cedRes.data.cedolini || []).map(c => ({
        ...c,
        employee_nome: c.dipendente_nome || c.nome_dipendente || 'N/D',
        employee_id: c.dipendente_id,
        // Converti mese numerico in chiave stringa
        mese: getMeseKey(c.mese)
      }));
      
      setCedolini(cedoliniData);
      
      // Calcola stats
      const statsCalc = {};
      MESI.forEach(m => {
        const meseCedolini = cedoliniData.filter(c => c.mese === m.key);
        statsCalc[m.key] = {
          count: meseCedolini.length,
          totale: meseCedolini.reduce((sum, c) => sum + (c.netto || 0), 0)
        };
      });
      setStats(statsCalc);
      
      // Normalizza employees
      const emps = (empRes.data.employees || empRes.data || [])
        .filter(e => e.status === 'attivo' || !e.status)
        .map(e => ({
          ...e,
          nome_completo: e.nome_completo || e.name || `${e.nome || ''} ${e.cognome || ''}`.trim()
        }));
      setEmployees(emps);
      
    } catch (error) {
      console.error('Errore caricamento:', error);
      toast.error('Errore caricamento cedolini');
    } finally {
      setLoading(false);
    }
  }, [anno]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtra cedolini
  const cedoliniFiltrati = cedolini.filter(c => {
    if (c.mese !== meseSelezionato) return false;
    if (filtroEmployee && c.employee_id !== filtroEmployee) return false;
    if (searchText) {
      const search = searchText.toLowerCase();
      const nome = (c.employee_nome || '').toLowerCase();
      return nome.includes(search);
    }
    return true;
  });

  // Apri dettaglio con URL descrittivo
  const openDettaglio = async (cedolino) => {
    // Mostra subito il modale con i dati disponibili
    setCedolinoSelezionato(cedolino);
    setShowDettaglio(true);
    
    // Genera URL descrittivo
    const nome = toSlug(cedolino.employee_nome || cedolino.nome_dipendente || 'dipendente');
    const mese = getMeseKey(cedolino.mese);
    navigate(`/cedolini-calcolo/${nome}/cedolino-${mese}-${cedolino.anno || anno}`, { replace: true });
    
    // Aggiorna title
    updatePageTitle(
      `Cedolino ${cedolino.employee_nome || 'Dipendente'} - ${mese} ${cedolino.anno || anno}`,
      'Buste Paga'
    );
    
    // Recupera i dati completi del cedolino (incluso pdf_data) se ha un id
    if (cedolino.id) {
      try {
        const res = await api.get(`/api/cedolini/${cedolino.id}`);
        if (res.data) {
          setCedolinoSelezionato(prev => ({
            ...prev,
            ...res.data,
            employee_nome: prev.employee_nome || res.data.dipendente_nome
          }));
        }
      } catch (error) {
        console.error('Errore recupero dettaglio cedolino:', error);
      }
    }
  };
  
  // Chiudi dettaglio
  const closeDettaglio = () => {
    setCedolinoSelezionato(null);
    setShowDettaglio(false);
    navigate('/cedolini-calcolo', { replace: true });
    updatePageTitle('Buste Paga', 'Dipendenti');
  };

  // Upload cedolino
  const handleUpload = async () => {
    if (!uploadForm.employee_id || !uploadForm.netto) {
      toast.error('Compila tutti i campi obbligatori');
      return;
    }
    
    try {
      const res = await api.post('/api/cedolini', {
        ...uploadForm,
        netto: parseFloat(uploadForm.netto)
      });
      
      if (res.data.success) {
        toast.success('Cedolino caricato');
        setShowUpload(false);
        setUploadForm({
          employee_id: '',
          mese: 'gennaio',
          anno: anno,
          netto: '',
          data_emissione: '',
          note: ''
        });
        loadData();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Errore caricamento');
    }
  };

  // Naviga anno - rimosso perché ora usa context globale
  // I controlli anno sono nel header dell'app

  if (loading) {
    return (
      <PageLayout title="Buste Paga" icon="📄" subtitle="Caricamento...">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
          <RefreshCw style={{ width: 32, height: 32, animation: 'spin 1s linear infinite', color: '#3b82f6' }} />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Buste Paga" icon="📄" subtitle={`Gestione cedolini e buste paga - Anno ${anno}`}>
      <div data-testid="cedolini-page">
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <span style={{ 
            padding: '8px 20px', 
            background: '#1e3a5f', 
            color: 'white',
            borderRadius: 6,
            fontWeight: 'bold',
            fontSize: 18
          }}>
            {anno}
          </span>
          
          <button 
            onClick={() => setShowUpload(true)}
            style={{ 
              padding: '10px 20px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginLeft: 'auto'
            }}
            data-testid="btn-carica-cedolino"
          >
            <Upload style={{ width: 16, height: 16 }} />
            Carica buste paga
          </button>
          
          <button 
            onClick={() => { loadDaRivedere(); setShowDaRivedere(true); }}
            style={{ 
              padding: '10px 20px',
              background: cedoliniDaRivedere.length > 0 ? '#f59e0b' : '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
            data-testid="btn-cedolini-da-rivedere"
          >
            <Eye style={{ width: 16, height: 16 }} />
            Da rivedere {cedoliniDaRivedere.length > 0 && `(${cedoliniDaRivedere.length})`}
          </button>
        </div>

        {/* Tabs Mesi con Stats */}
        <div style={{ 
          background: 'white', 
          borderRadius: 12, 
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          marginBottom: 20,
          overflow: 'hidden'
        }}>
          {/* Grid di mesi - layout fisso a griglia */}
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(14, 1fr)',
          gap: 0,
          borderBottom: '2px solid #e5e7eb',
          background: '#f9fafb'
        }}>
          {MESI.map(mese => {
            const meseStats = stats[mese.key] || { count: 0, totale: 0 };
            const isActive = meseSelezionato === mese.key;
            
            return (
              <button
                key={mese.key}
                onClick={() => setMeseSelezionato(mese.key)}
                style={{
                  padding: '12px 4px',
                  background: isActive ? COLORS.primary : 'transparent',
                  border: 'none',
                  borderBottom: isActive ? `3px solid ${COLORS.success}` : '3px solid transparent',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s'
                }}
                data-testid={`tab-${mese.key}`}
              >
                <div style={{ 
                  fontSize: 11, 
                  fontWeight: 700,
                  color: isActive ? 'white' : COLORS.primary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  {mese.label.substring(0, 3)}
                </div>
                {meseStats.count > 0 ? (
                  <div style={{ 
                    fontSize: 10, 
                    color: isActive ? 'rgba(255,255,255,0.9)' : COLORS.gray,
                    marginTop: 4,
                    fontWeight: 600
                  }}>
                    {meseStats.count} • {formatEuroShort(meseStats.totale)}
                  </div>
                ) : (
                  <div style={{ 
                    fontSize: 10, 
                    color: isActive ? 'rgba(255,255,255,0.5)' : '#d1d5db',
                    marginTop: 4
                  }}>
                    -
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Filtri */}
        <div style={{ 
          padding: '12px 16px', 
          display: 'flex', 
          gap: 12, 
          alignItems: 'center',
          flexWrap: 'wrap',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <select
            value={filtroEmployee}
            onChange={(e) => setFiltroEmployee(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              fontSize: 13,
              minWidth: 200
            }}
            data-testid="filtro-employee"
          >
            <option value="">Seleziona dipendente</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>{e.nome_completo}</option>
            ))}
          </select>
          
          <div style={{ flex: 1 }} />
          
          <div style={{ position: 'relative' }}>
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
                padding: '8px 12px 8px 36px',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                fontSize: 13,
                width: 200
              }}
              data-testid="search-cedolini"
            />
          </div>
          
          <button
            style={{
              padding: '8px 16px',
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Download style={{ width: 14, height: 14 }} />
            Esporta
          </button>
        </div>

        {/* Tabella Cedolini */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ 
                  width: 40, 
                  padding: '12px 16px', 
                  textAlign: 'center',
                  borderBottom: '1px solid #e5e7eb'
                }}>
                  <input type="checkbox" />
                </th>
                <th style={{ 
                  padding: '12px 16px', 
                  textAlign: 'left',
                  fontWeight: 500,
                  color: '#6b7280',
                  fontSize: 13,
                  borderBottom: '1px solid #e5e7eb'
                }}>
                  Dipendente ↑
                </th>
                <th style={{ 
                  padding: '12px 16px', 
                  textAlign: 'left',
                  fontWeight: 500,
                  color: '#6b7280',
                  fontSize: 13,
                  borderBottom: '1px solid #e5e7eb'
                }}>
                  Mese di competenza
                </th>
                <th style={{ 
                  padding: '12px 16px', 
                  textAlign: 'right',
                  fontWeight: 500,
                  color: '#6b7280',
                  fontSize: 13,
                  borderBottom: '1px solid #e5e7eb'
                }}>
                  Netto
                </th>
                <th style={{ 
                  padding: '12px 16px', 
                  textAlign: 'left',
                  fontWeight: 500,
                  color: '#6b7280',
                  fontSize: 13,
                  borderBottom: '1px solid #e5e7eb'
                }}>
                  Descrizione
                </th>
                <th style={{ 
                  padding: '12px 16px', 
                  textAlign: 'left',
                  fontWeight: 500,
                  color: '#6b7280',
                  fontSize: 13,
                  borderBottom: '1px solid #e5e7eb'
                }}>
                  Data di emissione
                </th>
                <th style={{ 
                  padding: '12px 16px', 
                  textAlign: 'center',
                  fontWeight: 500,
                  color: '#6b7280',
                  fontSize: 13,
                  borderBottom: '1px solid #e5e7eb'
                }}>
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
                cedoliniFiltrati.map((cedolino, idx) => (
                  <tr 
                    key={cedolino.id || idx} 
                    style={{ borderBottom: '1px solid #e5e7eb' }}
                  >
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <input type="checkbox" />
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ 
                          width: 32, 
                          height: 32, 
                          borderRadius: '50%', 
                          background: '#e0e7ff', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          fontSize: 12,
                          fontWeight: 600,
                          color: '#4338ca'
                        }}>
                          {(cedolino.employee_nome || '??').substring(0, 2).toUpperCase()}
                        </div>
                        <span style={{ 
                          color: '#3b82f6', 
                          fontWeight: 500,
                          cursor: 'pointer'
                        }}
                          onClick={() => openDettaglio(cedolino)}
                        >
                          {cedolino.employee_nome || 'N/D'}
                        </span>
                        {cedolino.confermato && (
                          <Check style={{ width: 16, height: 16, color: '#22c55e' }} />
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#6b7280' }}>
                      {MESI.find(m => m.num === cedolino.mese)?.label || `Mese ${cedolino.mese}`} {cedolino.anno}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500 }}>
                      {formatEuro(cedolino.netto)}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#6b7280' }}>
                      {cedolino.descrizione || '-'}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#6b7280' }}>
                      {formatDate(cedolino.data_emissione)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                        <button
                          onClick={() => openDettaglio(cedolino)}
                          style={{
                            padding: '6px 12px',
                            background: 'transparent',
                            border: '1px solid #e5e7eb',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 12,
                            color: '#3b82f6',
                            fontWeight: 500
                          }}
                          data-testid={`vedi-dettaglio-${idx}`}
                        >
                          Vedi dettaglio
                        </button>
                        <button
                          style={{
                            padding: '6px 8px',
                            background: 'transparent',
                            border: '1px solid #e5e7eb',
                            borderRadius: 6,
                            cursor: 'pointer'
                          }}
                        >
                          <MoreHorizontal style={{ width: 14, height: 14, color: '#6b7280' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modale Dettaglio Cedolino */}
      {showDettaglio && cedolinoSelezionato && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'flex-end',
          zIndex: 1000
        }}>
          {/* PDF Viewer (left side) */}
          <div style={{ 
            flex: 1, 
            background: '#f3f4f6', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            flexDirection: 'column'
          }}>
            {cedolinoSelezionato.pdf_data ? (
              <iframe 
                src={`data:application/pdf;base64,${cedolinoSelezionato.pdf_data}`}
                style={{ width: '100%', height: '100%', border: 'none' }}
                title="Busta Paga PDF"
              />
            ) : cedolinoSelezionato.pdf_url ? (
              <iframe 
                src={cedolinoSelezionato.pdf_url} 
                style={{ width: '100%', height: '100%', border: 'none' }}
                title="Busta Paga PDF"
              />
            ) : (
              <div style={{ textAlign: 'center', color: '#9ca3af' }}>
                <FileText style={{ width: 64, height: 64, margin: '0 auto 16px', opacity: 0.3 }} />
                <p>Nessun PDF allegato</p>
              </div>
            )}
          </div>

          {/* Pannello Dettaglio (right side) */}
          <div style={{ 
            width: 400, 
            background: 'white', 
            boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Header Pannello */}
            <div style={{ 
              padding: '16px 20px', 
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, color: '#1e3a5f' }}>
                  {MESI.find(m => m.num === cedolinoSelezionato.mese)?.label || `Mese ${cedolinoSelezionato.mese}`} {cedolinoSelezionato.anno}
                </h2>
                <p style={{ margin: '4px 0 0 0', color: '#6b7280' }}>
                  {cedolinoSelezionato.employee_nome}
                </p>
              </div>
              <button
                onClick={closeDettaglio}
                style={{
                  padding: 8,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <X style={{ width: 20, height: 20, color: '#6b7280' }} />
              </button>
            </div>

            {/* Contenuto Pannello */}
            <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: 14, color: '#374151' }}>
                Informazioni Generali
              </h3>

              {/* Dipendente */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                  Dipendente *
                </label>
                <div style={{ 
                  padding: '10px 12px', 
                  background: '#f9fafb', 
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10
                }}>
                  <div style={{ 
                    width: 28, 
                    height: 28, 
                    borderRadius: '50%', 
                    background: '#e0e7ff', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#4338ca'
                  }}>
                    {(cedolinoSelezionato.employee_nome || '??').substring(0, 2).toUpperCase()}
                  </div>
                  <span>{cedolinoSelezionato.employee_nome}</span>
                </div>
              </div>

              {/* Stipendio Netto */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                  Stipendio netto *
                </label>
                <div style={{ 
                  padding: '10px 12px', 
                  background: '#f9fafb', 
                  borderRadius: 6,
                  fontWeight: 500
                }}>
                  {formatEuro(cedolinoSelezionato.netto)}
                </div>
              </div>

              {/* Mese/Anno di competenza */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                    Mese di competenza *
                  </label>
                  <div style={{ 
                    padding: '10px 12px', 
                    background: '#f9fafb', 
                    borderRadius: 6
                  }}>
                    {MESI.find(m => m.num === cedolinoSelezionato.mese)?.label || `Mese ${cedolinoSelezionato.mese}`}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                    Anno di competenza *
                  </label>
                  <div style={{ 
                    padding: '10px 12px', 
                    background: '#f9fafb', 
                    borderRadius: 6,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <ChevronLeft style={{ width: 14, height: 14, color: '#9ca3af' }} />
                    <span>{cedolinoSelezionato.anno}</span>
                    <ChevronRight style={{ width: 14, height: 14, color: '#9ca3af' }} />
                  </div>
                </div>
              </div>

              {/* Data emissione */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                  Data di emissione *
                </label>
                <div style={{ 
                  padding: '10px 12px', 
                  background: '#f9fafb', 
                  borderRadius: 6,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>{formatDate(cedolinoSelezionato.data_emissione)}</span>
                  <Calendar style={{ width: 14, height: 14, color: '#9ca3af' }} />
                </div>
              </div>

              {/* Note */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                  Note
                </label>
                <div style={{ 
                  padding: '10px 12px', 
                  background: '#f9fafb', 
                  borderRadius: 6,
                  minHeight: 80,
                  color: cedolinoSelezionato.note ? '#1f2937' : '#9ca3af'
                }}>
                  {cedolinoSelezionato.note || 'Nessuna nota'}
                </div>
              </div>

              {/* Allegati */}
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                  Allegati
                </label>
                <div style={{ 
                  padding: 16, 
                  background: '#f9fafb', 
                  borderRadius: 6,
                  border: '2px dashed #e5e7eb',
                  textAlign: 'center'
                }}>
                  <Upload style={{ width: 24, height: 24, margin: '0 auto 8px', color: '#3b82f6' }} />
                  <p style={{ margin: 0, fontSize: 13, color: '#3b82f6' }}>
                    Scegli file <span style={{ color: '#6b7280' }}>o trascina più file qui</span>
                  </p>
                </div>
                
                {(cedolinoSelezionato.pdf_data || cedolinoSelezionato.pdf_url) && (
                  <div style={{ 
                    marginTop: 12, 
                    padding: '10px 12px', 
                    background: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <FileText style={{ width: 20, height: 20, color: '#ef4444' }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>
                          Busta paga - {cedolinoSelezionato.employee_nome} - {MESI.find(m => m.num === cedolinoSelezionato.mese)?.label || `Mese ${cedolinoSelezionato.mese}`} {cedolinoSelezionato.anno}.pdf
                        </div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>
                          Caricato il {formatDate(cedolinoSelezionato.created_at)}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Download style={{ width: 16, height: 16, color: '#6b7280', cursor: 'pointer' }} />
                      <X style={{ width: 16, height: 16, color: '#6b7280', cursor: 'pointer' }} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Pannello */}
            <div style={{ 
              padding: '16px 20px', 
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              gap: 12,
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setShowDettaglio(false)}
                style={{
                  padding: '10px 20px',
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                Chiudi
              </button>
              <button
                style={{
                  padding: '10px 20px',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                Aggiorna dati
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale Upload */}
      {showUpload && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ 
            background: 'white', 
            borderRadius: 12, 
            width: 500,
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{ 
              padding: '16px 20px', 
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Carica Cedolino</h2>
              <button
                onClick={() => setShowUpload(false)}
                style={{ padding: 8, background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>

            <div style={{ padding: 20 }}>
              {/* Dipendente */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 6, fontWeight: 500 }}>
                  Dipendente *
                </label>
                <select
                  value={uploadForm.employee_id}
                  onChange={(e) => setUploadForm({ ...uploadForm, employee_id: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: 6
                  }}
                >
                  <option value="">Seleziona dipendente</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.nome_completo}</option>
                  ))}
                </select>
              </div>

              {/* Mese/Anno */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, marginBottom: 6, fontWeight: 500 }}>
                    Mese *
                  </label>
                  <select
                    value={uploadForm.mese}
                    onChange={(e) => setUploadForm({ ...uploadForm, mese: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #e5e7eb',
                      borderRadius: 6
                    }}
                  >
                    {MESI.map(m => (
                      <option key={m.key} value={m.key}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, marginBottom: 6, fontWeight: 500 }}>
                    Anno *
                  </label>
                  <input
                    type="number"
                    value={uploadForm.anno}
                    onChange={(e) => setUploadForm({ ...uploadForm, anno: parseInt(e.target.value) })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #e5e7eb',
                      borderRadius: 6
                    }}
                  />
                </div>
              </div>

              {/* Netto */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 6, fontWeight: 500 }}>
                  Stipendio Netto (€) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={uploadForm.netto}
                  onChange={(e) => setUploadForm({ ...uploadForm, netto: e.target.value })}
                  placeholder="0,00"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: 6
                  }}
                />
              </div>

              {/* Data emissione */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 6, fontWeight: 500 }}>
                  Data Emissione
                </label>
                <input
                  type="date"
                  value={uploadForm.data_emissione}
                  onChange={(e) => setUploadForm({ ...uploadForm, data_emissione: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: 6
                  }}
                />
              </div>

              {/* Note */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 6, fontWeight: 500 }}>
                  Note
                </label>
                <textarea
                  value={uploadForm.note}
                  onChange={(e) => setUploadForm({ ...uploadForm, note: e.target.value })}
                  placeholder="Note opzionali..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    resize: 'vertical'
                  }}
                />
              </div>
            </div>

            <div style={{ 
              padding: '16px 20px', 
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              gap: 12,
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setShowUpload(false)}
                style={{
                  padding: '10px 20px',
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  cursor: 'pointer'
                }}
              >
                Annulla
              </button>
              <button
                onClick={handleUpload}
                style={{
                  padding: '10px 20px',
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                Carica Cedolino
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* MODAL: Cedolini da Rivedere */}
      {showDaRivedere && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: 16,
            padding: 24,
            width: '90%',
            maxWidth: 1000,
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
                ⚠️ Cedolini da Rivedere
              </h2>
              <button 
                onClick={() => setShowDaRivedere(false)}
                style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer' }}
              >✕</button>
            </div>
            
            {/* Statistiche Parsing */}
            {statsParsingData && (
              <div style={{ 
                background: '#f8fafc', 
                borderRadius: 12, 
                padding: 16, 
                marginBottom: 20,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 12
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>{statsParsingData.totale}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Totale Cedolini</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#3b82f6' }}>{statsParsingData.con_lordo}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Con Lordo</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#8b5cf6' }}>{statsParsingData.con_ore_lavorate}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Con Ore Lavorate</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b' }}>{statsParsingData.da_rivedere}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Da Rivedere</div>
                </div>
              </div>
            )}
            
            {/* Template riconosciuti */}
            {statsParsingData?.per_template && (
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: 14, color: '#64748b' }}>Template Riconosciuti:</h4>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {Object.entries(statsParsingData.per_template).map(([template, count]) => (
                    <span key={template} style={{
                      padding: '4px 12px',
                      background: template === 'sconosciuto' ? '#fecaca' : '#dcfce7',
                      borderRadius: 20,
                      fontSize: 13
                    }}>
                      {template}: {count}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {/* Lista cedolini da rivedere */}
            {cedoliniDaRivedere.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#10b981' }}>
                ✅ Tutti i cedolini sono stati elaborati correttamente!
              </div>
            ) : (
              <div style={{ maxHeight: 400, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9' }}>
                      <th style={{ padding: '10px', textAlign: 'left', fontSize: 13 }}>Dipendente</th>
                      <th style={{ padding: '10px', textAlign: 'center', fontSize: 13 }}>Periodo</th>
                      <th style={{ padding: '10px', textAlign: 'center', fontSize: 13 }}>Template</th>
                      <th style={{ padding: '10px', textAlign: 'right', fontSize: 13 }}>Lordo</th>
                      <th style={{ padding: '10px', textAlign: 'right', fontSize: 13 }}>Netto</th>
                      <th style={{ padding: '10px', textAlign: 'left', fontSize: 13 }}>File</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cedoliniDaRivedere.map((c, idx) => (
                      <tr key={c.id || idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '10px', fontSize: 13 }}>
                          {c.dipendente_nome || c.nome_dipendente || 'N/D'}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center', fontSize: 13 }}>
                          {c.mese}/{c.anno}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center', fontSize: 13 }}>
                          <span style={{
                            padding: '2px 8px',
                            background: c.template_rilevato ? '#e0f2fe' : '#fef3c7',
                            borderRadius: 4,
                            fontSize: 11
                          }}>
                            {c.template_rilevato || 'non riconosciuto'}
                          </span>
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', fontSize: 13, color: c.lordo ? '#10b981' : '#ef4444' }}>
                          {c.lordo ? `€ ${c.lordo.toFixed(2)}` : '—'}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', fontSize: 13, color: c.netto ? '#10b981' : '#ef4444' }}>
                          {c.netto ? `€ ${c.netto.toFixed(2)}` : '—'}
                        </td>
                        <td style={{ padding: '10px', fontSize: 11, color: '#64748b', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.filename || c.pdf_filename || 'N/D'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            <div style={{ marginTop: 20, padding: 16, background: '#fef3c7', borderRadius: 8, fontSize: 13 }}>
              <strong>💡 Suggerimento:</strong> I cedolini non riconosciuti potrebbero avere un formato PDF diverso. 
              Puoi inviarmi un esempio del PDF problematico e ti aiuterò ad aggiornare il parser.
            </div>
          </div>
        </div>
      )}
      </div>
    </PageLayout>
  );
}
