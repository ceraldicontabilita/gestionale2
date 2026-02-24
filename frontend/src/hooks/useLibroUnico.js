/**
 * Custom Hook per Libro Unico
 * Gestisce logica e stato per il tab Libro Unico
 */
import { useState, useCallback } from 'react';
import api from '../api';

export function useLibroUnico(selectedYear, selectedMonth) {
  const [salaries, setSalaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const monthStr = String(selectedMonth).padStart(2, '0');
      const monthYear = `${selectedYear}-${monthStr}`;
      const res = await api.get(`/api/dipendenti/libro-unico/salaries?month_year=${monthYear}`).catch(() => ({ data: [] }));
      setSalaries(res.data || []);
    } catch (error) {
      console.error('Error loading libro unico:', error);
      setSalaries([]);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  const handleUpload = useCallback(async (file) => {
    try {
      setUploading(true);
      setUploadResult(null);
      
      const monthStr = String(selectedMonth).padStart(2, '0');
      const monthYear = `${selectedYear}-${monthStr}`;
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('month_year', monthYear);
      
      const res = await api.post('/api/dipendenti/libro-unico/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setUploadResult(res.data);
      await loadData();
      return res.data;
    } catch (error) {
      const result = { success: false, message: error.response?.data?.detail || error.message };
      setUploadResult(result);
      return result;
    } finally {
      setUploading(false);
    }
  }, [selectedYear, selectedMonth, loadData]);

  const handleExport = useCallback(async () => {
    try {
      const monthStr = String(selectedMonth).padStart(2, '0');
      const monthYear = `${selectedYear}-${monthStr}`;
      
      const response = await api.get(`/api/dipendenti/libro-unico/export?month_year=${monthYear}`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `libro_unico_${monthYear}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      return true;
    } catch (error) {
      alert('Errore export: ' + (error.response?.data?.detail || error.message));
      return false;
    }
  }, [selectedYear, selectedMonth]);

  const handleDelete = useCallback(async (salaryId) => {
    
    
    try {
      await api.delete(`/api/dipendenti/libro-unico/salaries/${salaryId}`);
      await loadData();
      return true;
    } catch (error) {
      alert('Errore eliminazione: ' + (error.response?.data?.detail || error.message));
      return false;
    }
  }, [loadData]);

  const clearUploadResult = useCallback(() => {
    setUploadResult(null);
  }, []);

  return {
    salaries,
    loading,
    uploading,
    uploadResult,
    loadData,
    handleUpload,
    handleExport,
    handleDelete,
    clearUploadResult
  };
}
