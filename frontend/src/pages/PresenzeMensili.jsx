/**
 * PresenzeMensili.jsx
 * 
 * Visualizza il dettaglio giornaliero delle presenze importato dal LUL.
 * Per ogni dipendente mostra: ore ordinarie, ferie, assenze con calendario visivo.
 */

import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useAnnoGlobale } from '../contexts/AnnoContext';
import { formatEuro, STYLES, COLORS } from '../lib/utils';
import { RefreshCw, FileText, ChevronDown, ChevronUp, User, Clock, Calendar } from 'lucide-react';
import { toast } from 'sonner';

const MESI = ['', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

const GIORNI_SETTIMANA = { 'LU': 'Lun', 'MA': 'Mar', 'ME': 'Mer', 'GI': 'Gio', 'VE': 'Ven', 'SA': 'Sab', 'DO': 'Dom' };

// Codici giustificativi con colori
const GIUSTIFICATIVO_STYLE = {
  'FE': { label: 'Ferie', bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' },
  'AI': { label: 'Ass.za Ingiust.', bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' },
  'MA': { label: 'Malattia', bg: '#fef3c7', color: '#d97706', border: '#fcd34d' },
  'PE': { label: 'Permesso', bg: '#ede9fe', color: '#7c3aed', border: '#c4b5fd' },
  'ST': { label: 'Straordinario', bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  'RI': { label: 'Riposo', bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1' },
};

function parseOre(val) {
  if (!val) return 0;
  return parseFloat(String(val).replace(',', '.')) || 0;
}

function formatOre(val) {
  if (!val && val !== 0) return '—';
  const h = Math.floor(val);
  const m = Math.round((val - h) * 60);
  return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`;
}

// Badge giustificativo
function BadgeGiust({ codice }) {
  if (!codice) return null;
  const s = GIUSTIFICATIVO_STYLE[codice] || { label: codice, bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' };
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 6px',
      borderRadius: 4,
      fontSize: 10,
      fontWeight: 700,
      background: s.bg,
      color: s.color,
      border: `1px solid ${s.border}`
    }}>{s.label}</span>
  );
}

// Calendario mensile visivo
function CalendarioMensile({ giorni, periodo }) {
  if (!giorni || giorni.length === 0) return <div style={{ color: COLORS.gray, fontSize: 12, padding: 8 }}>Nessun dettaglio giornaliero disponibile</div>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, minWidth: 600, padding: '8px 0' }}>
        {giorni.map((g, i) => {
          const ore = parseOre(g.ore_ordinarie);
          const giust = g.giustificativo;
          const isSabDom = g.giorno_settimana === 'SA' || g.giorno_settimana === 'DO';
          const isAssente = giust === 'AI';
          const isFerie = giust === 'FE';
          const isLavorato = ore > 0 && !giust;

          let bg = '#f8fafc';
          let color = '#94a3b8';
          let border = '#e2e8f0';
          if (isSabDom) { bg = '#f1f5f9'; color = '#94a3b8'; }
          else if (isFerie) { bg = '#dbeafe'; color = '#1d4ed8'; border = '#93c5fd'; }
          else if (isAssente) { bg = '#fee2e2'; color = '#dc2626'; border = '#fca5a5'; }
          else if (giust && GIUSTIFICATIVO_STYLE[giust]) {
            bg = GIUSTIFICATIVO_STYLE[giust].bg;
            color = GIUSTIFICATIVO_STYLE[giust].color;
            border = GIUSTIFICATIVO_STYLE[giust].border;
          } else if (isLavorato) { bg = '#f0fdf4'; color = '#16a34a'; border = '#86efac'; }

          return (
            <div
              key={i}
              title={`${GIORNI_SETTIMANA[g.giorno_settimana] || g.giorno_settimana} ${g.giorno} - ${giust ? (GIUSTIFICATIVO_STYLE[giust]?.label || giust) : ore > 0 ? formatOre(ore) : 'Nessun dato'}`}
              style={{
                width: 44,
                minHeight: 48,
                border: `1px solid ${border}`,
                borderRadius: 6,
                padding: '4px 3px',
                background: bg,
                color: color,
                textAlign: 'center',
                fontSize: 11,
                cursor: 'default'
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 10, opacity: 0.7 }}>
                {GIORNI_SETTIMANA[g.giorno_settimana] || g.giorno_settimana}
              </div>
              <div style={{ fontWeight: 800, fontSize: 13 }}>{g.giorno}</div>
              <div style={{ fontSize: 9, fontWeight: 600, marginTop: 2 }}>
                {giust ? (giust === 'FE' ? 'Ferie' : giust === 'AI' ? 'Ass.' : giust) : (ore > 0 ? formatOre(ore) : (isSabDom ? '—' : ''))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        {[
          { bg: '#f0fdf4', color: '#16a34a', border: '#86efac', label: 'Lavorato' },
          { bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd', label: 'Ferie' },
          { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5', label: 'Assenza' },
          { bg: '#fef3c7', color: '#d97706', border: '#fcd34d', label: 'Malattia' },
          { bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1', label: 'Weekend' },
        ].map(l => (
          <span key={l.label} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#64748b'
          }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: l.bg, border: `1px solid ${l.border}`, display: 'inline-block' }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// Riga dipendente espandibile
function RigaDipendente({ p, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [dettaglio, setDettaglio] = useState(null);
  const [loadingDet, setLoadingDet] = useState(false);

  async function loadDettaglio() {
    if (dettaglio) return;
    setLoadingDet(true);
    try {
      const res = await api.get(`/api/paghe/presenze-mensili/${p.codice_fiscale}/${p.periodo}`);
      setDettaglio(res.data?.data);
    } catch (e) {
      toast.error('Errore caricamento dettaglio');
    }
    setLoadingDet(false);
  }

  function handleExpand() {
    const newVal = !expanded;
    setExpanded(newVal);
    if (newVal) loadDettaglio();
  }

  // Calcola assenze e ferie dal riepilogo
  const riep = p.riepilogo_giustificativi || [];
  const ferie = riep.find(r => r.codice === 'FE');
  const assenza = riep.find(r => r.codice === 'AI');
  const malattia = riep.find(r => r.codice === 'MA');

  return (
    <>
      <tr
        data-testid={`presenze-row-${p.codice_fiscale}`}
        onClick={handleExpand}
        style={{
          borderBottom: `1px solid ${COLORS.grayLight}`,
          cursor: 'pointer',
          background: expanded ? '#f8fafc' : COLORS.white,
        }}
      >
        <td style={{ padding: '10px 12px' }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{p.dipendente_nome}</div>
          <div style={{ fontSize: 11, color: COLORS.gray }}>{p.codice_fiscale}</div>
        </td>
        <td style={{ padding: '10px 12px', color: COLORS.gray, fontSize: 12 }}>
          {p.periodo_testo || (() => {
            const [y, m] = (p.periodo || '').split('-');
            return `${MESI[parseInt(m)]} ${y}`;
          })()}
        </td>
        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#16a34a' }}>
          {formatOre(p.ore_ordinarie_totale)}
        </td>
        <td style={{ padding: '10px 12px' }}>
          {ferie ? <BadgeGiust codice="FE" /> : '—'}
          {ferie && <span style={{ fontSize: 11, marginLeft: 4, color: '#1d4ed8' }}>{ferie.quantita}h</span>}
        </td>
        <td style={{ padding: '10px 12px' }}>
          {assenza ? <BadgeGiust codice="AI" /> : '—'}
          {assenza && <span style={{ fontSize: 11, marginLeft: 4, color: '#dc2626' }}>{assenza.quantita}h</span>}
        </td>
        <td style={{ padding: '10px 12px' }}>
          {malattia ? <BadgeGiust codice="MA" /> : '—'}
        </td>
        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={7} style={{ padding: '0 12px 16px 12px', background: '#f8fafc' }}>
            {loadingDet ? (
              <div style={{ padding: 16, color: COLORS.gray, fontSize: 12 }}>
                <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Caricamento...
              </div>
            ) : dettaglio ? (
              <div style={{ padding: '12px', background: COLORS.white, borderRadius: 8, border: `1px solid ${COLORS.grayLight}` }}>
                <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10, color: COLORS.dark, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Calendar size={13} /> Calendario Presenze — {dettaglio.periodo_testo}
                </div>
                <CalendarioMensile giorni={dettaglio.dettaglio_giornaliero} periodo={dettaglio.periodo} />

                {dettaglio.riepilogo_giustificativi?.length > 0 && (
                  <div style={{ marginTop: 14, borderTop: `1px solid ${COLORS.grayLight}`, paddingTop: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 11, color: COLORS.gray, marginBottom: 6 }}>RIEPILOGO GIUSTIFICATIVI</div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {dettaglio.riepilogo_giustificativi.map((r, i) => (
                        <div key={i} style={{
                          background: COLORS.grayBg,
                          border: `1px solid ${COLORS.grayLight}`,
                          borderRadius: 6,
                          padding: '6px 12px',
                          fontSize: 12
                        }}>
                          <div style={{ fontWeight: 600, color: COLORS.dark }}>{r.descrizione}</div>
                          <div style={{ color: COLORS.primary, fontWeight: 700, fontSize: 14 }}>{r.quantita} {r.unita}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </td>
        </tr>
      )}
    </>
  );
}

export default function PresenzeMensili() {
  const { anno: annoGlobale } = useAnnoGlobale();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mese, setMese] = useState('');

  const anno = annoGlobale || new Date().getFullYear();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { anno };
      if (mese) params.mese = parseInt(mese);
      const res = await api.get('/api/paghe/presenze-mensili', { params });
      setData(res.data?.data || []);
    } catch (e) {
      toast.error('Errore caricamento presenze');
    }
    setLoading(false);
  }, [anno, mese]);

  useEffect(() => { load(); }, [load]);

  // Raggruppa per periodo
  const periodi = [...new Set(data.map(d => d.periodo))].sort().reverse();

  const totOre = data.reduce((s, d) => s + (d.ore_ordinarie_totale || 0), 0);

  return (
    <div data-testid="presenze-mensili-page">
      {/* Header */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Clock size={16} color={COLORS.primary} />
          <span style={{ fontWeight: 700, color: COLORS.dark }}>Presenze Mensili — Anno {anno}</span>
        </div>
        <select
          data-testid="filtro-mese-presenze"
          value={mese}
          onChange={e => setMese(e.target.value)}
          style={{
            padding: '5px 10px', border: `1px solid ${COLORS.grayLight}`,
            borderRadius: 6, fontSize: 13, background: COLORS.white, cursor: 'pointer'
          }}
        >
          <option value="">Tutti i mesi</option>
          {MESI.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <button
          data-testid="btn-refresh-presenze"
          onClick={load}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
            background: COLORS.grayBg, border: `1px solid ${COLORS.grayLight}`,
            borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600
          }}
        >
          <RefreshCw size={12} /> Aggiorna
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Dipendenti', value: data.length },
          { label: 'Periodi', value: periodi.length },
          { label: 'Ore Totali', value: formatOre(totOre), color: '#16a34a' },
        ].map(s => (
          <div key={s.label} style={{
            background: COLORS.white, border: `1px solid ${COLORS.grayLight}`,
            borderRadius: 8, padding: '10px 16px', flex: '1 1 100px'
          }}>
            <div style={{ fontSize: 10, color: COLORS.gray, textTransform: 'uppercase', fontWeight: 700 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color || COLORS.dark }}>{s.value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: COLORS.gray }}>
          <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} /> Caricamento...
        </div>
      ) : data.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 40, background: COLORS.grayBg,
          borderRadius: 10, color: COLORS.gray
        }}>
          <Calendar size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
          <div style={{ fontWeight: 600 }}>Nessuna presenza importata</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Carica un PDF "Libro Unico" per importare le presenze</div>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: COLORS.grayBg }}>
              {['Dipendente', 'Periodo', 'Ore Ord.', 'Ferie', 'Assenze', 'Malattia', ''].map(h => (
                <th key={h} style={{
                  padding: '8px 12px', textAlign: 'left', fontWeight: 700,
                  fontSize: 11, color: COLORS.gray, borderBottom: `2px solid ${COLORS.grayLight}`
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((p, i) => <RigaDipendente key={`${p.codice_fiscale}-${p.periodo}`} p={p} />)}
          </tbody>
        </table>
      )}
    </div>
  );
}
