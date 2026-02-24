import React, { lazy } from 'react';
import { SectionPage } from '../../components/SectionPage';
import { FileText, Receipt } from 'lucide-react';

const FattureContent = lazy(() => import('../ArchivioFattureRicevute.jsx'));
const CorrispettiviContent = lazy(() => import('../Corrispettivi.jsx'));

export default function CicloPassivoHub() {
  const sections = [
    {
      id: 'fatture',
      label: 'Fatture Ricevute / Ciclo Passivo',
      icon: <FileText size={16} />,
      desc: 'Archivio fatture fornitori, registrazione e contabilizzazione',
      component: <FattureContent />
    },
    {
      id: 'corrispettivi',
      label: 'Corrispettivi',
      icon: <Receipt size={16} />,
      desc: 'Registrazione corrispettivi giornalieri',
      component: <CorrispettiviContent />
    }
  ];

  return <SectionPage title="Ciclo Passivo & Vendite" icon={<FileText size={22} />} sections={sections} defaultOpen="fatture" />;
}
