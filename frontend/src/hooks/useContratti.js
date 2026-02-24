/**
 * Custom Hook per Contratti Dipendenti
 * Gestisce logica e stato per il tab Contratti
 */
import { useState, useCallback } from 'react';
import api from '../api';

const DEFAULT_CONTRATTO = {
  dipendente_id: '',
  tipologia: '',
  data_inizio: '',
  data_fine: '',
  ore_settimanali: '',
  retribuzione: '',
  note: ''
};

export function useContratti() {
  const [contratti, setContratti] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scadenze, setScadenze] = useState({ scaduti: [], in_scadenza: [] });
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(DEFAULT_CONTRATTO);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [contrattiRes, scadenzeRes] = await Promise.all([
        api.get('/api/dipendenti/contratti').catch(() => ({ data: [] })),
        api.get('/api/dipendenti/contratti/scadenze').catch(() => ({ data: { scaduti: [], in_scadenza: [] } }))
      ]);
      setContratti(contrattiRes.data || []);
      setScadenze(scadenzeRes.data || { scaduti: [], in_scadenza: [] });
    } catch (error) {
      console.error('Error loading contratti:', error);
      setContratti([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault();
    
    if (!formData.dipendente_id || !formData.tipologia || !formData.data_inizio) {
      alert('Compila i campi obbligatori');
      return false;
    }
    
    try {
      await api.post('/api/dipendenti/contratti', formData);
      setShowForm(false);
      setFormData(DEFAULT_CONTRATTO);
      await loadData();
      return true;
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
      return false;
    }
  }, [formData, loadData]);

  const handleTerminate = useCallback(async (contrattoId) => {
    
    
    try {
      await api.patch(`/api/dipendenti/contratti/${contrattoId}/termina`);
      await loadData();
      return true;
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
      return false;
    }
  }, [loadData]);

  const handleImport = useCallback(async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/api/dipendenti/contratti/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      await loadData();
      return res.data;
    } catch (error) {
      alert('Errore import: ' + (error.response?.data?.detail || error.message));
      return null;
    }
  }, [loadData]);

  const openForm = useCallback(() => {
    setFormData(DEFAULT_CONTRATTO);
    setShowForm(true);
  }, []);

  const closeForm = useCallback(() => {
    setShowForm(false);
    setFormData(DEFAULT_CONTRATTO);
  }, []);

  const updateFormField = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  return {
    contratti,
    loading,
    scadenze,
    showForm,
    formData,
    loadData,
    handleSubmit,
    handleTerminate,
    handleImport,
    openForm,
    closeForm,
    updateFormField
  };
}
