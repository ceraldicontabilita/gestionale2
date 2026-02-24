import React, { lazy } from 'react';
import { SectionPage } from '../../components/SectionPage';
import { Car, FileText, RefreshCw } from 'lucide-react';

const NoleggioContent = lazy(() => import('../NoleggioAuto.jsx'));
const VerbaliContent = lazy(() => import('../VerbaliRiconciliazione.jsx'));

export default function VeicoliHub() {
  const sections = [
    {
      id: 'noleggio',
      label: 'Noleggio Auto',
      icon: <Car size={16} />,
      desc: 'Contratti noleggio, bolli, riparazioni, manutenzione',
      component: <NoleggioContent />
    },
    {
      id: 'verbali',
      label: 'Riconciliazione Verbali',
      icon: <RefreshCw size={16} />,
      desc: 'Abbinamento verbali: fattura + pagamento + autista',
      component: <VerbaliContent />
    }
  ];

  return <SectionPage title="Veicoli & Noleggio" icon={<Car size={22} />} sections={sections} defaultOpen="noleggio" />;
}
