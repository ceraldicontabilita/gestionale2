import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const TIPI = [
  { key: 'urgente', label: 'Urgenti', color: '#ef4444', bg: '#fef2f2' },
  { key: 'avviso', label: 'Avvisi', color: '#f59e0b', bg: '#fffbeb' },
  { key: 'info', label: 'Info', color: '#3b82f6', bg: '#eff6ff' },
  { key: 'suggerimento', label: 'Suggerimenti', color: '#22c55e', bg: '#f0fdf4' },
];

function minutiFa(iso) {
  if (!iso) return null;
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'adesso';
  if (diff < 60) return `${diff} min fa`;
  const h = Math.floor(diff / 60);
  return `${h}h fa`;
}

export default function WidgetAgenti() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState({
    urgente: 0,
    avviso: 0,
    info: 0,
    suggerimento: 0,
    totale: 0,
  });
  const [lastUpdate, setLastUpdate] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/api/agenti/segnalazioni/summary');
      setSummary(res.data);
      setLastUpdate(new Date().toISOString());
    } catch {
      // silenzioso
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 5 * 60 * 1000); // 5 minuti
    return () => clearInterval(iv);
  }, [load]);

  if (loading) return null;
  if (summary.totale === 0 && !loading) return null; // Nasconde se nessuna segnalazione

  return (
    <div
      data-testid="widget-agenti"
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: '14px 18px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        marginBottom: 16,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: '#1e3a5f',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#7dd3fc"
              strokeWidth="2.5"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>Agenti AI</span>
        </div>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>
          {lastUpdate ? `Aggiornato ${minutiFa(lastUpdate)}` : ''}
        </span>
      </div>

      {/* Contatori */}
      <div style={{ display: 'flex', gap: 8 }}>
        {TIPI.map(t => (
          <button
            key={t.key}
            data-testid={`widget-agenti-${t.key}`}
            onClick={() => navigate(`/agenti`)}
            style={{
              flex: 1,
              background: summary[t.key] > 0 ? t.bg : '#f8fafc',
              border: `1px solid ${summary[t.key] > 0 ? t.color + '40' : '#e2e8f0'}`,
              borderRadius: 8,
              padding: '8px 4px',
              cursor: 'pointer',
              transition: 'transform 0.1s',
              textAlign: 'center',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.03)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: summary[t.key] > 0 ? t.color : '#cbd5e1',
                lineHeight: 1,
                marginBottom: 3,
              }}
            >
              {summary[t.key]}
            </div>
            <div
              style={{
                fontSize: 10,
                color: summary[t.key] > 0 ? t.color : '#94a3b8',
                fontWeight: 600,
              }}
            >
              {t.label}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
