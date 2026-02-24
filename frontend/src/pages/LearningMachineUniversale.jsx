/**
 * Learning Machine Universale
 * Apprende pattern da tutti i dati dell'applicazione
 */

import React, { useState, useEffect } from 'react';
import api from '../api';
import { Brain, Zap, TrendingUp, Database, CheckCircle, AlertCircle, Play, RefreshCw } from 'lucide-react';

const MODULES = [
  { id: 'fornitori', name: 'Fornitori', icon: '🏢', color: '#3b82f6', desc: 'Pattern e metodi pagamento' },
  { id: 'pagamenti', name: 'Pagamenti', icon: '💳', color: '#10b981', desc: 'Tempi medi pagamento fatture' },
  { id: 'movimenti', name: 'Movimenti', icon: '🏦', color: '#8b5cf6', desc: 'Categorizzazione automatica' },
  { id: 'stagionalita', name: 'Stagionalità', icon: '📊', color: '#f59e0b', desc: 'Trend corrispettivi' },
  { id: 'assegni', name: 'Assegni', icon: '📝', color: '#ef4444', desc: 'Associazioni automatiche' },
];

export default function LearningMachineUniversale() {
  const [status, setStatus] = useState(null);
  const [results, setResults] = useState(null);
  const [training, setTraining] = useState(false);
  const [activeModule, setActiveModule] = useState('fornitori');
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    loadStatus();
    loadResults();
  }, []);

  useEffect(() => {
    if (results) {
      loadSuggestions(activeModule);
    }
  }, [activeModule, results]);

  const loadStatus = async () => {
    try {
      const res = await api.get('/api/learning-universal/status');
      setStatus(res.data);
    } catch (e) {
      console.error('Errore caricamento status:', e);
    }
  };

  const loadResults = async () => {
    try {
      const res = await api.get('/api/learning-universal/results');
      if (res.data.status !== 'no_results') {
        setResults(res.data);
      }
    } catch (e) {
      console.error('Errore caricamento risultati:', e);
    }
  };

  const loadSuggestions = async (module) => {
    setLoadingSuggestions(true);
    try {
      const res = await api.get(`/api/learning-universal/suggestions/${module}`);
      setSuggestions(res.data.suggestions || []);
    } catch (e) {
      console.error('Errore caricamento suggerimenti:', e);
      setSuggestions([]);
    }
    setLoadingSuggestions(false);
  };

  const startTraining = async () => {
    setTraining(true);
    try {
      const res = await api.post('/api/learning-universal/train/all');
      setResults(res.data);
      await loadStatus();
      await loadSuggestions(activeModule);
    } catch (e) {
      console.error('Errore training:', e);
      alert('Errore durante il training: ' + (e.response?.data?.detail || e.message));
    }
    setTraining(false);
  };

  const applySuggestions = async () => {
    setApplying(true);
    try {
      const res = await api.post('/api/learning-universal/apply-suggestions', {
        module: activeModule,
        suggestion_ids: suggestions.map((_, i) => i)
      });
      alert(`Applicati ${res.data.applied} suggerimenti!`);
      await loadSuggestions(activeModule);
    } catch (e) {
      console.error('Errore applicazione:', e);
      alert('Errore: ' + (e.response?.data?.detail || e.message));
    }
    setApplying(false);
  };

  const getModuleData = (moduleId) => {
    if (!results?.modules) return null;
    return results.modules[moduleId];
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: 16 }}>
      
      {/* Header con azioni */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 24,
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 48, height: 48,
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Brain size={28} color="white" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1e293b' }}>
              Learning Machine Universale
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
              Apprende pattern da tutti i dati dell'applicazione
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={loadStatus}
            style={{
              padding: '10px 16px',
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 600
            }}
          >
            <RefreshCw size={16} /> Aggiorna
          </button>
          <button
            onClick={startTraining}
            disabled={training}
            style={{
              padding: '10px 20px',
              background: training ? '#94a3b8' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: training ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 14,
              fontWeight: 600,
              boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)'
            }}
          >
            {training ? (
              <>
                <div style={{
                  width: 16, height: 16,
                  border: '2px solid white',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                Training in corso...
              </>
            ) : (
              <>
                <Play size={18} /> Avvia Training Completo
              </>
            )}
          </button>
        </div>
      </div>

      {/* Status Cards */}
      {status && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: 16, 
          marginBottom: 24 
        }}>
          <div style={{
            background: 'white',
            borderRadius: 12,
            padding: 16,
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Stato Sistema</div>
            <div style={{ 
              fontSize: 18, 
              fontWeight: 700, 
              color: status.status === 'ready' ? '#10b981' : '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}>
              {status.status === 'ready' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
              {status.status === 'ready' ? 'Pronto' : 'Raccolta dati'}
            </div>
          </div>
          
          <div style={{
            background: 'white',
            borderRadius: 12,
            padding: 16,
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Documenti Totali</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#1e293b' }}>
              {status.total_documents?.toLocaleString() || 0}
            </div>
          </div>
          
          <div style={{
            background: 'white',
            borderRadius: 12,
            padding: 16,
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Progresso Learning</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                flex: 1,
                height: 8,
                background: '#e2e8f0',
                borderRadius: 4,
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${status.learning_progress || 0}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                  borderRadius: 4,
                  transition: 'width 0.5s'
                }} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#6366f1' }}>
                {status.learning_progress?.toFixed(0) || 0}%
              </span>
            </div>
          </div>
          
          <div style={{
            background: 'white',
            borderRadius: 12,
            padding: 16,
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Ultimo Training</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
              {results?.completed_at 
                ? new Date(results.completed_at).toLocaleString('it-IT')
                : 'Mai eseguito'}
            </div>
          </div>
        </div>
      )}

      {/* Collections Stats */}
      {status?.collections && (
        <div style={{
          background: 'white',
          borderRadius: 12,
          padding: 16,
          border: '1px solid #e2e8f0',
          marginBottom: 24
        }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: '#64748b' }}>
            <Database size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Dati Disponibili per Collezione
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(status.collections).map(([name, count]) => (
              <div key={name} style={{
                padding: '6px 12px',
                background: count > 0 ? '#dcfce7' : '#f1f5f9',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 500,
                color: count > 0 ? '#16a34a' : '#64748b'
              }}>
                {name}: <strong>{count.toLocaleString()}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Module Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: 8, 
        marginBottom: 20,
        flexWrap: 'wrap'
      }}>
        {MODULES.map(mod => (
          <button
            key={mod.id}
            onClick={() => setActiveModule(mod.id)}
            style={{
              padding: '10px 16px',
              background: activeModule === mod.id ? mod.color : 'white',
              color: activeModule === mod.id ? 'white' : '#475569',
              border: `2px solid ${activeModule === mod.id ? mod.color : '#e2e8f0'}`,
              borderRadius: 10,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
          >
            <span style={{ fontSize: 18 }}>{mod.icon}</span>
            {mod.name}
          </button>
        ))}
      </div>

      {/* Module Content */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        
        {/* Risultati Apprendimento */}
        <div style={{
          background: 'white',
          borderRadius: 12,
          padding: 20,
          border: '1px solid #e2e8f0'
        }}>
          <h3 style={{ 
            margin: '0 0 16px', 
            fontSize: 16, 
            fontWeight: 600, 
            color: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <TrendingUp size={20} color={MODULES.find(m => m.id === activeModule)?.color} />
            Risultati Apprendimento - {MODULES.find(m => m.id === activeModule)?.name}
          </h3>
          
          {!results ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
              <Brain size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p>Nessun training completato</p>
              <p style={{ fontSize: 13 }}>Clicca "Avvia Training Completo" per iniziare</p>
            </div>
          ) : (
            <div>
              {(() => {
                const data = getModuleData(activeModule);
                if (!data) return <p style={{ color: '#94a3b8' }}>Nessun dato</p>;
                
                return (
                  <div style={{ fontSize: 14 }}>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(2, 1fr)', 
                      gap: 12,
                      marginBottom: 16 
                    }}>
                      <div style={{ 
                        padding: 12, 
                        background: '#f8fafc', 
                        borderRadius: 8 
                      }}>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Analizzati</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>
                          {data.total_analyzed?.toLocaleString() || 0}
                        </div>
                      </div>
                      <div style={{ 
                        padding: 12, 
                        background: '#f8fafc', 
                        borderRadius: 8 
                      }}>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Pattern Trovati</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#6366f1' }}>
                          {data.patterns_found || data.categories_found || data.associations_found || 0}
                        </div>
                      </div>
                    </div>
                    
                    {/* Dettagli specifici per modulo */}
                    {activeModule === 'pagamenti' && data.avg_payment_days > 0 && (
                      <div style={{ padding: 12, background: '#eff6ff', borderRadius: 8, marginBottom: 12 }}>
                        <strong>Tempo medio pagamento:</strong> {data.avg_payment_days} giorni
                      </div>
                    )}
                    
                    {activeModule === 'stagionalita' && data.trend && (
                      <div style={{ padding: 12, background: '#fef3c7', borderRadius: 8, marginBottom: 12 }}>
                        <strong>Trend:</strong> {data.trend === 'growing' ? '📈 In crescita' : data.trend === 'declining' ? '📉 In calo' : '➡️ Stabile'}
                        {data.peak_months?.length > 0 && (
                          <div style={{ marginTop: 4 }}>
                            <strong>Mesi picco:</strong> {data.peak_months.join(', ')}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {activeModule === 'assegni' && data.success_rate > 0 && (
                      <div style={{ padding: 12, background: '#dcfce7', borderRadius: 8, marginBottom: 12 }}>
                        <strong>Tasso associazione:</strong> {data.success_rate}%
                      </div>
                    )}
                    
                    {activeModule === 'fornitori' && data.payment_methods && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>
                          Metodi Pagamento
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {Object.entries(data.payment_methods).slice(0, 8).map(([method, count]) => (
                            <span key={method} style={{
                              padding: '4px 10px',
                              background: '#e0e7ff',
                              borderRadius: 12,
                              fontSize: 11,
                              color: '#4338ca'
                            }}>
                              {method}: {count}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Suggerimenti */}
        <div style={{
          background: 'white',
          borderRadius: 12,
          padding: 20,
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: 16 
          }}>
            <h3 style={{ 
              margin: 0, 
              fontSize: 16, 
              fontWeight: 600, 
              color: '#1e293b',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <Zap size={20} color="#f59e0b" />
              Suggerimenti AI
            </h3>
            {suggestions.length > 0 && activeModule === 'movimenti' && (
              <button
                onClick={applySuggestions}
                disabled={applying}
                style={{
                  padding: '6px 12px',
                  background: applying ? '#94a3b8' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: applying ? 'wait' : 'pointer',
                  fontSize: 12,
                  fontWeight: 600
                }}
              >
                {applying ? 'Applicando...' : 'Applica Tutti'}
              </button>
            )}
          </div>
          
          {loadingSuggestions ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
              <div style={{
                width: 32, height: 32,
                border: '3px solid #e2e8f0',
                borderTopColor: '#6366f1',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 12px'
              }} />
              Caricamento suggerimenti...
            </div>
          ) : suggestions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
              <Zap size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p>Nessun suggerimento disponibile</p>
              <p style={{ fontSize: 13 }}>Esegui il training per generare suggerimenti</p>
            </div>
          ) : (
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {suggestions.map((sug, idx) => (
                <div key={idx} style={{
                  padding: 12,
                  background: '#f8fafc',
                  borderRadius: 8,
                  marginBottom: 8,
                  borderLeft: `3px solid ${sug.confidence > 0.7 ? '#10b981' : sug.confidence > 0.4 ? '#f59e0b' : '#94a3b8'}`
                }}>
                  <div style={{ 
                    fontSize: 13, 
                    fontWeight: 500, 
                    color: '#1e293b',
                    marginBottom: 4 
                  }}>
                    {sug.message}
                  </div>
                  <div style={{ 
                    fontSize: 11, 
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}>
                    <span>Tipo: {sug.type}</span>
                    <span>•</span>
                    <span>Confidenza: {Math.round(sug.confidence * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
