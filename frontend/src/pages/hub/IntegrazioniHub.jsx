import React, { lazy } from 'react';
import { SectionPage } from '../../components/SectionPage';
import { Globe, FileText, CreditCard } from 'lucide-react';

const OpenAPIContent = lazy(() => import('../IntegrazioniOpenAPI.jsx'));
const InvoiceTronicContent = lazy(() => import('../GestioneInvoiceTronic.jsx'));
const PagoPAContent = lazy(() => import('../GestionePagoPA.jsx'));

export default function IntegrazioniHub() {
  const sections = [
    {
      id: 'openapi',
      label: 'OpenAPI.it (SDI/XBRL)',
      icon: <Globe size={16} />,
      desc: 'Fatturazione elettronica SDI e bilanci XBRL',
      component: <OpenAPIContent />
    },
    {
      id: 'invoicetronic',
      label: 'InvoiceTronic (SDI)',
      icon: <FileText size={16} />,
      desc: 'Invio e ricezione fatture elettroniche',
      component: <InvoiceTronicContent />
    },
    {
      id: 'pagopa',
      label: 'PagoPA',
      icon: <CreditCard size={16} />,
      desc: 'Pagamenti verso la Pubblica Amministrazione',
      component: <PagoPAContent />
    }
  ];

  return <SectionPage title="Integrazioni" icon={<Globe size={22} />} sections={sections} defaultOpen="openapi" />;
}
