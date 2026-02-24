import React, { lazy } from 'react';
import { SectionPage } from '../../components/SectionPage';
import { BarChart3, TrendingUp } from 'lucide-react';

const DashboardContent = lazy(() => import('../Dashboard.jsx'));
const AnalyticsContent = lazy(() => import('../DashboardAnalytics.jsx'));

export default function DashboardHub() {
  const sections = [
    {
      id: 'operativa',
      label: 'Dashboard Operativa',
      icon: <BarChart3 size={16} />,
      desc: 'Panoramica generale, statistiche, scadenze',
      component: <DashboardContent />
    },
    {
      id: 'analytics',
      label: 'Analytics Avanzate',
      icon: <TrendingUp size={16} />,
      desc: 'Analisi dettagliata, trend, confronti periodi',
      component: <AnalyticsContent />
    }
  ];

  return <SectionPage title="Dashboard" icon={<BarChart3 size={22} />} sections={sections} defaultOpen="operativa" />;
}
