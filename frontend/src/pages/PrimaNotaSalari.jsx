import React from 'react';
import { PrimaNotaSalariTab } from '../components/prima-nota';
import { STYLES, COLORS, button, badge, formatEuro, formatDateIT } from '../lib/utils';
import { PageLayout } from '../components/PageLayout';

/**
 * Pagina standalone per Prima Nota Salari
 * Accessibile da menu laterale sotto "Dipendenti"
 */
export default function PrimaNotaSalari() {
  return (
    <PageLayout title="Prima Nota Salari" icon="💰" subtitle="Registro dei pagamenti stipendi e contributi">
      <PrimaNotaSalariTab />
    </PageLayout>
  );
}
