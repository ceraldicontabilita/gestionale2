import React, { lazy } from 'react';
import { SectionPage } from '../../components/SectionPage';
import { BookOpen, FileInput } from 'lucide-react';

const PrimaNotaContent = lazy(() => import('../PrimaNota.jsx'));
const DatiProvvisoriContent = lazy(() => import('../DatiProvvisori.jsx'));

export default function PrimaNotaHub() {
  const sections = [
    {
      id: 'prima-nota',
      label: 'Prima Nota Cassa & Banca',
      icon: <BookOpen size={16} />,
      desc: 'Registrazioni contabili cassa e banca',
      component: <PrimaNotaContent />
    },
    {
      id: 'provvisori',
      label: 'Dati Provvisori',
      icon: <FileInput size={16} />,
      desc: 'Movimenti da confermare e classificare',
      component: <DatiProvvisoriContent />
    }
  ];

  return <SectionPage title="Prima Nota" icon={<BookOpen size={22} />} sections={sections} defaultOpen="prima-nota" />;
}
