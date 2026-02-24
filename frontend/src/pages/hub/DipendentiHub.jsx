import React, { lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';

const DipendentiContent = lazy(() => import('../GestioneDipendentiUnificata.jsx'));
const PresenzeContent = lazy(() => import('../Attendance.jsx'));
const FerieContent = lazy(() => import('../SaldiFeriePermessi.jsx'));
const CedoliniContent = lazy(() => import('../Cedolini.jsx'));
const TFRContent = lazy(() => import('../TFR.jsx'));

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

export default function DipendentiHub() {
  const location = useLocation();
  const path = location.pathname;

  // Determina quale contenuto mostrare
  const getContent = () => {
    if (path.includes('/attendance') || path.includes('/presenze')) {
      return <PresenzeContent />;
    }
    if (path.includes('/cedolini')) {
      return <CedoliniContent />;
    }
    if (path.includes('/tfr')) {
      return <TFRContent />;
    }
    if (path.includes('/ferie') || path.includes('/saldi-ferie')) {
      return <FerieContent />;
    }
    // Default: anagrafica dipendenti
    return <DipendentiContent />;
  };

  return (
    <div style={{ padding: '16px 24px', minHeight: '100vh', background: '#f8fafc' }}>
      <Suspense fallback={<Loading />}>
        {getContent()}
      </Suspense>
    </div>
  );
}
