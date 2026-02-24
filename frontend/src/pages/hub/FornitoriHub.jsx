import React, { lazy } from 'react';
import { SectionPage } from '../../components/SectionPage';
import { Package, ShoppingCart, TrendingUp } from 'lucide-react';

const FornitoriContent = lazy(() => import('../Fornitori.jsx'));
const OrdiniContent = lazy(() => import('../OrdiniFornitori.jsx'));
const PrevisioniContent = lazy(() => import('../PrevisioniAcquisti.jsx'));

export default function FornitoriHub() {
  const sections = [
    {
      id: 'anagrafica',
      label: 'Anagrafica Fornitori',
      icon: <Package size={16} />,
      desc: 'Gestione fornitori, contatti, condizioni',
      component: <FornitoriContent />
    },
    {
      id: 'ordini',
      label: 'Ordini Fornitori',
      icon: <ShoppingCart size={16} />,
      desc: 'Ordini di acquisto, tracking consegne',
      component: <OrdiniContent />
    },
    {
      id: 'previsioni',
      label: 'Previsioni Acquisti',
      icon: <TrendingUp size={16} />,
      desc: 'Analisi fabbisogni e previsioni ordini',
      component: <PrevisioniContent />
    }
  ];

  return <SectionPage title="Fornitori & Acquisti" icon={<Package size={22} />} sections={sections} defaultOpen="anagrafica" />;
}
