import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';

const TIPO_CONFIG = {
  urgente:     { bg: '#fef2f2', border: '#ef4444', text: '#dc2626', dot: '#ef4444', label: 'URGENTE' },
  anomalia:    { bg: '#fef2f2', border: '#ef4444', text: '#dc2626', dot: '#ef4444', label: 'ANOMALIA' },
  avviso:      { bg: '#fffbeb', border: '#f59e0b', text: '#d97706', dot: '#f59e0b', label: 'AVVISO' },
  info:        { bg: '#eff6ff', border: '#3b82f6', text: '#2563eb', dot: '#3b82f6', label: 'INFO' },
  suggerimento:{ bg: '#f0fdf4', border: '#22c55e', text: '#16a34a', dot: '#22c55e', label: 'SUGGERIM.' },
};

export function AgentiPanel() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [segnalazioni, setSegnalazioni] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadCount = useCallback(async () => {
    try {
      const res = await api.get('/api/agenti/segnalazioni/count');
      setCount(res.data.non_lette || 0);
    } catch {
      // silenzioso
    }
  }, []);

  const loadSegnalazioni = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/agenti/segnalazioni?non_lette=false&limit=30');
      setSegnalazioni(res.data.segnalazioni || []);
    } catch {
      // silenzioso
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCount();
    const interval = setInterval(loadCount, 60000);
    return () => clearInterval(interval);
  }, [loadCount]);

  useEffect(() => {
    if (open) loadSegnalazioni();
  }, [open, loadSegnalazioni]);

  const segnaLetta = async (id) => {
    try {
      await api.put(`/api/agenti/segnalazioni/${id}/letta`);
      setSegnalazioni(prev => prev.map(s => s.id === id ? { ...s, letta: true } : s));
      setCount(prev => Math.max(0, prev - 1));
    } catch { /* silenzioso */ }
  };

  const segnaRisolta = async (id) => {
    try {
      await api.put(`/api/agenti/segnalazioni/${id}/risolta`);
      setSegnalazioni(prev => prev.filter(s => s.id !== id));
      setCount(prev => Math.max(0, prev - 1));
    } catch { /* silenzioso */ }
  };

  const cfg = (tipo) => TIPO_CONFIG[tipo] || TIPO_CONFIG.info;

  return (
    <>
      {/* Badge pulsante */}
      <button
        data-testid="agenti-panel-toggle"
        onClick={() => setOpen(true)}
        style={{
          position: 'relative',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '6px 8px',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          color: '#64748b',
          fontSize: 13,
          fontWeight: 500,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        title="Segnalazioni Agenti AI"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {count > 0 && (
          <span style={{
            position: 'absolute',
            top: 2,
            right: 2,
            background: '#ef4444',
            color: 'white',
            borderRadius: '50%',
            width: 16,
            height: 16,
            fontSize: 10,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
          }}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {/* Sidebar destra */}
      {open && (
        <>
          {/* Overlay */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.3)',
              zIndex: 9000,
            }}
          />

          {/* Pannello */}
          <div
            data-testid="agenti-panel"
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: 420,
              maxWidth: '100vw',
              background: '#fff',
              boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
              zIndex: 9001,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: '#1e3a5f',
              color: '#fff',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
              </svg>
              <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>Agenti AI — Segnalazioni</span>
              {count > 0 && (
                <span style={{
                  background: '#ef4444',
                  color: '#fff',
                  borderRadius: 12,
                  padding: '2px 8px',
                  fontSize: 12,
                  fontWeight: 700,
                }}>
                  {count} non lette
                </span>
              )}
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: 6,
                  fontSize: 16,
                }}
              >
                ✕
              </button>
            </div>

            {/* Lista segnalazioni */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                  Caricamento...
                </div>
              ) : segnalazioni.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" style={{ margin: '0 auto 12px', display: 'block' }}>
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <p style={{ fontWeight: 600, margin: 0 }}>Tutto in ordine</p>
                  <p style={{ fontSize: 13, margin: '4px 0 0' }}>Nessuna segnalazione attiva</p>
                </div>
              ) : (
                segnalazioni.map(s => {
                  const c = cfg(s.tipo);
                  return (
                    <div
                      key={s.id}
                      data-testid={`segnalazione-${s.id}`}
                      style={{
                        marginBottom: 12,
                        background: s.letta ? '#f8fafc' : c.bg,
                        border: `1px solid ${s.letta ? '#e2e8f0' : c.border}`,
                        borderRadius: 10,
                        padding: 14,
                        opacity: s.risolta ? 0.5 : 1,
                      }}
                    >
                      {/* Header segnalazione */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                        <span style={{
                          background: c.dot,
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          marginTop: 5,
                          flexShrink: 0,
                        }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <span style={{
                              background: c.dot,
                              color: '#fff',
                              fontSize: 9,
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: 4,
                              letterSpacing: '0.05em',
                            }}>
                              {c.label}
                            </span>
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>
                              {s.agente}
                            </span>
                            {!s.letta && (
                              <span style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                background: '#3b82f6',
                                display: 'inline-block',
                                marginLeft: 2,
                              }} />
                            )}
                          </div>
                          <p style={{
                            margin: 0,
                            fontWeight: 600,
                            fontSize: 13,
                            color: '#1e293b',
                            lineHeight: 1.4,
                          }}>
                            {s.titolo}
                          </p>
                        </div>
                      </div>

                      {/* Descrizione */}
                      <p style={{
                        margin: '0 0 8px 16px',
                        fontSize: 12,
                        color: '#475569',
                        lineHeight: 1.6,
                      }}>
                        {s.descrizione}
                      </p>

                      {/* Azione suggerita */}
                      {s.azione_suggerita && (
                        <div style={{
                          margin: '0 0 8px 16px',
                          fontSize: 11,
                          color: c.text,
                          fontWeight: 600,
                          background: `${c.dot}15`,
                          padding: '4px 8px',
                          borderRadius: 4,
                        }}>
                          Azione: {s.azione_suggerita}
                        </div>
                      )}

                      {/* Azioni */}
                      <div style={{ display: 'flex', gap: 6, marginLeft: 16 }}>
                        {!s.letta && (
                          <button
                            onClick={() => segnaLetta(s.id)}
                            style={{
                              background: '#f1f5f9',
                              border: 'none',
                              borderRadius: 6,
                              padding: '4px 10px',
                              fontSize: 11,
                              cursor: 'pointer',
                              color: '#475569',
                              fontWeight: 500,
                            }}
                          >
                            Segna letta
                          </button>
                        )}
                        <button
                          onClick={() => segnaRisolta(s.id)}
                          style={{
                            background: '#dcfce7',
                            border: 'none',
                            borderRadius: 6,
                            padding: '4px 10px',
                            fontSize: 11,
                            cursor: 'pointer',
                            color: '#16a34a',
                            fontWeight: 600,
                          }}
                        >
                          Risolto
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '10px 16px',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
            }}>
              <button
                onClick={loadSegnalazioni}
                style={{
                  width: '100%',
                  background: '#1e3a5f',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 0',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Aggiorna segnalazioni
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
