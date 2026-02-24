import React, { lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';

const VerificaContent = lazy(() => import('../VerificaCoerenza.jsx'));
const CommercialistaContent = lazy(() => import('../Commercialista.jsx'));
const PianificazioneContent = lazy(() => import('../Pianificazione.jsx'));
const EmailContent = lazy(() => import('../EmailDownloadManager.jsx'));
const VisureContent = lazy(() => import('../Visure.jsx'));

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

export default function StrumentiHub() {
  const location = useLocation();
  const path = location.pathname;

  const getContent = () => {
    if (path.includes('/commercialista')) return <CommercialistaContent />;
    if (path.includes('/pianificazione')) return <PianificazioneContent />;
    if (path.includes('/email-download')) return <EmailContent />;
    if (path.includes('/visure')) return <VisureContent />;
    return <VerificaContent />;
  };

  return (
    <div style={{ padding: '16px 24px', minHeight: '100vh', background: '#f8fafc' }}>
      <Suspense fallback={<Loading />}>
        {getContent()}
      </Suspense>
    </div>
  );
}
