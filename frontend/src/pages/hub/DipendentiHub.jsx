import React, { lazy } from 'react';
import { SectionPage } from '../../components/SectionPage';
import { Users, Clock, Palmtree } from 'lucide-react';

const DipendentiContent = lazy(() => import('../GestioneDipendentiUnificata.jsx'));
const PresenzeContent = lazy(() => import('../Attendance.jsx'));
const FerieContent = lazy(() => import('../SaldiFeriePermessi.jsx'));

export default function DipendentiHub() {
  const sections = [
    {
      id: 'anagrafica',
      label: 'Gestione Dipendenti',
      icon: <Users size={16} />,
      desc: 'Anagrafica, contratti, documenti dipendenti',
      component: <DipendentiContent />
    },
    {
      id: 'presenze',
      label: 'Presenze',
      icon: <Clock size={16} />,
      desc: 'Calendario presenze, turni, straordinari',
      component: <PresenzeContent />
    },
    {
      id: 'ferie',
      label: 'Saldi Ferie / ROL / Permessi',
      icon: <Palmtree size={16} />,
      desc: 'Situazione ferie, permessi e ROL',
      component: <FerieContent />
    }
  ];

  return <SectionPage title="Dipendenti" icon={<Users size={22} />} sections={sections} defaultOpen="anagrafica" />;
}
