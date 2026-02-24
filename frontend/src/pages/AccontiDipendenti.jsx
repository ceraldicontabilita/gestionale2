/**
 * AccontiDipendenti.jsx
 * 
 * Gestione acconti mensili dipendenti.
 * Mostra: netto mese, acconti registrati, residuo da pagare.
 * Permette di aggiungere/eliminare acconti.
 */

import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useAnnoGlobale } from '../contexts/AnnoContext';
import { formatEuro, STYLES, COLORS } from '../lib/utils';
import { Plus, Trash2, RefreshCw, FileText, ChevronDown, ChevronUp, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

const MESI = ['', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

const TIPI_ACCONTO = ['ACCONTO', 'ANTICIPO', 'PREMIO', 'ALTRO'];

function formatPeriodo(periodo) {
  if (!periodo) return '';
  const [y, m] = periodo.split('-');
  return `${MESI[parseInt(m)]} ${y}`;
}

// Form aggiunta acconto
function FormAcconto({ bustaId, nettomese, onSuccess, onCancel }) {
  const [importo, setImporto] = useState('');
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [nota, setNota] = useState('');
  const [tipo, setTipo] = useState('ACCONTO');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const imp = parseFloat(importo.replace(',', '.'));
    if (!imp || imp <= 0) { toast.error('Importo non valido'); return; }
    if (imp > nettomese) { toast.error(`L'acconto non può superare il netto (${formatEuro(nettomese)})`); return; }

    setSaving(true);
    try {
      await api.post(`/api/paghe/acconti/${bustaId}`, { importo: imp, data, nota, tipo });
      toast.success('Acconto aggiunto');
      onSuccess();
    } catch (e) {
      toast.error('Errore aggiunta acconto');
    }
    setSaving(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="form-acconto"
      style={{
        background: '#f0f9ff',
        border: '1px solid #bae6fd',
        borderRadius: 8,
        padding: 14,
        marginTop: 8,
        display: 'flex',
        gap: 10,
        flexWrap: 'wrap',
        alignItems: 'flex-end'
      }}
    >
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.gray, display: 'block', marginBottom: 3 }}>Importo €</label>
        <input
          data-testid="input-importo-acconto"
          type="number"
          step="0.01"
          min="0.01"
          value={importo}
          onChange={e => setImporto(e.target.value)}
          placeholder="es. 500.00"
          style={{
            padding: '6px 10px', border: `1px solid ${COLORS.grayLight}`,
            borderRadius: 6, fontSize: 13, width: 110
          }}
          required
        />
      </div>
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.gray, display: 'block', marginBottom: 3 }}>Data</label>
        <input
          data-testid="input-data-acconto"
          type="date"
          value={data}
          onChange={e => setData(e.target.value)}
          style={{
            padding: '6px 10px', border: `1px solid ${COLORS.grayLight}`,
            borderRadius: 6, fontSize: 13
          }}
          required
        />
      </div>
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.gray, display: 'block', marginBottom: 3 }}>Tipo</label>
        <select
          data-testid="select-tipo-acconto"
          value={tipo}
          onChange={e => setTipo(e.target.value)}
          style={{
            padding: '6px 10px', border: `1px solid ${COLORS.grayLight}`,
            borderRadius: 6, fontSize: 13, background: COLORS.white
          }}
        >
          {TIPI_ACCONTO.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div style={{ flex: '1 1 150px' }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.gray, display: 'block', marginBottom: 3 }}>Nota (opzionale)</label>
        <input
          data-testid="input-nota-acconto"
          type="text"
          value={nota}
          onChange={e => setNota(e.target.value)}
          placeholder="Descrizione..."
          style={{
            padding: '6px 10px', border: `1px solid ${COLORS.grayLight}`,
            borderRadius: 6, fontSize: 13, width: '100%'
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          type="submit"
          disabled={saving}
          data-testid="btn-salva-acconto"
          style={{
            padding: '7px 14px',
            background: COLORS.primary,
            color: 'white',
            border: 'none',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 700,
            cursor: saving ? 'wait' : 'pointer'
          }}
        >
          {saving ? '...' : 'Salva'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '7px 12px',
            background: COLORS.grayBg,
            border: `1px solid ${COLORS.grayLight}`,
            borderRadius: 6,
            fontSize: 13,
            cursor: 'pointer'
          }}
        >
          Annulla
        </button>
      </div>
    </form>
  );
}

// Riga busta paga con acconti
function RigaBustaAcconti({ busta, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const acconti = busta.acconti || [];
  const hasAcconti = acconti.length > 0;
  const residuo = busta.residuo_da_pagare ?? busta.netto_mese;

  async function handleDelete(accontoId) {
    if (!confirm('Eliminare questo acconto?')) return;
    setDeletingId(accontoId);
    try {
      await api.delete(`/api/paghe/acconti/${busta.busta_id}/${accontoId}`);
      toast.success('Acconto eliminato');
      onRefresh();
    } catch (e) {
      toast.error('Errore eliminazione');
    }
    setDeletingId(null);
  }

  return (
    <>
      <tr
        data-testid={`acconto-row-${busta.codice_fiscale}`}
        style={{
          borderBottom: `1px solid ${COLORS.grayLight}`,
          background: expanded ? '#f8fafc' : COLORS.white,
          cursor: 'pointer'
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <td style={{ padding: '10px 12px' }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{busta.dipendente_nome}</div>
          <div style={{ fontSize: 11, color: COLORS.gray }}>{busta.codice_fiscale}</div>
        </td>
        <td style={{ padding: '10px 12px', color: COLORS.gray, fontSize: 12 }}>
          {formatPeriodo(busta.periodo)}
        </td>
        <td style={{ padding: '10px 12px', fontWeight: 700 }}>
          {formatEuro(busta.netto_mese)}
        </td>
        <td style={{ padding: '10px 12px' }}>
          {hasAcconti ? (
            <span style={{
              fontWeight: 700, color: '#d97706',
              background: '#fef3c7', padding: '2px 8px',
              borderRadius: 10, fontSize: 12
            }}>
              -{formatEuro(busta.totale_acconti)} ({acconti.length})
            </span>
          ) : (
            <span style={{ color: COLORS.gray, fontSize: 12 }}>—</span>
          )}
        </td>
        <td style={{ padding: '10px 12px' }}>
          <span style={{
            fontWeight: 800,
            color: residuo > 0 ? '#16a34a' : '#dc2626',
            fontSize: 14
          }}>
            {formatEuro(residuo)}
          </span>
        </td>
        <td style={{ padding: '10px 12px' }}>
          <span style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: 10,
            fontSize: 11,
            fontWeight: 700,
            background: busta.stato_pagamento === 'PAGATO' ? '#d1fae5' : '#fef3c7',
            color: busta.stato_pagamento === 'PAGATO' ? '#065f46' : '#92400e'
          }}>
            {busta.stato_pagamento}
          </span>
        </td>
        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={7} style={{ padding: '0 12px 14px', background: '#f8fafc' }}>
            <div style={{
              padding: 12, background: COLORS.white,
              borderRadius: 8, border: `1px solid ${COLORS.grayLight}`
            }}>
              {/* Lista acconti esistenti */}
              {hasAcconti && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: COLORS.gray, marginBottom: 6, textTransform: 'uppercase' }}>
                    Acconti Registrati
                  </div>
                  {acconti.map((a, idx) => (
                    <div key={a.id || idx} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '6px 10px',
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      borderRadius: 6,
                      marginBottom: 4,
                      fontSize: 13
                    }}>
                      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                        <span style={{
                          background: '#fef3c7', color: '#92400e',
                          padding: '1px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700
                        }}>{a.tipo || 'ACCONTO'}</span>
                        <strong style={{ color: '#d97706' }}>{formatEuro(a.importo)}</strong>
                        <span style={{ color: COLORS.gray }}>{a.data}</span>
                        {a.nota && <span style={{ color: COLORS.gray, fontStyle: 'italic' }}>{a.nota}</span>}
                      </div>
                      <button
                        data-testid={`btn-elimina-acconto-${a.id}`}
                        onClick={e => { e.stopPropagation(); handleDelete(a.id); }}
                        disabled={deletingId === a.id}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: '#dc2626', padding: '2px 4px', borderRadius: 4
                        }}
                        title="Elimina acconto"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <div style={{
                    textAlign: 'right', fontSize: 13, fontWeight: 700,
                    color: COLORS.dark, paddingTop: 6,
                    borderTop: `1px solid ${COLORS.grayLight}`,
                    marginTop: 4
                  }}>
                    Residuo da pagare: <span style={{ color: '#16a34a', fontSize: 15 }}>{formatEuro(residuo)}</span>
                  </div>
                </div>
              )}

              {/* Bottone aggiungi */}
              {!showForm ? (
                <button
                  data-testid={`btn-aggiungi-acconto-${busta.busta_id}`}
                  onClick={e => { e.stopPropagation(); setShowForm(true); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px',
                    background: '#eff6ff',
                    border: '1px dashed #93c5fd',
                    borderRadius: 6,
                    fontSize: 12,
                    color: '#2563eb',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={13} /> Aggiungi Acconto
                </button>
              ) : (
                <div onClick={e => e.stopPropagation()}>
                  <FormAcconto
                    bustaId={busta.busta_id}
                    nettomese={busta.netto_mese}
                    onSuccess={() => { setShowForm(false); onRefresh(); }}
                    onCancel={() => setShowForm(false)}
                  />
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function AccontiDipendenti() {
  const { anno: annoGlobale } = useAnnoGlobale();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mese, setMese] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const anno = annoGlobale || new Date().getFullYear();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { anno };
      if (mese) params.mese = parseInt(mese);
      const res = await api.get('/api/paghe/acconti', { params });
      setData(res.data?.data || []);
    } catch (e) {
      toast.error('Errore caricamento acconti');
    }
    setLoading(false);
  }, [anno, mese, refreshKey]);

  useEffect(() => { load(); }, [load]);

  const conAcconti = data.filter(b => (b.acconti || []).length > 0);
  const totAcconti = conAcconti.reduce((s, b) => s + (b.totale_acconti || 0), 0);
  const totResiduo = data.reduce((s, b) => s + (b.residuo_da_pagare || 0), 0);

  return (
    <div data-testid="acconti-dipendenti-page">
      {/* Header */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <DollarSign size={16} color={COLORS.primary} />
          <span style={{ fontWeight: 700, color: COLORS.dark }}>Acconti Mensili — Anno {anno}</span>
        </div>
        <select
          data-testid="filtro-mese-acconti"
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
          data-testid="btn-refresh-acconti"
          onClick={() => setRefreshKey(k => k + 1)}
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
          { label: 'Con Acconti', value: conAcconti.length, color: '#d97706' },
          { label: 'Totale Acconti', value: formatEuro(totAcconti), color: '#d97706' },
          { label: 'Residuo Totale', value: formatEuro(totResiduo), color: '#16a34a' },
        ].map(s => (
          <div key={s.label} style={{
            background: COLORS.white, border: `1px solid ${COLORS.grayLight}`,
            borderRadius: 8, padding: '10px 16px', flex: '1 1 100px'
          }}>
            <div style={{ fontSize: 10, color: COLORS.gray, textTransform: 'uppercase', fontWeight: 700 }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: s.color || COLORS.dark, marginTop: 2 }}>{s.value}</div>
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
          <FileText size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
          <div style={{ fontWeight: 600 }}>Nessuna busta paga trovata</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Importa un LUL per visualizzare le buste paga</div>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: COLORS.grayBg }}>
              {['Dipendente', 'Periodo', 'Netto Mese', 'Acconti', 'Residuo da Pagare', 'Stato', ''].map(h => (
                <th key={h} style={{
                  padding: '8px 12px', textAlign: 'left', fontWeight: 700,
                  fontSize: 11, color: COLORS.gray, borderBottom: `2px solid ${COLORS.grayLight}`
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map(b => (
              <RigaBustaAcconti
                key={b.busta_id}
                busta={b}
                onRefresh={() => setRefreshKey(k => k + 1)}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
