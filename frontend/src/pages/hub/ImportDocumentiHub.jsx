import React, { lazy } from 'react';
import { SectionPage } from '../../components/SectionPage';
import { Download, Brain, Wand2 } from 'lucide-react';

const ImportContent = lazy(() => import('../ImportDocumenti.jsx'));
const ImportAIContent = lazy(() => import('../ImportDocumentiAI.jsx'));
const CorrezioneContent = lazy(() => import('../CorrezioneAI.jsx'));

export default function ImportDocumentiHub() {
  const sections = [
    {
      id: 'import',
      label: 'Import Documenti',
      icon: <Download size={16} />,
      desc: 'Caricamento file, estratti conto, fatture, F24',
      component: <ImportContent />
    },
    {
      id: 'ai',
      label: 'Import AI',
      icon: <Brain size={16} />,
      desc: 'Parsing automatico documenti con intelligenza artificiale',
      component: <ImportAIContent />
    },
    {
      id: 'correzione',
      label: 'Correzione AI',
      icon: <Wand2 size={16} />,
      desc: 'Verifica e correzione automatica dati importati',
      component: <CorrezioneContent />
    }
  ];

  return <SectionPage title="Import Documenti" icon={<Download size={22} />} sections={sections} defaultOpen="import" />;
}
