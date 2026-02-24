import React, { lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';

const PrimaNotaContent = lazy(() => import('../PrimaNota.jsx'));
const DatiProvvisoriContent = lazy(() => import('../DatiProvvisori.jsx'));

const Loading = () => (
  <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
    <div style={{
      width: 32, height: 32,
      border: '3px solid #e2e8f0',
      borderTop: '3px solid #2563eb',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
      margin: '0 auto 12px'
    }} />
    Caricamento...
  </div>
);

export default function PrimaNotaHub() {
  const location = useLocation();
  const path = location.pathname;

  // Determina quale contenuto mostrare
  const getContent = () => {
    if (path.includes('provvisori') || path.includes('dati-provvisori')) {
      return <DatiProvvisoriContent />;
    }
    // Default: Prima Nota
    return <PrimaNotaContent />;
  };

  return (
    <div style={{ padding: '16px 24px', minHeight: '100vh', background: '#f8fafc' }}>
      <Suspense fallback={<Loading />}>
        {getContent()}
      </Suspense>
    </div>
  );
}
