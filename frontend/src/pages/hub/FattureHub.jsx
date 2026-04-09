import React, { lazy, Suspense, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAnnoGlobale } from '../../contexts/AnnoContext';

const ArchivioContent      = lazy(() => import('../ArchivioFattureRicevute.jsx'));
const CorrispettiviContent = lazy(() => import('../Corrispettivi.jsx'));

const Loading = () => (
  <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
    <div style={{ width: 32, height: 32, border: '3px solid #e2e8f0', borderTop: '3px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
    <style>{`@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
    Caricamento...
  </div>
);

export default function FattureHub() {
  const { anno } = useAnnoGlobale();
  const location = useLocation();
  const isCorresp = location.pathname.includes('/corrispettivi');

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '16px 24px' }}>
      <Suspense fallback={<Loading />}>
        {isCorresp ? <CorrispettiviContent /> : <ArchivioContent />}
      </Suspense>
    </div>
  );
}
