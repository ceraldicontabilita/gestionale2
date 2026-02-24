import React, { lazy } from 'react';
import { SectionPage } from '../../components/SectionPage';
import { Shield, BookOpen, RotateCw, Layers } from 'lucide-react';

const AdminContent = lazy(() => import('../Admin.jsx'));
const RegoleContent = lazy(() => import('../RegoleContabili.jsx'));
const BatchContent = lazy(() => import('../BatchReprocessing.jsx'));
const BatchProcContent = lazy(() => import('../BatchProcessor.jsx'));

export default function AdminHub() {
  const sections = [
    {
      id: 'admin',
      label: 'Pannello Admin',
      icon: <Shield size={16} />,
      desc: 'Utenti, configurazioni, sistema',
      component: <AdminContent />
    },
    {
      id: 'regole',
      label: 'Regole Contabili',
      icon: <BookOpen size={16} />,
      desc: 'Configurazione regole contabilizzazione automatica',
      component: <RegoleContent />
    },
    {
      id: 'batch',
      label: 'Batch Reprocessing',
      icon: <RotateCw size={16} />,
      desc: 'Rielaborazione batch documenti',
      component: <BatchContent />
    },
    {
      id: 'processor',
      label: 'Batch Processor',
      icon: <Layers size={16} />,
      desc: 'Elaborazione massiva documenti',
      component: <BatchProcContent />
    }
  ];

  return <SectionPage title="Amministrazione" icon={<Shield size={22} />} sections={sections} defaultOpen="admin" />;
}
