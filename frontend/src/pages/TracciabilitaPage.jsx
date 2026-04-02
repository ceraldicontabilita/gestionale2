import React from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

export default function TracciabilitaPage() {
  const src = `${BACKEND_URL}/api/tracciabilita/`;

  return (
    <iframe
      src={src}
      title="Tracciabilità HACCP"
      style={{
        display: 'block',
        width: '100%',
        height: 'calc(100vh - 56px)',
        border: 'none',
        background: '#fff',
      }}
      allow="clipboard-write"
      data-testid="tracciabilita-iframe"
    />
  );
}
