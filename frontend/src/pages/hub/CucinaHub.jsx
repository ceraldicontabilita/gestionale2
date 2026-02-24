import React, { lazy } from 'react';
import { SectionPage } from '../../components/SectionPage';
import { ChefHat, BookOpen, Building, Target, Brain } from 'lucide-react';

const ProdottiContent = lazy(() => import('../DizionarioProdotti.jsx'));
const CentriCostoContent = lazy(() => import('../CentriCosto.jsx'));
const UtileContent = lazy(() => import('../UtileObiettivo.jsx'));
const LearningContent = lazy(() => import('../LearningMachine.jsx'));

export default function CucinaHub() {
  const sections = [
    {
      id: 'prodotti',
      label: 'Dizionario Prodotti',
      icon: <BookOpen size={16} />,
      desc: 'Ricette, schede tecniche, costi di produzione',
      component: <ProdottiContent />
    },
    {
      id: 'centri-costo',
      label: 'Centri di Costo',
      icon: <Building size={16} />,
      desc: 'Allocazione costi per centro di responsabilità',
      component: <CentriCostoContent />
    },
    {
      id: 'utile',
      label: 'Utile Obiettivo',
      icon: <Target size={16} />,
      desc: 'Target di marginalità per prodotto/reparto',
      component: <UtileContent />
    },
    {
      id: 'learning',
      label: 'Learning Machine',
      icon: <Brain size={16} />,
      desc: 'Classificazione automatica AI dei documenti',
      component: <LearningContent />
    }
  ];

  return <SectionPage title="Cucina & Produzione" icon={<ChefHat size={22} />} sections={sections} defaultOpen="prodotti" />;
}
