import React, { lazy } from 'react';
import { SectionPage } from '../../components/SectionPage';
import { RefreshCw, CreditCard, FileCheck, Archive, AlertTriangle } from 'lucide-react';

const RiconciliazioneContent = lazy(() => import('../RiconciliazioneUnificata.jsx'));
const PaypalContent = lazy(() => import('../RiconciliazionePaypal.jsx'));
const AssegniContent = lazy(() => import('../GestioneAssegni.jsx'));
const BonificiContent = lazy(() => import('../ArchivioBonifici.jsx'));
const CoerenzaPOSContent = lazy(() => import('../CoerenzaPOSCorrispettivi.jsx'));

export default function RiconciliazioneHub() {
  const sections = [
    {
      id: 'pos-corrispettivi',
      label: 'Coerenza POS/Corrispettivi',
      icon: <AlertTriangle size={16} />,
      desc: 'Verifica coerenza tra POS e corrispettivi XML (Normativa 2026)',
      component: <CoerenzaPOSContent />
    },
    {
      id: 'banca',
      label: 'Riconciliazione Bancaria',
      icon: <RefreshCw size={16} />,
      desc: 'Confronto estratto conto vs prima nota',
      component: <RiconciliazioneContent />
    },
    {
      id: 'paypal',
      label: 'PayPal MSR/CSR',
      icon: <CreditCard size={16} />,
      desc: 'Riconciliazione movimenti PayPal',
      component: <PaypalContent />
    },
    {
      id: 'assegni',
      label: 'Gestione Assegni',
      icon: <FileCheck size={16} />,
      desc: 'Registro assegni emessi e ricevuti',
      component: <AssegniContent />
    },
    {
      id: 'bonifici',
      label: 'Archivio Bonifici',
      icon: <Archive size={16} />,
      desc: 'Storico bonifici e distinte',
      component: <BonificiContent />
    }
  ];

  return <SectionPage title="Riconciliazione & Pagamenti" icon={<RefreshCw size={22} />} sections={sections} defaultOpen="pos-corrispettivi" />;
}
