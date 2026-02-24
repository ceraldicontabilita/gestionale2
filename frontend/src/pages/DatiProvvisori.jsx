/**
 * DatiProvvisori.jsx
 * 
 * NUOVA LOGICA WORKFLOW:
 * 1. Tutte le fatture da email arrivano qui
 * 2. Utente sceglie manualmente: CASSA o BANCA
 * 3. Sistema sposta in Prima Nota Cassa/Banca
 * 4. Quando carico XML: ricontrollo dati (IGNORO metodo pagamento)
 * 5. Quando carico Estratto Conto: riconciliazione automatica
 *    - Trovato in banca → BANCA
 *    - Non trovato → CASSA
 *    - Era in cassa ma trovato ora → SPOSTA in BANCA
 */

import React, { useState, useEffect } from 'react';
import api from '../api';
import { toast } from 'sonner';
import { 
  FileText, Wallet, Building2, Check, X, RefreshCw, 
  ChevronDown, AlertCircle, ArrowRight 
} from 'lucide-react';
import { STYLES, COLORS, button, badge, formatEuro, formatDateIT } from '../lib/utils';
import { PageLayout } from '../components/PageLayout';
import { useAnnoGlobale } from '../contexts/AnnoContext';

export default function DatiProvvisori() {
  const { anno } = useAnnoGlobale();
  const [loading, setLoading] = useState(true);
  const [datiProvvisori, setDatiProvvisori] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/dati-provvisori');
      setDatiProvvisori(res.data.dati || []);
    } catch (error) {
      console.error('Errore caricamento dati provvisori:', error);
      toast.error('Errore caricamento dati');
    } finally {
      setLoading(false);
    }
  };

  const handleSpostaCassa = async (item) => {
    try {
      setProcessing(true);
      await api.post('/api/dati-provvisori/sposta-cassa', {
        id: item.id,
        fornitore: item.fornitore,
        numero_documento: item.numero_documento,
        data_documento: item.data_documento,
        importo: item.importo,
        descrizione: item.descrizione
      });
      
      toast.success(`Spostato in Prima Nota Cassa: ${item.fornitore} - €${item.importo}`);
      loadData();
    } catch (error) {
      toast.error('Errore spostamento in cassa');
    } finally {
      setProcessing(false);
    }
  };

  const handleSpostaBanca = async (item) => {
    try {
      setProcessing(true);
      await api.post('/api/dati-provvisori/sposta-banca', {
        id: item.id,
        fornitore: item.fornitore,
        numero_documento: item.numero_documento,
        data_documento: item.data_documento,
        importo: item.importo,
        descrizione: item.descrizione
      });
      
      toast.success(`Spostato in Prima Nota Banca: ${item.fornitore} - €${item.importo}`);
      loadData();
    } catch (error) {
      toast.error('Errore spostamento in banca');
    } finally {
      setProcessing(false);
    }
  };

  const handleElimina = async (id) => {
    if (!confirm('Eliminare questo dato provvisorio?')) return;
    
    try {
      await api.delete(`/api/dati-provvisori/${id}`);
      toast.success('Dato eliminato');
      loadData();
    } catch (error) {
      toast.error('Errore eliminazione');
    }
  };

  const handleSyncEmail = async () => {
    try {
      setProcessing(true);
      toast.info('Scarico email Aruba...');
      
      const res = await api.post('/api/force-sync/aruba-email?days_back=30');
      
      toast.success(`${res.data.fatture_create} nuove fatture scaricate`);
      loadData();
    } catch (error) {
      toast.error('Errore sync email');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <PageLayout title="Dati Provvisori">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="animate-spin" size={32} />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout 
      title="Dati Provvisori"
      subtitle="Fatture da email in attesa di classificazione"
    >
      {/* Header Actions */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={badge.warning}>
            <FileText size={16} />
            <span>{datiProvvisori.length} in attesa</span>
          </div>
        </div>

        <button
          onClick={handleSyncEmail}
          disabled={processing}
          className={button.primary}
        >
          <RefreshCw size={16} className={processing ? 'animate-spin' : ''} />
          Scarica Email Aruba
        </button>
      </div>


      {/* Nota compatta */}

      {/* Lista Dati Provvisori */}
      {datiProvvisori.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <FileText size={48} className="mx-auto mb-4 opacity-50" />
          <p>Nessun dato provvisorio</p>
          <p className="text-sm mt-2">Le fatture da email appariranno qui</p>
        </div>
      ) : (
        <div className="space-y-3">
          {datiProvvisori.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Info Fattura */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-900">
                      {item.fornitore}
                    </h3>
                    <span className={badge.default}>
                      {item.tipo || 'Email'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Numero:</span>
                      <span className="ml-2 font-medium">{item.numero_documento}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Data:</span>
                      <span className="ml-2 font-medium">{formatDateIT(item.data_documento)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Importo:</span>
                      <span className="ml-2 font-bold text-lg">{formatEuro(item.importo)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Ricevuto:</span>
                      <span className="ml-2">{formatDateIT(item.data_ricezione)}</span>
                    </div>
                  </div>

                  {item.descrizione && (
                    <p className="mt-2 text-sm text-gray-600">{item.descrizione}</p>
                  )}
                </div>

                {/* Azioni */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleSpostaCassa(item)}
                    disabled={processing}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    <Wallet size={16} />
                    <ArrowRight size={14} />
                    CASSA
                  </button>

                  <button
                    onClick={() => handleSpostaBanca(item)}
                    disabled={processing}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <Building2 size={16} />
                    <ArrowRight size={14} />
                    BANCA
                  </button>

                  <button
                    onClick={() => handleElimina(item.id)}
                    disabled={processing}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageLayout>
  );
}
