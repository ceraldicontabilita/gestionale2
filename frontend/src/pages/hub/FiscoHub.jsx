import React, { lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';

const IVAContent = lazy(() => import('../IVA.jsx'));
const LiquidazioneIVAContent = lazy(() => import('../LiquidazioneIVA.jsx'));
const F24Content = lazy(() => import('../F24.jsx'));
const RiconciliazioneF24Content = lazy(() => import('../RiconciliazioneF24.jsx'));
const CodiciContent = lazy(() => import('../CodiciTributari.jsx'));
const IRESContent = lazy(() => import('../ContabilitaAvanzata.jsx'));

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

export default function FiscoHub() {
  const location = useLocation();
  const path = location.pathname;

  // Determina quale contenuto mostrare basandosi sulla route
  const getContent = () => {
    if (path.includes('/f24') && !path.includes('riconciliazione')) {
      return <F24Content />;
    }
    if (path.includes('/iva')) {
      return <LiquidazioneIVAContent />;
    }
    // /fisco = Calcolo IVA (pagina principale)
    return <IVAContent />;
  };

  return (
    <div style={{ padding: '16px 24px', minHeight: '100vh', background: '#f8fafc' }}>
      <Suspense fallback={<Loading />}>
        {getContent()}
      </Suspense>
    </div>
  );
}
