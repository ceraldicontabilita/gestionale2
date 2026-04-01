import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';

// ---- costanti ----
const TIPO_CFG = {
  urgente:     { label: 'URGENTE',     bg: '#fef2f2', border: '#ef4444', dot: '#ef4444', text: '#dc2626' },
  anomalia:    { label: 'ANOMALIA',    bg: '#fef2f2', border: '#ef4444', dot: '#ef4444', text: '#dc2626' },
  avviso:      { label: 'AVVISO',      bg: '#fffbeb', border: '#f59e0b', dot: '#f59e0b', text: '#d97706' },
  info:        { label: 'INFO',        bg: '#eff6ff', border: '#3b82f6', dot: '#3b82f6', text: '#2563eb' },
  suggerimento:{ label: 'SUGGERIM.',   bg: '#f0fdf4', border: '#22c55e', dot: '#22c55e', text: '#16a34a' },
};
const TABS = ['agenti', 'urgente', 'avviso', 'info', 'suggerimento', 'pattern'];

const STATI_CFG = {
  completato: { color: '#16a34a', label: 'Attivo', icon: '●' },
  errore:     { color: '#ef4444', label: 'Errore', icon: '●' },
  in_esecuzione: { color: '#f59e0b', label: 'In esecuzione', icon: '◐' },
};

function formatTs(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

// ---- AGENTE CARD ----
function AgenteCard({ agente, onRun }) {
  const s = STATI_CFG[agente.stato] || { color: '#94a3b8', label: agente.stato || '?', icon: '●' };
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: 12,
      padding: 20,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <div style={{
        width: 48, height: 48,
        borderRadius: 12,
        background: '#1e3a5f',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7dd3fc" strokeWidth="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
        </svg>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 4 }}>
          {agente.agente}
        </div>
        <div style={{ fontSize: 12, color: '#64748b' }}>
          Ultima esecuzione: {formatTs(agente.ultima_esecuzione)}
        </div>
        {agente.ultimo_errore && (
          <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4, fontFamily: 'monospace' }}>
            {agente.ultimo_errore}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, color: s.color, fontWeight: 600 }}>
          {s.icon} {s.label}
        </span>
        <button
          onClick={() => onRun(agente.agente)}
          style={{
            background: '#1e3a5f',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '7px 14px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          Esegui ora
        </button>
      </div>
    </div>
  );
}

// ---- SEGNALAZIONE CARD ----
function SegnalazioneCard({ s, onRisolvi }) {
  const c = TIPO_CFG[s.tipo] || TIPO_CFG.info;
  return (
    <div style={{
      background: s.risolta ? '#f8fafc' : c.bg,
      border: `1px solid ${s.risolta ? '#e2e8f0' : c.border}`,
      borderRadius: 10,
      padding: 16,
      marginBottom: 10,
      opacity: s.risolta ? 0.6 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot, flexShrink: 0, marginTop: 5 }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
            <span style={{ background: c.dot, color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4 }}>
              {c.label}
            </span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{s.agente}</span>
            <span style={{ fontSize: 11, color: '#cbd5e1' }}>{formatTs(s.created_at)}</span>
          </div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: '#1e293b', lineHeight: 1.4 }}>
            {s.titolo}
          </p>
        </div>
      </div>
      <p style={{ margin: '0 0 8px 16px', fontSize: 12, color: '#475569', lineHeight: 1.7 }}>
        {s.descrizione}
      </p>
      {s.azione_suggerita && (
        <div style={{ margin: '0 0 8px 16px', fontSize: 11, color: c.text, fontWeight: 600, background: `${c.dot}15`, padding: '4px 8px', borderRadius: 4 }}>
          Azione: {s.azione_suggerita}
        </div>
      )}
      {!s.risolta && (
        <div style={{ marginLeft: 16 }}>
          <button
            onClick={() => onRisolvi(s.id)}
            style={{ background: '#dcfce7', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 11, cursor: 'pointer', color: '#16a34a', fontWeight: 600 }}
          >
            Risolto
          </button>
        </div>
      )}
    </div>
  );
}

// ---- PATTERN CARD ----
function PatternCard({ p }) {
  const pct = Math.round((p.confidenza || 0) * 100);
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 16px', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ background: '#eff6ff', color: '#2563eb', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4 }}>
          {p.categoria}
        </span>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>{p.occorrenze || 1} occorrenze</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{p.chiave}</div>
          <div style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic' }}>{String(p.valore).slice(0, 100)}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: pct >= 70 ? '#16a34a' : pct >= 40 ? '#d97706' : '#94a3b8' }}>
            {pct}%
          </div>
          <div style={{ width: 60, height: 4, background: '#e2e8f0', borderRadius: 2, marginTop: 4 }}>
            <div style={{ width: `${pct}%`, height: '100%', background: pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#94a3b8', borderRadius: 2 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- PAGINA PRINCIPALE ----
export default function AgentiPage() {
  const [activeTab, setActiveTab] = useState('agenti');
  const [stati, setStati] = useState([]);
  const [segnalazioni, setSegnalazioni] = useState([]);
  const [pattern, setPattern] = useState([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statiRes, segnRes] = await Promise.all([
        api.get('/api/agenti/stato'),
        api.get('/api/agenti/segnalazioni?limit=100'),
      ]);
      setStati(statiRes.data.agenti || []);
      setSegnalazioni(segnRes.data.segnalazioni || []);
    } catch (e) {
      setMsg('Errore caricamento dati agenti');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPattern = useCallback(async () => {
    try {
      const res = await api.get('/api/agenti/pattern-appresi');
      setPattern(res.data.pattern || []);
    } catch { /* silenzioso */ }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { if (activeTab === 'pattern') loadPattern(); }, [activeTab, loadPattern]);

  const eseguiOra = async () => {
    setRunning(true);
    setMsg('');
    try {
      await api.post('/api/agenti/run');
      setMsg('Agenti eseguiti con successo!');
      await loadAll();
    } catch {
      setMsg('Errore durante esecuzione agenti');
    } finally {
      setRunning(false);
    }
  };

  const risolviSegnalazione = async (id) => {
    try {
      await api.put(`/api/agenti/segnalazioni/${id}/risolta`);
      setSegnalazioni(prev => prev.map(s => s.id === id ? { ...s, risolta: true } : s));
    } catch { /* silenzioso */ }
  };

  const segnalazioniPerTipo = (tipo) =>
    segnalazioni.filter(s => s.tipo === tipo && !s.risolta);

  const totaleNonRisolte = segnalazioni.filter(s => !s.risolta).length;
  const urgenti = segnalazioniPerTipo('urgente').length + segnalazioniPerTipo('anomalia').length;

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>Agenti AI</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>
            Monitor, segnalazioni e pattern appresi dal sistema di intelligenza automatica
          </p>
        </div>
        <button
          data-testid="btn-run-all-agenti"
          onClick={eseguiOra}
          disabled={running}
          style={{
            background: running ? '#94a3b8' : '#1e3a5f',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '10px 22px',
            fontSize: 14,
            fontWeight: 700,
            cursor: running ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          {running ? 'Esecuzione...' : 'Esegui tutti ora'}
        </button>
      </div>

      {msg && (
        <div style={{ background: msg.includes('Errore') ? '#fef2f2' : '#f0fdf4', border: `1px solid ${msg.includes('Errore') ? '#ef4444' : '#22c55e'}`, borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: msg.includes('Errore') ? '#dc2626' : '#16a34a' }}>
          {msg}
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#f1f5f9', borderRadius: 10, padding: 4 }}>
        {[
          { key: 'agenti', label: `Agenti (${stati.length})` },
          { key: 'urgente', label: `Urgenti (${urgenti})`, badge: urgenti > 0 },
          { key: 'avviso', label: `Avvisi (${segnalazioniPerTipo('avviso').length})` },
          { key: 'info', label: `Info (${segnalazioniPerTipo('info').length})` },
          { key: 'suggerimento', label: `Suggerimenti (${segnalazioniPerTipo('suggerimento').length})` },
          { key: 'pattern', label: 'Pattern appresi' },
        ].map(t => (
          <button
            key={t.key}
            data-testid={`tab-agenti-${t.key}`}
            onClick={() => setActiveTab(t.key)}
            style={{
              flex: 1,
              padding: '8px 4px',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: activeTab === t.key ? 700 : 500,
              background: activeTab === t.key ? '#fff' : 'transparent',
              color: activeTab === t.key ? '#1e3a5f' : '#64748b',
              boxShadow: activeTab === t.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              position: 'relative',
            }}
          >
            {t.label}
            {t.badge && (
              <span style={{ position: 'absolute', top: 4, right: 8, width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />
            )}
          </button>
        ))}
      </div>

      {/* Contenuto tab */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Caricamento...</div>
      ) : (
        <>
          {/* Tab: Agenti */}
          {activeTab === 'agenti' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {stati.length === 0 ? (
                <EmptyState label="Nessun agente registrato" sub="Esegui gli agenti per inizializzare i dati" />
              ) : stati.map(a => (
                <AgenteCard key={a.agente} agente={a} onRun={eseguiOra} />
              ))}
            </div>
          )}

          {/* Tab: Urgenti */}
          {activeTab === 'urgente' && (
            <div>
              {[...segnalazioniPerTipo('urgente'), ...segnalazioniPerTipo('anomalia')].length === 0
                ? <EmptyState label="Nessuna segnalazione urgente" sub="Tutto in ordine" icon="shield" />
                : [...segnalazioniPerTipo('urgente'), ...segnalazioniPerTipo('anomalia')].map(s =>
                    <SegnalazioneCard key={s.id} s={s} onRisolvi={risolviSegnalazione} />
                  )
              }
            </div>
          )}

          {/* Tab: Avvisi */}
          {activeTab === 'avviso' && (
            <div>
              {segnalazioniPerTipo('avviso').length === 0
                ? <EmptyState label="Nessun avviso attivo" sub="Tutto regolare" />
                : segnalazioniPerTipo('avviso').map(s =>
                    <SegnalazioneCard key={s.id} s={s} onRisolvi={risolviSegnalazione} />
                  )
              }
            </div>
          )}

          {/* Tab: Info */}
          {activeTab === 'info' && (
            <div>
              {segnalazioniPerTipo('info').length === 0
                ? <EmptyState label="Nessuna informazione" sub="" />
                : segnalazioniPerTipo('info').map(s =>
                    <SegnalazioneCard key={s.id} s={s} onRisolvi={risolviSegnalazione} />
                  )
              }
            </div>
          )}

          {/* Tab: Suggerimenti */}
          {activeTab === 'suggerimento' && (
            <div>
              {segnalazioniPerTipo('suggerimento').length === 0
                ? <EmptyState label="Nessun suggerimento" sub="" />
                : segnalazioniPerTipo('suggerimento').map(s =>
                    <SegnalazioneCard key={s.id} s={s} onRisolvi={risolviSegnalazione} />
                  )
              }
            </div>
          )}

          {/* Tab: Pattern */}
          {activeTab === 'pattern' && (
            <div>
              {pattern.length === 0 ? (
                <EmptyState label="Nessun pattern appreso" sub="La Learning Machine impara dalle tue azioni nel tempo" icon="brain" />
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                    {Array.from(new Set(pattern.map(p => p.categoria))).map(cat => (
                      <span key={cat} style={{ background: '#eff6ff', color: '#2563eb', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, cursor: 'pointer' }}>
                        {cat}
                      </span>
                    ))}
                  </div>
                  {pattern.map(p => <PatternCard key={p.id || p.chiave} p={p} />)}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState({ label, sub, icon }) {
  return (
    <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" style={{ margin: '0 auto 12px', display: 'block' }}>
        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <p style={{ fontWeight: 600, margin: 0, color: '#475569' }}>{label}</p>
      {sub && <p style={{ fontSize: 13, margin: '4px 0 0' }}>{sub}</p>}
    </div>
  );
}
