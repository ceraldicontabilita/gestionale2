import React, { lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';

const ProdottiContent = lazy(() => import('../DizionarioProdotti.jsx'));
const CentriCostoContent = lazy(() => import('../CentriCosto.jsx'));
const UtileContent = lazy(() => import('../UtileObiettivo.jsx'));
const LearningContent = lazy(() => import('../LearningMachine.jsx'));

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

export default function CucinaHub() {
  const location = useLocation();
  const path = location.pathname;

  const getContent = () => {
    if (path.includes('/centri-costo')) return <CentriCostoContent />;
    if (path.includes('/utile-obiettivo')) return <UtileContent />;
    if (path.includes('/learning')) return <LearningContent />;
    return <ProdottiContent />;
  };

  return (
    <div style={{ padding: '16px 24px', minHeight: '100vh', background: '#f8fafc' }}>
      <Suspense fallback={<Loading />}>
        {getContent()}
      </Suspense>
    </div>
  );
}
