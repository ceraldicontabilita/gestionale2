/**
 * TabSaldoFerie.jsx
 * 
 * Componente per visualizzare il saldo ferie e permessi dei dipendenti.
 * Estratto da Attendance.jsx per migliorare la manutenibilità.
 */

import React, { useState, useEffect } from 'react';
import api from '../../api';
import { toast } from 'sonner';

export function TabSaldoFerie({ employees, currentYear }) {
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [saldoData, setSaldoData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [anno, setAnno] = useState(currentYear);
  
  const loadSaldoFerie = async () => {
    if (!selectedEmployee) return;
    
    try {
      setLoading(true);
      const res = await api.get(`/api/giustificativi/dipendente/${selectedEmployee}/saldo-ferie?anno=${anno}`);
      setSaldoData(res.data);
    } catch (err) {
      console.error('Errore caricamento saldo ferie:', err);
      toast.error('Errore caricamento dati');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    if (selectedEmployee) {
      loadSaldoFerie();
    }
  }, [selectedEmployee, anno]);
  
  return (
    <div>
      {/* Selezione Dipendente */}
      <div style={{ 
        background: 'white', 
        borderRadius: 12, 
        padding: 20, 
        marginBottom: 20,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
          <div style={{ flex: 2 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
              Dipendente
            </label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                fontSize: 14
              }}
              data-testid="select-saldo-employee"
            >
              <option value="">Seleziona dipendente...</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.nome_completo}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
              Anno
            </label>
            <select
              value={anno}
              onChange={(e) => setAnno(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                fontSize: 14
              }}
            >
              {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      {/* Risultato */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
          Caricamento...
        </div>
      ) : saldoData ? (
        <div>
          {/* Card Riepilogo */}
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ margin: '0 0 16px 0', color: '#1e3a5f', fontSize: 16, fontWeight: 600 }}>
              📊 Situazione {saldoData.employee_nome} - Anno {anno}
            </h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {/* Ferie */}
              <div style={{ 
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                borderRadius: 16, 
                padding: 24,
                color: 'white'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 28 }}>🏖️</span>
                  <span style={{ fontSize: 14, fontWeight: 500, opacity: 0.9 }}>FERIE</span>
                </div>
                <div style={{ fontSize: 42, fontWeight: 800, lineHeight: 1 }}>
                  {saldoData.ferie?.giorni_residui?.toFixed(1) || 0}
                </div>
                <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>giorni residui</div>
                <div style={{ marginTop: 16, fontSize: 12, opacity: 0.9 }}>
                  <div>Maturate: {saldoData.ferie?.maturate?.toFixed(0)}h</div>
                  <div>Godute: {saldoData.ferie?.godute?.toFixed(0)}h</div>
                  <div>Residue: {saldoData.ferie?.residue?.toFixed(0)}h</div>
                </div>
              </div>
              
              {/* ROL */}
              <div style={{ 
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                borderRadius: 16, 
                padding: 24,
                color: 'white'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 28 }}>⏰</span>
                  <span style={{ fontSize: 14, fontWeight: 500, opacity: 0.9 }}>ROL</span>
                </div>
                <div style={{ fontSize: 42, fontWeight: 800, lineHeight: 1 }}>
                  {saldoData.rol?.residui?.toFixed(0) || 0}
                </div>
                <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>ore residue</div>
                <div style={{ marginTop: 16, fontSize: 12, opacity: 0.9 }}>
                  <div>Maturati: {saldoData.rol?.maturati?.toFixed(0)}h</div>
                  <div>Goduti: {saldoData.rol?.goduti?.toFixed(0)}h</div>
                  <div>Spettanti annui: {saldoData.rol?.spettanti_annui}h</div>
                </div>
              </div>
              
              {/* Ex Festività */}
              <div style={{ 
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                borderRadius: 16, 
                padding: 24,
                color: 'white'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 28 }}>📅</span>
                  <span style={{ fontSize: 14, fontWeight: 500, opacity: 0.9 }}>EX FESTIVITÀ</span>
                </div>
                <div style={{ fontSize: 42, fontWeight: 800, lineHeight: 1 }}>
                  {saldoData.ex_festivita?.residue?.toFixed(0) || 0}
                </div>
                <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>ore residue</div>
                <div style={{ marginTop: 16, fontSize: 12, opacity: 0.9 }}>
                  <div>Maturate: {saldoData.ex_festivita?.maturate?.toFixed(0)}h</div>
                  <div>Godute: {saldoData.ex_festivita?.godute?.toFixed(0)}h</div>
                  <div>Spettanti annue: {saldoData.ex_festivita?.spettanti_annue}h</div>
                </div>
              </div>
              
              {/* Permessi */}
              <div style={{ 
                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                borderRadius: 16, 
                padding: 24,
                color: 'white'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 28 }}>🎫</span>
                  <span style={{ fontSize: 14, fontWeight: 500, opacity: 0.9 }}>PERMESSI</span>
                </div>
                <div style={{ fontSize: 42, fontWeight: 800, lineHeight: 1 }}>
                  {saldoData.permessi?.goduti_anno?.toFixed(0) || 0}
                </div>
                <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>ore godute</div>
                <div style={{ marginTop: 16, fontSize: 12, opacity: 0.9 }}>
                  <div>Anno {anno}</div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Dettaglio Mensile */}
          {saldoData.dettaglio_mensile?.length > 0 && (
            <div style={{ 
              background: 'white', 
              borderRadius: 12, 
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              overflow: 'hidden'
            }}>
              <div style={{ 
                padding: '16px 20px', 
                background: '#f8fafc', 
                borderBottom: '1px solid #e5e7eb'
              }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>📋 Dettaglio Mensile</h3>
              </div>
              <div style={{ padding: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#f9fafb' }}>
                      <th style={{ textAlign: 'left', padding: '10px 12px' }}>Mese</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px' }}>Ferie Maturate</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px' }}>Ferie Godute</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px' }}>ROL Maturati</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px' }}>ROL Goduti</th>
                    </tr>
                  </thead>
                  <tbody>
                    {saldoData.dettaglio_mensile.map((m, idx) => {
                      const mesiNomi = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 500 }}>{mesiNomi[m.mese - 1]}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#22c55e' }}>
                            +{m.ferie_maturate?.toFixed(1)}h
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: m.ferie_godute > 0 ? '#ef4444' : '#9ca3af' }}>
                            {m.ferie_godute > 0 ? `-${m.ferie_godute?.toFixed(1)}h` : '-'}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#3b82f6' }}>
                            +{m.rol_maturati?.toFixed(1)}h
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: m.rol_goduti > 0 ? '#ef4444' : '#9ca3af' }}>
                            {m.rol_goduti > 0 ? `-${m.rol_goduti?.toFixed(1)}h` : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : !selectedEmployee ? (
        <div style={{ 
          background: 'white', 
          borderRadius: 12, 
          padding: 60, 
          textAlign: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏖️</div>
          <p style={{ color: '#6b7280', margin: 0, fontSize: 15 }}>
            Seleziona un dipendente per visualizzare il saldo ferie e permessi
          </p>
        </div>
      ) : null}
    </div>
  );
}

export default TabSaldoFerie;
