import React, { lazy } from 'react';
import { SectionPage } from '../../components/SectionPage';
import { FolderOpen, AlertTriangle, Mail, Tag } from 'lucide-react';

const DocumentiContent = lazy(() => import('../Documenti.jsx'));
const DaRivedereContent = lazy(() => import('../DocumentiDaRivedere.jsx'));
const ClassificazioneContent = lazy(() => import('../ClassificazioneDocumenti.jsx'));
const RegoleCatContent = lazy(() => import('../RegoleCategorizzazione.jsx'));

export default function DocumentiHub() {
  const sections = [
    {
      id: 'documenti',
      label: 'Documenti Email',
      icon: <FolderOpen size={16} />,
      desc: 'Archivio documenti scaricati da email',
      component: <DocumentiContent />
    },
    {
      id: 'da-rivedere',
      label: 'Da Rivedere',
      icon: <AlertTriangle size={16} />,
      desc: 'Documenti che richiedono revisione manuale',
      component: <DaRivedereContent />
    },
    {
      id: 'classificazione',
      label: 'Classificazione Email AI',
      icon: <Mail size={16} />,
      desc: 'Classificazione automatica email con AI',
      component: <ClassificazioneContent />
    },
    {
      id: 'regole',
      label: 'Regole Categorizzazione',
      icon: <Tag size={16} />,
      desc: 'Regole per categorizzazione automatica',
      component: <RegoleCatContent />
    }
  ];

  return <SectionPage title="Documenti" icon={<FolderOpen size={22} />} sections={sections} defaultOpen="documenti" />;
}
