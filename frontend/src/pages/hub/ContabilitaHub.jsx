import React, { lazy } from 'react';
import { SectionPage } from '../../components/SectionPage';
import { BookOpen, BarChart2, Settings, Calendar, Building, TrendingUp, Lock } from 'lucide-react';

const PianoContiContent = lazy(() => import('../PianoDeiConti.jsx'));
const ControlloContent = lazy(() => import('../ControlloMensile.jsx'));
const MotoreContent = lazy(() => import('../MotoreContabile.jsx'));
const CalendarioContent = lazy(() => import('../CalendarioFiscale.jsx'));
const CespitiContent = lazy(() => import('../GestioneCespiti.jsx'));
const FinanziariaContent = lazy(() => import('../Finanziaria.jsx'));
const ChiusuraContent = lazy(() => import('../ChiusuraEsercizio.jsx'));

export default function ContabilitaHub() {
  const sections = [
    {
      id: 'piano-conti',
      label: 'Piano dei Conti',
      icon: <BookOpen size={16} />,
      desc: 'Struttura conti, classificazione, mastri',
      component: <PianoContiContent />
    },
    {
      id: 'controllo',
      label: 'Controllo Mensile',
      icon: <BarChart2 size={16} />,
      desc: 'Verifica mensile quadratura e anomalie',
      component: <ControlloContent />
    },
    {
      id: 'motore',
      label: 'Motore Contabile',
      icon: <Settings size={16} />,
      desc: 'Regole automatiche di contabilizzazione',
      component: <MotoreContent />
    },
    {
      id: 'calendario',
      label: 'Calendario Fiscale',
      icon: <Calendar size={16} />,
      desc: 'Scadenze fiscali e adempimenti',
      component: <CalendarioContent />
    },
    {
      id: 'cespiti',
      label: 'Cespiti',
      icon: <Building size={16} />,
      desc: 'Registro beni ammortizzabili',
      component: <CespitiContent />
    },
    {
      id: 'finanziaria',
      label: 'Finanziaria',
      icon: <TrendingUp size={16} />,
      desc: 'Flussi di cassa, indici finanziari',
      component: <FinanziariaContent />
    },
    {
      id: 'chiusura',
      label: 'Chiusura Esercizio',
      icon: <Lock size={16} />,
      desc: 'Operazioni di chiusura e apertura esercizio',
      component: <ChiusuraContent />
    }
  ];

  return <SectionPage title="Contabilità" icon={<BookOpen size={22} />} sections={sections} defaultOpen="piano-conti" />;
}
