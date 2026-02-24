import React, { lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';

const DocumentiContent = lazy(() => import('../Documenti.jsx'));
const DaRivedereContent = lazy(() => import('../DocumentiDaRivedere.jsx'));
const ClassificazioneContent = lazy(() => import('../ClassificazioneDocumenti.jsx'));
const RegoleCatContent = lazy(() => import('../RegoleCategorizzazione.jsx'));

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

export default function DocumentiHub() {
  const location = useLocation();
  const path = location.pathname;

  const getContent = () => {
    if (path.includes('/documenti-da-rivedere')) return <DaRivedereContent />;
    if (path.includes('/classificazione')) return <ClassificazioneContent />;
    if (path.includes('/regole-categorizzazione')) return <RegoleCatContent />;
    return <DocumentiContent />;
  };

  return (
    <div style={{ padding: '16px 24px', minHeight: '100vh', background: '#f8fafc' }}>
      <Suspense fallback={<Loading />}>
        {getContent()}
      </Suspense>
    </div>
  );
}
