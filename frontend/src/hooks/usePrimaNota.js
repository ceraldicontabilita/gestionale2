/**
 * Custom hook per Prima Nota Salari
 * Logica riutilizzabile con ottimizzazioni
 */
import { useCallback, useMemo, useEffect } from 'react';
import { usePrimaNotaStore } from '../stores/primaNotaStore';

export function usePrimaNota() {
  const store = usePrimaNotaStore();
  
  // Memoized selectors
  const filteredData = useMemo(() => {
    return store.salariMovimenti.filter(m => !store.anniEsclusi.includes(m.anno));
  }, [store.salariMovimenti, store.anniEsclusi]);
  
  const totals = useMemo(() => {
    return {
      records: filteredData.length,
      totalRecords: store.salariMovimenti.length,
      totaleBuste: filteredData.reduce((sum, m) => sum + (m.importo_busta || 0), 0),
      totaleBonifici: filteredData.reduce((sum, m) => sum + (m.importo_bonifico || 0), 0),
      differenza: filteredData.reduce((sum, m) => sum + (m.importo_bonifico || 0) - (m.importo_busta || 0), 0)
    };
  }, [filteredData, store.salariMovimenti.length]);
  
  // Memoized callbacks
  const handleToggleAnno = useCallback((anno) => {
    store.toggleAnnoEscluso(anno);
    store.ricalcolaProgressivi();
  }, [store]);
  
  const handleResetAnni = useCallback(() => {
    store.resetAnniEsclusi();
    store.ricalcolaProgressivi();
  }, [store]);
  
  const handleImportPaghe = useCallback(async (file) => {
    return await store.importPaghe(file);
  }, [store]);
  
  const handleImportBonifici = useCallback(async (file) => {
    return await store.importBonifici(file);
  }, [store]);
  
  const handleDeleteRecord = useCallback(async (recordId) => {
    
    return await store.deleteRecord(recordId);
  }, [store]);
  
  const handleResetAllData = useCallback(async () => {
    
    const success = await store.resetAllData();
    if (success) alert('✅ Dati eliminati');
    return success;
  }, [store]);
  
  // Load data on mount
  useEffect(() => {
    store.fetchSalari();
    store.fetchDipendentiLista();
  }, [store.selectedYear, store.selectedMonth, store.filtroDipendente]);
  
  return {
    // State
    salariMovimenti: store.salariMovimenti,
    filteredData,
    totals,
    loading: store.loading,
    importing: store.importing,
    importResult: store.importResult,
    anniEsclusi: store.anniEsclusi,
    dipendentiLista: store.dipendentiLista,
    filtroDipendente: store.filtroDipendente,
    selectedMonth: store.selectedMonth,
    selectedYear: store.selectedYear,
    
    // Setters
    setFiltroDipendente: store.setFiltroDipendente,
    setSelectedMonth: store.setSelectedMonth,
    setSelectedYear: store.setSelectedYear,
    
    // Actions
    handleToggleAnno,
    handleResetAnni,
    handleImportPaghe,
    handleImportBonifici,
    handleDeleteRecord,
    handleResetAllData,
    clearImportResult: store.clearImportResult,
    fetchSalari: store.fetchSalari,
    updateRecord: store.updateRecord
  };
}
