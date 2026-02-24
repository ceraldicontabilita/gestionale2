import React, { lazy } from 'react';
import { SectionPage } from '../../components/SectionPage';
import { CheckCircle, Briefcase, CalendarDays, Mail, Search } from 'lucide-react';

const VerificaContent = lazy(() => import('../VerificaCoerenza.jsx'));
const CommercialistaContent = lazy(() => import('../Commercialista.jsx'));
const PianificazioneContent = lazy(() => import('../Pianificazione.jsx'));
const EmailContent = lazy(() => import('../EmailDownloadManager.jsx'));
const VisureContent = lazy(() => import('../Visure.jsx'));

export default function StrumentiHub() {
  const sections = [
    {
      id: 'verifica',
      label: 'Verifica Coerenza',
      icon: <CheckCircle size={16} />,
      desc: 'Controllo incrociato dati contabili',
      component: <VerificaContent />
    },
    {
      id: 'commercialista',
      label: 'Commercialista',
      icon: <Briefcase size={16} />,
      desc: 'Export dati per studio commercialista',
      component: <CommercialistaContent />
    },
    {
      id: 'pianificazione',
      label: 'Pianificazione',
      icon: <CalendarDays size={16} />,
      desc: 'Pianificazione fiscale e finanziaria',
      component: <PianificazioneContent />
    },
    {
      id: 'email',
      label: 'Download Email',
      icon: <Mail size={16} />,
      desc: 'Scarica e archivia email con allegati',
      component: <EmailContent />
    },
    {
      id: 'visure',
      label: 'Visure Aziendali',
      icon: <Search size={16} />,
      desc: 'Ricerca visure camerali e dati aziendali',
      component: <VisureContent />
    }
  ];

  return <SectionPage title="Strumenti" icon={<CheckCircle size={22} />} sections={sections} defaultOpen="verifica" />;
}
