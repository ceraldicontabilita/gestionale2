/**
 * HRMissioni.jsx — Gestione Missioni e Trasferte
 *
 * Layout ispirato a dipendenti-cloud:
 *   - Header con filtri (stato + dipendente)
 *   - Griglia card missioni (destinazione, date, dipendente, rimborso, stato-badge)
 *   - Pulsante Nuova missione → modale
 *   - Azioni approva/rifiuta inline per stato in_attesa
 *
 * Design system Ceraldi: navy + oro, inline styles via COLORS/SPACING.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, MapPin, Calendar, Euro, Check, X, Edit2, Trash2, Clock } from 'lucide-react';
import api from '../../api';
import { COLORS, SPACING, useIsMobile } from '../../lib/utils';

const STATO_CONFIG = {
  in_attesa:  { label: 'In attesa',  bg: COLORS.warningLight, text: COLORS.warning, icon: Clock  },
  approvata:  { label: 'Approvata',  bg: COLORS.successLight, text: COLORS.success, icon: Check  },
  rifiutata:  { label: 'Rifiutata',  bg: COLORS.dangerLight,  text: COLORS.danger,  icon: X      },
  completata: { label: 'Completata', bg: COLORS.infoLight,    text: COLORS.info,    icon: Check  },
};

const AVATAR_BG = ['#0f2744', '#1e3a5f', '#b8860b', '#15803d', '#1d4ed8', '#7c3aed', '#b45309', '#b91c1c'];

const DEFAULT_FORM = {
  dipendente_id: '',
  destinazione: '',
  data_inizio: '',
  data_fine: '',
  scopo: '',
  rimborso: 0,
};

function getInitials(nome = '', cognome = '') {
  const n = (nome || '').trim();
  const c = (cognome || '').trim();
  if (n && c) return (n[0] + c[0]).toUpperCase();
  if (c) return c.substring(0, 2).toUpperCase();
  if (n) return n.substring(0, 2).toUpperCase();
  return '?';
}

function formatData(d) {
  if (!d) return '—';
  try {
    const parts = d.split('T')[0].split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return d;
  } catch { return d; }
}

function formatEuro(v) {
  if (v == null || isNaN(v)) return '€ 0,00';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v);
}

// ═════════════════════════════════════════════════════════════════════════

export default function HRMissioni() {
  const isMobile = useIsMobile();

  const [dipendenti, setDipendenti] = useState([]);
  const [missioni, setMissioni] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filterStato, setFilterStato] = useState('tutti');
  const [filterDip, setFilterDip] = useState('tutti');

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  // Load
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [dipRes, misRes] = await Promise.all([
        api.get('/api/dipendenti'),
        api.get('/api/missioni'),
      ]);
      setDipendenti(Array.isArray(dipRes.data) ? dipRes.data : []);
      setMissioni(Array.isArray(misRes.data) ? misRes.data : []);
    } catch (e) {
      console.error('[HRMissioni] load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Handlers
  const openNew = () => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setShowModal(true);
  };

  const openEdit = (m) => {
    setEditingId(m.id);
    setForm({
      dipendente_id: m.dipendente_id || '',
      destinazione: m.destinazione || '',
      data_inizio: (m.data_inizio || '').split('T')[0],
      data_fine: (m.data_fine || '').split('T')[0],
      scopo: m.scopo || '',
      rimborso: m.rimborso || 0,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm(DEFAULT_FORM);
  };

  const submit = async () => {
    if (!form.dipendente_id || !form.destinazione.trim() || !form.data_inizio || !form.data_fine || !form.scopo.trim()) {
      alert('Compila tutti i campi obbligatori');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, rimborso: Number(form.rimborso) || 0 };
      if (editingId) {
        await api.put(`/api/missioni/${editingId}`, payload);
      } else {
        await api.post('/api/missioni', payload);
      }
      closeModal();
      await loadAll();
    } catch (e) {
      console.error('[HRMissioni] submit error:', e);
      alert('Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const approva = async (id) => {
    try {
      await api.post(`/api/missioni/${id}/approva`, {});
      await loadAll();
    } catch (e) { alert('Errore approvazione'); }
  };

  const rifiuta = async (id) => {
    const note = window.prompt('Motivo del rifiuto (opzionale):') || '';
    try {
      await api.post(`/api/missioni/${id}/rifiuta`, { note });
      await loadAll();
    } catch (e) { alert('Errore rifiuto'); }
  };

  const remove = async (m) => {
    if (!window.confirm(`Eliminare la missione a ${m.destinazione}?`)) return;
    try {
      await api.delete(`/api/missioni/${m.id}`);
      await loadAll();
    } catch (e) { alert('Errore eliminazione'); }
  };

  // Derived
  const dipById = useMemo(() => {
    const m = {};
    dipendenti.forEach((d) => { m[d.id] = d; });
    return m;
  }, [dipendenti]);

  const filtered = useMemo(() => {
    return missioni.filter((m) => {
      if (filterStato !== 'tutti' && m.stato !== filterStato) return false;
      if (filterDip !== 'tutti' && m.dipendente_id !== filterDip) return false;
      return true;
    });
  }, [missioni, filterStato, filterDip]);

  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div style={{ padding: isMobile ? SPACING.lg : SPACING.xxl, minHeight: '100vh', backgroundColor: COLORS.bg }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: SPACING.md, marginBottom: SPACING.xxl }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: COLORS.text, margin: 0, letterSpacing: '-0.02em' }}>
            Missioni e Trasferte
          </h1>
          <p style={{ fontSize: 14, color: COLORS.textMuted, margin: '4px 0 0' }}>
            Gestione trasferte dipendenti con rimborsi e workflow approvazione
          </p>
        </div>
        <button
          onClick={openNew}
          style={btnPrimary}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = COLORS.primaryLight)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = COLORS.primary)}
          data-testid="nuova-missione-btn"
        >
          <Plus size={18} /> Nuova missione
        </button>
      </div>

      {/* FILTRI */}
      <div style={{ display: 'flex', gap: SPACING.md, marginBottom: SPACING.xl, flexWrap: 'wrap' }}>
        <select value={filterStato} onChange={(e) => setFilterStato(e.target.value)} style={selectStyle}>
          <option value="tutti">Tutti gli stati</option>
          {Object.entries(STATO_CONFIG).map(([k, c]) => (
            <option key={k} value={k}>{c.label}</option>
          ))}
        </select>
        <select value={filterDip} onChange={(e) => setFilterDip(e.target.value)} style={selectStyle}>
          <option value="tutti">Tutti i dipendenti</option>
          {dipendenti.map((d) => (
            <option key={d.id} value={d.id}>{d.cognome} {d.nome}</option>
          ))}
        </select>
        <div style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: 13, color: COLORS.textMuted }}>
          {filtered.length} {filtered.length === 1 ? 'missione' : 'missioni'}
        </div>
      </div>

      {/* BODY */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: COLORS.textMuted }}>Caricamento missioni...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: COLORS.textMuted, backgroundColor: COLORS.card, border: `1px dashed ${COLORS.border}`, borderRadius: 12 }}>
          {missioni.length === 0 ? 'Nessuna missione registrata. Clicca "Nuova missione" per crearne una.' : 'Nessuna missione corrisponde ai filtri selezionati.'}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? '280px' : '340px'}, 1fr))`,
          gap: SPACING.lg,
        }}>
          {filtered.map((m, idx) => {
            const dip = dipById[m.dipendente_id];
            const stato = STATO_CONFIG[m.stato] || STATO_CONFIG.in_attesa;
            const StatoIcon = stato.icon;
            return (
              <div key={m.id} style={cardStyle}>
                {/* Badge stato */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: SPACING.md }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      backgroundColor: AVATAR_BG[idx % AVATAR_BG.length],
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 600,
                    }}>
                      {dip ? getInitials(dip.nome, dip.cognome) : '?'}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {dip ? `${dip.cognome} ${dip.nome}` : 'Dipendente sconosciuto'}
                      </div>
                      {dip?.ruolo && <div style={{ fontSize: 12, color: COLORS.textMuted }}>{dip.ruolo}</div>}
                    </div>
                  </div>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '4px 10px', borderRadius: 12,
                    backgroundColor: stato.bg, color: stato.text,
                    fontSize: 11, fontWeight: 600,
                  }}>
                    <StatoIcon size={12} /> {stato.label}
                  </span>
                </div>

                {/* Destinazione */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <MapPin size={16} color={COLORS.primary} />
                  <span style={{ fontSize: 16, fontWeight: 600, color: COLORS.text }}>{m.destinazione}</span>
                </div>

                {/* Date */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13, color: COLORS.textMuted }}>
                  <Calendar size={14} />
                  {formatData(m.data_inizio)} → {formatData(m.data_fine)}
                </div>

                {/* Rimborso */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: SPACING.md, fontSize: 13, color: COLORS.accent, fontWeight: 600 }}>
                  <Euro size={14} />
                  Rimborso: {formatEuro(m.rimborso)}
                </div>

                {/* Scopo */}
                <div style={{ padding: 10, backgroundColor: COLORS.bgAlt, borderRadius: 8, fontSize: 13, color: COLORS.text, marginBottom: SPACING.md, minHeight: 40 }}>
                  {m.scopo}
                </div>

                {/* Note approvazione */}
                {m.note_approvazione && (
                  <div style={{ padding: 8, backgroundColor: COLORS.warningLight, borderRadius: 6, fontSize: 12, color: COLORS.warning, marginBottom: SPACING.md, fontStyle: 'italic' }}>
                    &ldquo;{m.note_approvazione}&rdquo;
                  </div>
                )}

                {/* Azioni */}
                <div style={{ display: 'flex', gap: 6, borderTop: `1px solid ${COLORS.border}`, paddingTop: SPACING.md }}>
                  {m.stato === 'in_attesa' && (
                    <>
                      <button onClick={() => approva(m.id)} style={{ ...btnSm, backgroundColor: COLORS.success, color: '#fff' }}>
                        <Check size={14} /> Approva
                      </button>
                      <button onClick={() => rifiuta(m.id)} style={{ ...btnSm, backgroundColor: COLORS.danger, color: '#fff' }}>
                        <X size={14} /> Rifiuta
                      </button>
                    </>
                  )}
                  <button onClick={() => openEdit(m)} style={{ ...btnSm, backgroundColor: COLORS.infoLight, color: COLORS.info, marginLeft: 'auto' }}>
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => remove(m)} style={{ ...btnSm, backgroundColor: COLORS.dangerLight, color: COLORS.danger }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <ModalMissione
          form={form}
          setForm={setForm}
          dipendenti={dipendenti}
          editing={!!editingId}
          saving={saving}
          onClose={closeModal}
          onSubmit={submit}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
function ModalMissione({ form, setForm, dipendenti, editing, saving, onClose, onSubmit }) {
  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...modalStyle, maxWidth: 560 }}>
        <div style={modalHeader}>
          <h3 style={{ fontSize: 17, fontWeight: 600, color: COLORS.text, margin: 0 }}>
            {editing ? 'Modifica missione' : 'Nuova missione'}
          </h3>
          <button onClick={onClose} style={closeBtn}><X size={20} /></button>
        </div>

        <div style={{ padding: SPACING.xl }}>
          <FormField label="Dipendente *">
            <select
              value={form.dipendente_id}
              onChange={(e) => setForm((f) => ({ ...f, dipendente_id: e.target.value }))}
              style={inputStyle}
            >
              <option value="">Seleziona...</option>
              {dipendenti.map((d) => (
                <option key={d.id} value={d.id}>{d.cognome} {d.nome}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Destinazione *">
            <input
              value={form.destinazione}
              onChange={(e) => setForm((f) => ({ ...f, destinazione: e.target.value }))}
              placeholder="Es. Milano, Roma, Cliente XYZ..."
              style={inputStyle}
            />
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACING.lg }}>
            <FormField label="Data inizio *">
              <input type="date" value={form.data_inizio} onChange={(e) => setForm((f) => ({ ...f, data_inizio: e.target.value }))} style={inputStyle} />
            </FormField>
            <FormField label="Data fine *">
              <input type="date" value={form.data_fine} onChange={(e) => setForm((f) => ({ ...f, data_fine: e.target.value }))} style={inputStyle} />
            </FormField>
          </div>

          <FormField label="Scopo della missione *">
            <textarea
              value={form.scopo}
              onChange={(e) => setForm((f) => ({ ...f, scopo: e.target.value }))}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
              placeholder="Visita cliente, installazione, formazione..."
            />
          </FormField>

          <FormField label="Rimborso stimato (€)">
            <input
              type="number" step="0.01" min="0"
              value={form.rimborso}
              onChange={(e) => setForm((f) => ({ ...f, rimborso: e.target.value }))}
              style={inputStyle}
            />
          </FormField>
        </div>

        <div style={modalFooter}>
          <button onClick={onClose} style={btnSecondary}>Annulla</button>
          <button onClick={onSubmit} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>
            {saving ? 'Salvo...' : editing ? 'Salva modifiche' : 'Crea missione'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div style={{ marginBottom: SPACING.lg }}>
      <label style={fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

// ═══════════════ Styles ═══════════════
const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 8,
  padding: '10px 18px', backgroundColor: COLORS.primary, color: '#fff',
  border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  transition: 'background-color 0.15s',
};
const btnSecondary = {
  padding: '10px 18px', backgroundColor: 'transparent', color: COLORS.text,
  border: `1px solid ${COLORS.border}`, borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer',
};
const btnSm = {
  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px',
  border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer',
};
const cardStyle = {
  backgroundColor: COLORS.card, border: `1px solid ${COLORS.border}`,
  borderRadius: 12, padding: SPACING.lg,
  boxShadow: '0 1px 3px rgba(15,39,68,0.04)',
};
const selectStyle = {
  padding: '8px 12px', fontSize: 13, border: `1px solid ${COLORS.border}`,
  borderRadius: 8, backgroundColor: COLORS.card, color: COLORS.text, cursor: 'pointer',
  outline: 'none', minWidth: 160,
};
const overlayStyle = {
  position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
};
const modalStyle = {
  backgroundColor: COLORS.card, borderRadius: 12, width: '100%', maxHeight: '90vh',
  overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
};
const modalHeader = {
  padding: `${SPACING.lg}px ${SPACING.xl}px`, borderBottom: `1px solid ${COLORS.border}`,
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
};
const modalFooter = {
  padding: `${SPACING.lg}px ${SPACING.xl}px`, borderTop: `1px solid ${COLORS.border}`,
  display: 'flex', justifyContent: 'flex-end', gap: SPACING.md,
};
const closeBtn = {
  padding: 6, background: 'transparent', border: 'none', borderRadius: 6,
  cursor: 'pointer', color: COLORS.textMuted,
};
const inputStyle = {
  width: '100%', padding: '10px 12px', fontSize: 14,
  border: `1px solid ${COLORS.border}`, borderRadius: 8, outline: 'none',
  boxSizing: 'border-box', backgroundColor: COLORS.card, color: COLORS.text,
};
const fieldLabel = {
  display: 'block', fontSize: 11, fontWeight: 600, color: COLORS.textMuted,
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6,
};
