/**
 * Custom Hook per Libretti Sanitari
 * Gestisce logica e stato per il tab Libretti
 */
import { useState, useCallback } from 'react';
import api from '../api';

const DEFAULT_FORM = {
  dipendente_nome: '',
  numero_libretto: '',
  data_rilascio: '',
  data_scadenza: '',
  note: ''
};

export function useLibrettiSanitari() {
  const [libretti, setLibretti] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(DEFAULT_FORM);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/dipendenti/libretti').catch(() => ({ data: [] }));
      setLibretti(res.data || []);
    } catch (error) {
      console.error('Error loading libretti:', error);
      setLibretti([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault();
    
    if (!formData.dipendente_nome || !formData.numero_libretto) {
      alert('Compila i campi obbligatori');
      return false;
    }
    
    try {
      await api.post('/api/dipendenti/libretti', formData);
      setShowForm(false);
      setFormData(DEFAULT_FORM);
      await loadData();
      return true;
    } catch (error) {
      alert('Errore: ' + (error.response?.data?.detail || error.message));
      return false;
    }
  }, [formData, loadData]);

  const handleDelete = useCallback(async (librettoId) => {
    
    
    try {
      await api.delete(`/api/dipendenti/libretti/${librettoId}`);
      await loadData();
      return true;
    } catch (error) {
      alert('Errore eliminazione: ' + (error.response?.data?.detail || error.message));
      return false;
    }
  }, [loadData]);

  const openForm = useCallback(() => {
    setFormData(DEFAULT_FORM);
    setShowForm(true);
  }, []);

  const closeForm = useCallback(() => {
    setShowForm(false);
    setFormData(DEFAULT_FORM);
  }, []);

  const updateFormField = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  return {
    libretti,
    loading,
    showForm,
    formData,
    loadData,
    handleSubmit,
    handleDelete,
    openForm,
    closeForm,
    updateFormField
  };
}
