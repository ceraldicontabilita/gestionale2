import React, { lazy } from 'react';
import { SectionPage } from '../../components/SectionPage';
import { Warehouse, ClipboardList, Search, BookOpen, Scale } from 'lucide-react';

const MagazzinoContent = lazy(() => import('../Magazzino.jsx'));
const InventarioContent = lazy(() => import('../Inventario.jsx'));
const ArticoliContent = lazy(() => import('../DizionarioArticoli.jsx'));
const RicercaContent = lazy(() => import('../RicercaProdotti.jsx'));
const DoppiaVeritaContent = lazy(() => import('../MagazzinoDoppiaVerita.jsx'));

export default function MagazzinoHub() {
  const sections = [
    {
      id: 'giacenze',
      label: 'Giacenze Magazzino',
      icon: <Warehouse size={16} />,
      desc: 'Situazione scorte, movimenti, soglie minime',
      component: <MagazzinoContent />
    },
    {
      id: 'inventario',
      label: 'Inventario',
      icon: <ClipboardList size={16} />,
      desc: 'Inventario fisico, rettifiche, valorizzazione',
      component: <InventarioContent />
    },
    {
      id: 'articoli',
      label: 'Dizionario Articoli',
      icon: <BookOpen size={16} />,
      desc: 'Anagrafica prodotti, codici, categorie',
      component: <ArticoliContent />
    },
    {
      id: 'ricerca',
      label: 'Ricerca Prodotti',
      icon: <Search size={16} />,
      desc: 'Ricerca avanzata, confronto prezzi',
      component: <RicercaContent />
    },
    {
      id: 'doppia-verita',
      label: 'Doppia Verità',
      icon: <Scale size={16} />,
      desc: 'Confronto magazzino contabile vs fisico',
      component: <DoppiaVeritaContent />
    }
  ];

  return <SectionPage title="Magazzino" icon={<Warehouse size={22} />} sections={sections} defaultOpen="giacenze" />;
}
