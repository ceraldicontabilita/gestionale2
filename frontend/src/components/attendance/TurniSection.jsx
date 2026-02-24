/**
 * TurniSection.jsx
 * 
 * Componente per la gestione dei turni dei dipendenti.
 * Estratto da Attendance.jsx per migliorare la manutenibilità.
 */

import React, { useState, useEffect } from 'react';
import api from '../../api';
import { Users, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { MESI, MANSIONI_DEFAULT } from './constants';

export function TurniSection({ employees, currentMonth, currentYear }) {
  const [mansioni, setMansioni] = useState(MANSIONI_DEFAULT);
  const [turniAssegnati, setTurniAssegnati] = useState({});
  const [selectedMansione, setSelectedMansione] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeDetails, setEmployeeDetails] = useState(null);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingOre, setEditingOre] = useState(false);
  const [tempOreSettimanali, setTempOreSettimanali] = useState(null);
  const [savingOre, setSavingOre] = useState(false);

  // Carica turni salvati
  useEffect(() => {
    loadTurni();
  }, [currentMonth, currentYear]);

  const loadTurni = async () => {
    try {
      const res = await api.get(`/api/attendance/turni?anno=${currentYear}&mese=${currentMonth + 1}`);
      if (res.data.turni) {
        setTurniAssegnati(res.data.turni);
      }
    } catch (error) {
      console.error('Errore caricamento turni:', error);
    }
  };

  // Carica dettagli contratto dipendente
  const loadEmployeeDetails = async (empId) => {
    try {
      setLoading(true);
      const res = await api.get(`/api/dipendenti/${empId}`);
      setEmployeeDetails(res.data);
      setTempOreSettimanali(res.data.ore_settimanali || res.data.contratto?.ore_settimanali || 40);
      setEditingOre(false);
    } catch (error) {
      console.error('Errore caricamento dettagli:', error);
    } finally {
      setLoading(false);
    }
  };

  // Salva ore settimanali
  const saveOreSettimanali = async () => {
    if (!selectedEmployee || tempOreSettimanali === null) return;
    
    try {
      setSavingOre(true);
      await api.put(`/api/dipendenti/${selectedEmployee.id}`, {
        ore_settimanali: parseInt(tempOreSettimanali)
      });
      
      // Aggiorna i dettagli locali
      setEmployeeDetails(prev => ({
        ...prev,
        ore_settimanali: parseInt(tempOreSettimanali)
      }));
      
      setEditingOre(false);
      toast.success(`Ore settimanali aggiornate a ${tempOreSettimanali}h`);
    } catch (error) {
      console.error('Errore salvataggio ore:', error);
      toast.error('Errore nel salvataggio delle ore settimanali');
    } finally {
      setSavingOre(false);
    }
  };

  // Assegna dipendente a mansione
  const assegnaDipendente = async (empId, mansioneId) => {
    const key = `${mansioneId}_${empId}`;
    const newTurni = { ...turniAssegnati, [key]: true };
    setTurniAssegnati(newTurni);
    
    try {
      await api.post('/api/attendance/turni/assegna', {
        employee_id: empId,
        mansione_id: mansioneId,
        anno: currentYear,
        mese: currentMonth + 1
      });
      toast.success('Dipendente assegnato al turno');
    } catch (error) {
      console.error('Errore assegnazione:', error);
    }
  };

  // Rimuovi dipendente da mansione
  const rimuoviDipendente = async (empId, mansioneId) => {
    const key = `${mansioneId}_${empId}`;
    const newTurni = { ...turniAssegnati };
    delete newTurni[key];
    setTurniAssegnati(newTurni);
    
    try {
      await api.delete(`/api/attendance/turni/rimuovi?employee_id=${empId}&mansione_id=${mansioneId}`);
      toast.success('Dipendente rimosso dal turno');
    } catch (error) {
      console.error('Errore rimozione:', error);
    }
  };

  // Filtra dipendenti per mansione
  const getDipendentiPerMansione = (mansioneId) => {
    return employees.filter(emp => {
      const key = `${mansioneId}_${emp.id}`;
      return turniAssegnati[key];
    });
  };

  // Dipendenti non assegnati
  const dipendentiNonAssegnati = employees.filter(emp => {
    return !Object.keys(turniAssegnati).some(key => key.endsWith(`_${emp.id}`));
  });

  return (
    <div style={{ 
      background: 'white', 
      borderRadius: 12, 
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      overflow: 'hidden'
    }}>
      {/* Header Turni */}
      <div style={{ 
        padding: '16px 20px', 
        background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Users style={{ width: 24, height: 24, color: 'white' }} />
          <span style={{ fontWeight: 'bold', color: 'white', fontSize: 18 }}>
            Gestione Turni - {MESI[currentMonth]} {currentYear}
          </span>
        </div>
        <button
          onClick={() => setShowAddEmployee(true)}
          style={{
            padding: '8px 16px',
            background: 'rgba(255,255,255,0.2)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
          data-testid="btn-aggiungi-turno"
        >
          <Plus style={{ width: 16, height: 16 }} /> Aggiungi Dipendenti
        </button>
      </div>

      <div style={{ display: 'flex', minHeight: 500 }}>
        {/* Sidebar Mansioni */}
        <div style={{ 
          width: 280, 
          borderRight: '1px solid #e5e7eb',
          background: '#f9fafb'
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
              Lista Gruppi per Mansione
            </span>
          </div>
          
          {mansioni.map(mansione => {
            const dipendenti = getDipendentiPerMansione(mansione.id);
            return (
              <div
                key={mansione.id}
                onClick={() => setSelectedMansione(mansione.id)}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #e5e7eb',
                  cursor: 'pointer',
                  background: selectedMansione === mansione.id ? '#e0e7ff' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
                data-testid={`mansione-${mansione.id}`}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ 
                    width: 12, 
                    height: 12, 
                    borderRadius: '50%', 
                    background: mansione.color 
                  }} />
                  <span style={{ fontWeight: 500 }}>{mansione.nome}</span>
                </div>
                <span style={{ 
                  padding: '2px 8px', 
                  background: mansione.color + '20',
                  color: mansione.color,
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 600
                }}>
                  {dipendenti.length}
                </span>
              </div>
            );
          })}
        </div>

        {/* Area Principale */}
        <div style={{ flex: 1, padding: 20 }}>
          {!selectedMansione ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
              <Users style={{ width: 48, height: 48, margin: '0 auto 16px', opacity: 0.3 }} />
              <p>Seleziona una mansione per vedere i dipendenti assegnati</p>
            </div>
          ) : (
            <>
              {/* Titolo Mansione */}
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ 
                  margin: 0, 
                  fontSize: 18, 
                  fontWeight: 600,
                  color: mansioni.find(m => m.id === selectedMansione)?.color
                }}>
                  {mansioni.find(m => m.id === selectedMansione)?.nome}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6b7280' }}>
                  Dipendenti assegnati a questo reparto
                </p>
              </div>

              {/* Lista Dipendenti Assegnati */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
                {getDipendentiPerMansione(selectedMansione).map(emp => (
                  <div
                    key={emp.id}
                    onClick={() => {
                      setSelectedEmployee(emp);
                      loadEmployeeDetails(emp.id);
                    }}
                    style={{
                      padding: 16,
                      background: selectedEmployee?.id === emp.id ? '#eff6ff' : '#f9fafb',
                      borderRadius: 12,
                      border: selectedEmployee?.id === emp.id ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    data-testid={`turno-employee-${emp.id}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: mansioni.find(m => m.id === selectedMansione)?.color + '20',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        color: mansioni.find(m => m.id === selectedMansione)?.color
                      }}>
                        {emp.nome?.charAt(0) || emp.cognome?.charAt(0) || '?'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#1f2937' }}>
                          {emp.cognome} {emp.nome}
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>
                          {emp.ruolo || emp.qualifica || 'Non specificato'}
                        </div>
                      </div>
                    </div>
                    
                    {/* Rimuovi dal turno */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        rimuoviDipendente(emp.id, selectedMansione);
                      }}
                      style={{
                        marginTop: 10,
                        padding: '4px 10px',
                        background: '#fef2f2',
                        color: '#dc2626',
                        border: '1px solid #fecaca',
                        borderRadius: 6,
                        fontSize: 11,
                        cursor: 'pointer'
                      }}
                    >
                      Rimuovi dal turno
                    </button>
                  </div>
                ))}
                
                {getDipendentiPerMansione(selectedMansione).length === 0 && (
                  <div style={{ 
                    padding: 40, 
                    textAlign: 'center', 
                    color: '#9ca3af',
                    gridColumn: '1 / -1'
                  }}>
                    Nessun dipendente assegnato a questa mansione
                  </div>
                )}
              </div>

              {/* Dettagli Dipendente Selezionato */}
              {selectedEmployee && employeeDetails && (
                <div style={{
                  marginTop: 24,
                  padding: 20,
                  background: '#f0fdf4',
                  borderRadius: 12,
                  border: '1px solid #bbf7d0'
                }}>
                  <h4 style={{ margin: '0 0 16px 0', color: '#166534' }}>
                    📋 Dettagli Contratto - {selectedEmployee.cognome} {selectedEmployee.nome}
                  </h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Ore Settimanali</div>
                      {editingOre ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="number"
                            value={tempOreSettimanali}
                            onChange={(e) => setTempOreSettimanali(e.target.value)}
                            min="1"
                            max="60"
                            style={{
                              width: 70,
                              padding: '8px 10px',
                              border: '2px solid #22c55e',
                              borderRadius: 8,
                              fontSize: 18,
                              fontWeight: 'bold',
                              textAlign: 'center',
                              color: '#22c55e'
                            }}
                            data-testid="input-ore-settimanali"
                          />
                          <button
                            onClick={saveOreSettimanali}
                            disabled={savingOre}
                            style={{
                              padding: '6px 12px',
                              background: '#22c55e',
                              color: 'white',
                              border: 'none',
                              borderRadius: 6,
                              cursor: savingOre ? 'wait' : 'pointer',
                              fontWeight: 600,
                              fontSize: 12
                            }}
                            data-testid="btn-save-ore"
                          >
                            {savingOre ? '...' : '✓'}
                          </button>
                          <button
                            onClick={() => {
                              setEditingOre(false);
                              setTempOreSettimanali(employeeDetails.ore_settimanali || 40);
                            }}
                            style={{
                              padding: '6px 12px',
                              background: '#f3f4f6',
                              color: '#6b7280',
                              border: '1px solid #d1d5db',
                              borderRadius: 6,
                              cursor: 'pointer',
                              fontWeight: 600,
                              fontSize: 12
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div 
                          onClick={() => setEditingOre(true)}
                          style={{ 
                            fontSize: 20, 
                            fontWeight: 'bold', 
                            color: '#22c55e',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                          }}
                          title="Clicca per modificare"
                          data-testid="display-ore-settimanali"
                        >
                          {employeeDetails.ore_settimanali || employeeDetails.contratto?.ore_settimanali || '40'}h
                          <span style={{ 
                            fontSize: 12, 
                            color: '#9ca3af', 
                            fontWeight: 'normal',
                            padding: '2px 6px',
                            background: '#f3f4f6',
                            borderRadius: 4
                          }}>✏️ modifica</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>Tipo Contratto</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        {employeeDetails.tipo_contratto || employeeDetails.contratto?.tipo || 'Tempo Indeterminato'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>Livello</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        {employeeDetails.livello || employeeDetails.contratto?.livello || '-'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>Mansione</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        {employeeDetails.mansione || employeeDetails.qualifica || '-'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal Aggiungi Dipendenti */}
      {showAddEmployee && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setShowAddEmployee(false)}>
          <div 
            style={{
              background: 'white',
              borderRadius: 16,
              width: 500,
              maxHeight: '80vh',
              overflow: 'hidden'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ 
              padding: '16px 20px', 
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontWeight: 'bold', fontSize: 16 }}>Aggiungi Dipendenti al Turno</span>
              <button 
                onClick={() => setShowAddEmployee(false)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'pointer',
                  fontSize: 20 
                }}
              >×</button>
            </div>
            
            <div style={{ padding: 20, maxHeight: 400, overflowY: 'auto' }}>
              {/* Seleziona Mansione */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                  Seleziona Mansione
                </label>
                <select
                  value={selectedMansione || ''}
                  onChange={(e) => setSelectedMansione(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid #d1d5db',
                    marginTop: 6
                  }}
                >
                  <option value="">-- Seleziona --</option>
                  {mansioni.map(m => (
                    <option key={m.id} value={m.id}>{m.nome}</option>
                  ))}
                </select>
              </div>
              
              {/* Lista Dipendenti */}
              <div style={{ marginTop: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                  Dipendenti Disponibili ({dipendentiNonAssegnati.length})
                </label>
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {employees.map(emp => {
                    const isAssigned = turniAssegnati[`${selectedMansione}_${emp.id}`];
                    return (
                      <div
                        key={emp.id}
                        style={{
                          padding: '10px 14px',
                          background: isAssigned ? '#dcfce7' : '#f9fafb',
                          borderRadius: 8,
                          border: isAssigned ? '1px solid #22c55e' : '1px solid #e5e7eb',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <span style={{ fontWeight: 500 }}>{emp.cognome} {emp.nome}</span>
                        <button
                          onClick={() => {
                            if (isAssigned) {
                              rimuoviDipendente(emp.id, selectedMansione);
                            } else if (selectedMansione) {
                              assegnaDipendente(emp.id, selectedMansione);
                            } else {
                              toast.warning('Seleziona prima una mansione');
                            }
                          }}
                          style={{
                            padding: '4px 12px',
                            background: isAssigned ? '#dc2626' : '#22c55e',
                            color: 'white',
                            border: 'none',
                            borderRadius: 6,
                            fontSize: 12,
                            cursor: 'pointer'
                          }}
                        >
                          {isAssigned ? 'Rimuovi' : 'Aggiungi'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            <div style={{ 
              padding: '12px 20px', 
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10
            }}>
              <button
                onClick={() => setShowAddEmployee(false)}
                style={{
                  padding: '10px 20px',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TurniSection;
