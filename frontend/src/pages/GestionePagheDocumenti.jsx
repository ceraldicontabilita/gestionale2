/**
 * GestionePagheDocumenti.jsx
 * 
 * Stato di pagamento automatico per buste paga, F24 e tributi.
 * I dati vengono aggiornati automaticamente al caricamento dei PDF (LUL, F24)
 * e riconciliati automaticamente al caricamento dell'estratto conto bancario.
 */

import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useAnnoGlobale } from '../contexts/AnnoContext';
import { formatEuro, formatDateIT, STYLES, COLORS, badge } from '../lib/utils';
import { RefreshCw, FileText, CheckCircle, Clock, AlertCircle, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { toast } from 'sonner';

const MESI = [
  '', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

function BadgeStato({ stato }) {
  const isOk = stato === 'PAGATO';
  return (
    <span
      data-testid={`badge-stato-${stato?.toLowerCase()}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 10px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.5,
        background: isOk ? '#d1fae5' : '#fef3c7',
        color: isOk ? '#065f46' : '#92400e',
        border: `1px solid ${isOk ? '#6ee7b7' : '#fcd34d'}`
      }}
    >
      {isOk ? <CheckCircle size={11} /> : <Clock size={11} />}
      {stato || 'N/D'}
    </span>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: COLORS.white,
      border: `1px solid ${COLORS.grayLight}`,
      borderRadius: 10,
      padding: '14px 18px',
      flex: '1 1 140px',
      minWidth: 120
    }}>
      <div style={{ fontSize: 11, color: COLORS.gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || COLORS.dark, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: COLORS.gray, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ===== TAB BUSTE PAGA =====
function TabBustePaga({ anno, mese }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (anno) params.anno = anno;
      if (mese) params.mese = mese;
      const res = await api.get('/api/paghe/buste-paga', { params });
      setData(res.data?.data || []);
    } catch (e) {
      toast.error('Errore caricamento buste paga');
    }
    setLoading(false);
  }, [anno, mese]);

  useEffect(() => { load(); }, [load]);

  const totPagato = data.filter(b => b.stato_pagamento === 'PAGATO').reduce((s, b) => s + (b.netto_mese || 0), 0);
  const totDaPagare = data.filter(b => b.stato_pagamento === 'DA_PAGARE').reduce((s, b) => s + (b.netto_mese || 0), 0);
  const nPagati = data.filter(b => b.stato_pagamento === 'PAGATO').length;
  const nDaPagare = data.filter(b => b.stato_pagamento === 'DA_PAGARE').length;

  return (
    <div>
      {/* Statistiche */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <StatCard label="Totale Buste" value={data.length} />
        <StatCard label="Pagate" value={nPagati} sub={formatEuro(totPagato)} color="#065f46" />
        <StatCard label="Da Pagare" value={nDaPagare} sub={formatEuro(totDaPagare)} color="#92400e" />
        <StatCard label="Totale Netto" value={formatEuro(totPagato + totDaPagare)} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: COLORS.gray }}>
          <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} /> Caricamento...
        </div>
      ) : data.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 40, color: COLORS.gray,
          background: COLORS.grayBg, borderRadius: 10
        }}>
          <FileText size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
          <div style={{ fontWeight: 600 }}>Nessuna busta paga importata</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            Carica un PDF "Libro Unico" dalla pagina Import Documenti
          </div>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: COLORS.grayBg }}>
              {['Dipendente', 'Periodo', 'Netto Mese', 'Stato', 'Data Pagamento', ''].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: COLORS.gray, borderBottom: `2px solid ${COLORS.grayLight}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((b, i) => (
              <React.Fragment key={b.busta_id || i}>
                <tr
                  data-testid={`busta-row-${i}`}
                  style={{
                    borderBottom: `1px solid ${COLORS.grayLight}`,
                    cursor: 'pointer',
                    background: expanded === i ? '#f8fafc' : (i % 2 === 0 ? COLORS.white : '#fafafa')
                  }}
                  onClick={() => setExpanded(expanded === i ? null : i)}
                >
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{b.dipendente_nome || b.codice_fiscale}</td>
                  <td style={{ padding: '10px 12px', color: COLORS.gray }}>
                    {b.periodo ? (() => {
                      const [y, m] = b.periodo.split('-');
                      return `${MESI[parseInt(m)]} ${y}`;
                    })() : b.periodo}
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 700 }}>{formatEuro(b.netto_mese)}</td>
                  <td style={{ padding: '10px 12px' }}><BadgeStato stato={b.stato_pagamento} /></td>
                  <td style={{ padding: '10px 12px', color: COLORS.gray, fontSize: 12 }}>
                    {b.data_pagamento ? formatDateIT(b.data_pagamento) : '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {expanded === i ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </td>
                </tr>
                {expanded === i && (
                  <tr>
                    <td colSpan={6} style={{ padding: '0 12px 12px', background: '#f8fafc' }}>
                      <div style={{ padding: '12px', background: COLORS.white, borderRadius: 8, border: `1px solid ${COLORS.grayLight}`, fontSize: 12 }}>
                        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                          <div><span style={{ color: COLORS.gray }}>Codice Fiscale:</span> <strong>{b.codice_fiscale}</strong></div>
                          <div><span style={{ color: COLORS.gray }}>ID Busta:</span> <code style={{ fontSize: 11 }}>{b.busta_id}</code></div>
                          {b.movimento_bancario_id && (
                            <div><span style={{ color: COLORS.gray }}>Mov. Bancario:</span> <code style={{ fontSize: 11 }}>{b.movimento_bancario_id}</code></div>
                          )}
                          <div><span style={{ color: COLORS.gray }}>Importato il:</span> {b.imported_at ? formatDateIT(b.imported_at) : '—'}</div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, color: COLORS.gray, fontSize: 12 }}>
        <Info size={12} />
        La riconciliazione avviene automaticamente al caricamento dell'estratto conto bancario
      </div>
    </div>
  );
}

// ===== TAB F24 =====
function TabF24({ anno }) {
  const [f24List, setF24List] = useState([]);
  const [tributiMap, setTributiMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (anno) params.anno = anno;
      const [f24Res, triRes] = await Promise.all([
        api.get('/api/paghe/distinte-f24', { params }),
        api.get('/api/paghe/tributi-pagati', { params })
      ]);
      const f24Data = f24Res.data?.data || [];
      const triData = triRes.data?.data || [];

      // Raggruppa tributi per f24_id
      const map = {};
      triData.forEach(t => {
        if (!map[t.f24_id]) map[t.f24_id] = [];
        map[t.f24_id].push(t);
      });

      setF24List(f24Data);
      setTributiMap(map);
    } catch (e) {
      toast.error('Errore caricamento F24');
    }
    setLoading(false);
  }, [anno]);

  useEffect(() => { load(); }, [load]);

  const totPagato = f24List.filter(f => f.stato === 'PAGATO').reduce((s, f) => s + (f.riepilogo?.totale_generale || 0), 0);
  const totDaPagare = f24List.filter(f => f.stato === 'DA_PAGARE').reduce((s, f) => s + (f.riepilogo?.totale_generale || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <StatCard label="Totale F24" value={f24List.length} />
        <StatCard label="Pagati" value={f24List.filter(f => f.stato === 'PAGATO').length} sub={formatEuro(totPagato)} color="#065f46" />
        <StatCard label="Da Pagare" value={f24List.filter(f => f.stato === 'DA_PAGARE').length} sub={formatEuro(totDaPagare)} color="#92400e" />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: COLORS.gray }}>
          <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} /> Caricamento...
        </div>
      ) : f24List.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 40, color: COLORS.gray,
          background: COLORS.grayBg, borderRadius: 10
        }}>
          <FileText size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
          <div style={{ fontWeight: 600 }}>Nessun F24 importato</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            Carica un PDF "Modello F24" dalla pagina Import Documenti
          </div>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: COLORS.grayBg }}>
              {['Scadenza', 'Contribuente', 'Totale', 'ERARIO', 'INPS', 'Stato', 'Data Pag.', ''].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: COLORS.gray, borderBottom: `2px solid ${COLORS.grayLight}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {f24List.map((f, i) => (
              <React.Fragment key={f.distinta_id || i}>
                <tr
                  data-testid={`f24-row-${i}`}
                  style={{
                    borderBottom: `1px solid ${COLORS.grayLight}`,
                    cursor: 'pointer',
                    background: expanded === i ? '#f8fafc' : (i % 2 === 0 ? COLORS.white : '#fafafa')
                  }}
                  onClick={() => setExpanded(expanded === i ? null : i)}
                >
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{f.scadenza}</td>
                  <td style={{ padding: '10px 12px', color: COLORS.gray, fontSize: 12 }}>{f.contribuente_rs || f.contribuente_cf}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 700 }}>{formatEuro(f.riepilogo?.totale_generale)}</td>
                  <td style={{ padding: '10px 12px' }}>{formatEuro(f.riepilogo?.totale_erario)}</td>
                  <td style={{ padding: '10px 12px' }}>{formatEuro(f.riepilogo?.totale_inps)}</td>
                  <td style={{ padding: '10px 12px' }}><BadgeStato stato={f.stato} /></td>
                  <td style={{ padding: '10px 12px', color: COLORS.gray, fontSize: 12 }}>
                    {f.data_pagamento ? formatDateIT(f.data_pagamento) : '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {expanded === i ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </td>
                </tr>
                {expanded === i && tributiMap[f.f24_ids?.[0]] && (
                  <tr>
                    <td colSpan={8} style={{ padding: '0 12px 12px', background: '#f8fafc' }}>
                      <div style={{ padding: 12, background: COLORS.white, borderRadius: 8, border: `1px solid ${COLORS.grayLight}` }}>
                        <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, color: COLORS.dark }}>Dettaglio Tributi</div>
                        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: COLORS.grayBg }}>
                              {['Sezione', 'Codice', 'Descrizione', 'Anno Rif.', 'Importo', 'Stato'].map(h => (
                                <th key={h} style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, color: COLORS.gray, fontSize: 10 }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {tributiMap[f.f24_ids?.[0]].map((t, ti) => (
                              <tr key={ti} style={{ borderBottom: `1px solid ${COLORS.grayLight}` }}>
                                <td style={{ padding: '5px 8px' }}><span style={{ background: '#e0e7ff', color: '#3730a3', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>{t.sezione}</span></td>
                                <td style={{ padding: '5px 8px', fontFamily: 'monospace' }}>{t.codice_tributo}</td>
                                <td style={{ padding: '5px 8px' }}>{t.descrizione_tributo}</td>
                                <td style={{ padding: '5px 8px', color: COLORS.gray }}>{t.anno_riferimento}</td>
                                <td style={{ padding: '5px 8px', fontWeight: 700 }}>{formatEuro(t.importo_netto)}</td>
                                <td style={{ padding: '5px 8px' }}><BadgeStato stato={t.stato} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, color: COLORS.gray, fontSize: 12 }}>
        <Info size={12} />
        La riconciliazione avviene automaticamente al caricamento dell'estratto conto bancario
      </div>
    </div>
  );
}

// ===== COMPONENTE PRINCIPALE =====
export default function GestionePagheDocumenti() {
  const { anno: annoGlobale } = useAnnoGlobale();
  const [activeTab, setActiveTab] = useState('buste');
  const [mese, setMese] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const anno = annoGlobale || new Date().getFullYear();

  const tabs = [
    { id: 'buste', label: 'Buste Paga', icon: <FileText size={14} /> },
    { id: 'f24', label: 'F24 & Tributi', icon: <AlertCircle size={14} /> },
  ];

  return (
    <div data-testid="gestione-paghe-documenti">
      {/* Header con filtri */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 20,
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: COLORS.gray, fontWeight: 600 }}>Anno:</span>
          <span style={{
            padding: '4px 12px',
            background: COLORS.grayBg,
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 700,
            color: COLORS.dark
          }}>{anno}</span>
        </div>

        {activeTab === 'buste' && (
          <select
            data-testid="filtro-mese"
            value={mese}
            onChange={e => setMese(e.target.value)}
            style={{
              padding: '6px 12px',
              border: `1px solid ${COLORS.grayLight}`,
              borderRadius: 6,
              fontSize: 13,
              background: COLORS.white,
              cursor: 'pointer'
            }}
          >
            <option value="">Tutti i mesi</option>
            {MESI.slice(1).map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
        )}

        <button
          data-testid="btn-refresh"
          onClick={() => setRefreshKey(k => k + 1)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            background: COLORS.grayBg,
            border: `1px solid ${COLORS.grayLight}`,
            borderRadius: 6,
            fontSize: 12,
            cursor: 'pointer',
            color: COLORS.dark,
            fontWeight: 600
          }}
        >
          <RefreshCw size={13} /> Aggiorna
        </button>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 0,
        marginBottom: 20,
        borderBottom: `2px solid ${COLORS.grayLight}`
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            data-testid={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 20px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? COLORS.primary : COLORS.gray,
              borderBottom: activeTab === tab.id ? `2px solid ${COLORS.primary}` : '2px solid transparent',
              marginBottom: -2,
              transition: 'all 0.15s'
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenuto tab */}
      <div key={`${activeTab}-${refreshKey}-${anno}-${mese}`}>
        {activeTab === 'buste' && (
          <TabBustePaga anno={anno} mese={mese ? parseInt(mese) : null} />
        )}
        {activeTab === 'f24' && (
          <TabF24 anno={anno} />
        )}
      </div>
    </div>
  );
}
