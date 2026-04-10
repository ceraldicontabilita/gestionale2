import React, { useState, useEffect } from 'react';
import api from '../api';
import { STYLES, COLORS, formatEuro } from '../lib/utils';
import { ExternalLink, RefreshCw, CheckCircle, AlertTriangle, Clock, Package } from 'lucide-react';

const CERALDIAPP_URL = 'https://ceraldiapp.it';

export default function TracciabilitaPage() {
  const [sync, setSync]       = useState(null);
  const [oggi, setOggi]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [statusRes, oggiRes] = await Promise.allSettled([
        api.get('/api/erp/ponte/status'),
        api.get('/api/tr/produzioni/per-oggi'),
      ]);
      if (statusRes.status === 'fulfilled') setSync(statusRes.value.data);
      if (oggiRes.status === 'fulfilled')   setOggi(oggiRes.value.data);
      setLastUpdate(new Date());
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const fmtTime = (d) => d
    ? d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div style={{ maxWidth: 720, margin: '40px auto', padding: '0 24px' }}>

      {/* Titolo */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ ...STYLES.h1, marginBottom: 6 }}>🏭 Tracciabilità & HACCP</h1>
        <p style={{ color: '#64748b', fontSize: 14 }}>
          Il modulo HACCP è gestito su <strong>ceraldiapp.it</strong>, che condivide lo stesso
          database MongoDB. Le fatture importate dalla Tracciabilità appaiono automaticamente
          nel Ciclo Passivo di questo gestionale.
        </p>
      </div>

      {/* Bottone principale */}
      <div style={{
        background: 'linear-gradient(135deg, #1E1B4B 0%, #5D29C7 100%)',
        borderRadius: 16,
        padding: 32,
        marginBottom: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20,
        boxShadow: '0 4px 24px rgba(93,41,199,0.3)',
      }}>
        <div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 4, fontWeight: 600, letterSpacing: 1 }}>
            SITO ESTERNO
          </div>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
            ceraldiapp.it
          </div>
          <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>
            Lotti · Produzioni · HACCP · Temperature · Ricette · Ordini
          </div>
        </div>
        <a
          href={CERALDIAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '14px 24px',
            background: '#fff',
            color: '#5D29C7',
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 15,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          Apri <ExternalLink size={16} />
        </a>
      </div>

      {/* Pannello stato sincronizzazione */}
      <div style={{ ...STYLES.card, marginBottom: 20 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 20,
        }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>
            📡 Stato sincronizzazione DB
          </div>
          <button
            onClick={load}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0',
              background: '#f8fafc', color: '#64748b', fontSize: 12,
              fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Aggiorna
          </button>
          <style>{`@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
        </div>

        {loading && !sync ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8', fontSize: 14 }}>
            Caricamento...
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

            {/* Ponte ERP */}
            <StatBox
              icon={<CheckCircle size={18} color={sync?.ok ? COLORS.success : COLORS.danger} />}
              label="Ponte ERP"
              value={sync?.ok ? 'Connesso' : 'Offline'}
              sub={sync ? `${sync.fatture_da_tracciabilita ?? 0} fatture sincronizzate` : '—'}
              color={sync?.ok ? COLORS.success : COLORS.danger}
            />

            {/* Produzioni oggi */}
            <StatBox
              icon={<Package size={18} color={COLORS.primary || '#5D29C7'} />}
              label="Produzioni oggi"
              value={
                oggi
                  ? Array.isArray(oggi) ? oggi.length : (oggi.count ?? oggi.total ?? '—')
                  : '—'
              }
              sub="da ceraldiapp.it"
              color="#5D29C7"
            />

            {/* Database condiviso */}
            <StatBox
              icon={<CheckCircle size={18} color={COLORS.success} />}
              label="Database"
              value="MongoDB Atlas"
              sub="db=Gestionale · cluster condiviso"
              color={COLORS.success}
            />

            {/* Ultimo aggiornamento */}
            <StatBox
              icon={<Clock size={18} color="#64748b" />}
              label="Ultimo controllo"
              value={fmtTime(lastUpdate)}
              sub="aggiornamento manuale o al caricamento"
              color="#64748b"
            />

          </div>
        )}
      </div>

      {/* Nota tecnica */}
      <div style={{
        background: '#f0f4fa',
        borderRadius: 10,
        padding: '14px 18px',
        fontSize: 12,
        color: '#64748b',
        lineHeight: 1.6,
      }}>
        <strong style={{ color: '#334155' }}>Come funziona la sincronizzazione:</strong>{' '}
        ceraldiapp.it scrive direttamente su MongoDB Atlas (db=Gestionale). Quando importa
        una fattura fornitore dalla PEC, notifica questo gestionale via{' '}
        <code style={{ background: '#e2e8f0', padding: '1px 5px', borderRadius: 4 }}>
          POST /api/erp/ponte/fattura-ricevuta
        </code>
        , che esegue un upsert in <code style={{ background: '#e2e8f0', padding: '1px 5px', borderRadius: 4 }}>fatture_passive</code> evitando duplicati.
      </div>

    </div>
  );
}

function StatBox({ icon, label, value, sub, color }) {
  return (
    <div style={{
      background: '#f8fafc',
      border: `1px solid ${color}22`,
      borderRadius: 12,
      padding: '16px 18px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {icon}
        <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.5, textTransform: 'uppercase' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#94a3b8' }}>{sub}</div>
    </div>
  );
}
