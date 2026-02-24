import React, { lazy } from 'react';
import { SectionPage } from '../../components/SectionPage';
import { Receipt, FileText, Hash, Calculator } from 'lucide-react';

const IVAContent = lazy(() => import('../IVA.jsx'));
const LiquidazioneIVAContent = lazy(() => import('../LiquidazioneIVA.jsx'));
const F24Content = lazy(() => import('../F24.jsx'));
const RiconciliazioneF24Content = lazy(() => import('../RiconciliazioneF24.jsx'));
const CodiciContent = lazy(() => import('../CodiciTributari.jsx'));
const IRESContent = lazy(() => import('../ContabilitaAvanzata.jsx'));

export default function FiscoHub() {
  const sections = [
    {
      id: 'iva',
      label: 'Calcolo IVA',
      icon: <Receipt size={16} />,
      desc: 'Debito/credito IVA mensile, trimestrale, annuale',
      component: <IVAContent />
    },
    {
      id: 'liquidazione',
      label: 'Liquidazione IVA',
      icon: <Calculator size={16} />,
      desc: 'Calcolo preciso liquidazione per commercialista',
      component: <LiquidazioneIVAContent />
    },
    {
      id: 'f24',
      label: 'F24 / Tributi',
      icon: <FileText size={16} />,
      desc: 'Modelli F24, scadenze e dashboard pagamenti',
      component: <F24Content />
    },
    {
      id: 'f24-riconciliazione',
      label: 'Riconciliazione F24',
      icon: <Receipt size={16} />,
      desc: 'Commercialista, quietanze, verifica pagamenti',
      component: <RiconciliazioneF24Content />
    },
    {
      id: 'codici',
      label: 'Codici Tributari',
      icon: <Hash size={16} />,
      desc: 'Gestione codici tributo F24',
      component: <CodiciContent />
    },
    {
      id: 'ires-irap',
      label: 'IRES / IRAP',
      icon: <Calculator size={16} />,
      desc: 'Imposte sul reddito e attività produttive',
      component: <IRESContent />
    }
  ];

  return <SectionPage title="Fisco & Tributi" icon={<Receipt size={22} />} sections={sections} defaultOpen="iva" />;
}
