import React from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

export default function TracciabilitaPage() {
  const src = `${BACKEND_URL}/api/tracciabilita/`;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 56px)',
      background: '#f5f5f5',
    }}>
      {/* Header barra contestuale */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 20px',
        background: '#1e293b',
        borderBottom: '2px solid #0ea5e9',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 18 }}>🔬</span>
        <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 15 }}>
          Tracciabilità & HACCP
        </span>
        <span style={{ color: '#94a3b8', fontSize: 12, marginLeft: 4 }}>
          — Mini-sito integrato (dati condivisi con il gestionale)
        </span>
        <div style={{ flex: 1 }} />
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          style={{
            color: '#0ea5e9',
            fontSize: 12,
            textDecoration: 'none',
            padding: '4px 10px',
            border: '1px solid #0ea5e9',
            borderRadius: 4,
          }}
        >
          Apri in nuova scheda
        </a>
      </div>

      {/* Iframe mini-sito */}
      <iframe
        src={src}
        title="Tracciabilità HACCP"
        style={{
          flex: 1,
          border: 'none',
          width: '100%',
          background: '#fff',
        }}
        allow="clipboard-write"
        data-testid="tracciabilita-iframe"
      />
    </div>
  );
}
