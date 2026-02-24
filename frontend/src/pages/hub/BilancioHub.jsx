import React, { lazy } from 'react';
import { SectionPage } from '../../components/SectionPage';
import { BarChart3, CheckSquare, BookOpen, Target } from 'lucide-react';

const BilancioContent = lazy(() => import('../Bilancio.jsx'));
const VerificaContent = lazy(() => import('../BilancioVerifica.jsx'));
const PartitarioContent = lazy(() => import('../PartitarioCliFor.jsx'));
const BudgetContent = lazy(() => import('../BudgetPrevisionale.jsx'));

export default function BilancioHub() {
  const sections = [
    {
      id: 'bilancio',
      label: 'Bilancio',
      icon: <BarChart3 size={16} />,
      desc: 'Stato patrimoniale, conto economico',
      component: <BilancioContent />
    },
    {
      id: 'verifica',
      label: 'Bilancio di Verifica',
      icon: <CheckSquare size={16} />,
      desc: 'Quadratura saldi dare/avere',
      component: <VerificaContent />
    },
    {
      id: 'partitario',
      label: 'Partitario Clienti/Fornitori',
      icon: <BookOpen size={16} />,
      desc: 'Schede contabili clienti e fornitori',
      component: <PartitarioContent />
    },
    {
      id: 'budget',
      label: 'Budget Previsionale',
      icon: <Target size={16} />,
      desc: 'Previsioni economiche e scostamenti',
      component: <BudgetContent />
    }
  ];

  return <SectionPage title="Bilancio" icon={<BarChart3 size={22} />} sections={sections} defaultOpen="bilancio" />;
}
