import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import api from '../api';
import { PageLayout } from '../components/PageLayout';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function ImportDocumentiAI() {
  const [file, setFile] = useState(null);
  const [documentType, setDocumentType] = useState('auto');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setResult(null);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg']
    },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024 // 20MB
  });

  const handleParse = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_type', documentType);

      const response = await api.post('/api/enhanced-parser/auto', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setResult(response.data);
    } catch (err) {
      console.error('Errore parsing:', err);
      setError(err.response?.data?.detail || err.message || 'Errore durante il parsing');
    } finally {
      setLoading(false);
    }
  };

  const renderF24Result = (data) => {
    const validazione = data.validazione || {};
    const tributi = validazione.tributi_estratti || {};
    
    return (
      <div className="space-y-6">
        {/* Dati Contribuente */}
        {data.dati_contribuente && (
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-semibold text-blue-800 mb-2">Dati Contribuente</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-gray-500">CF:</span> {data.dati_contribuente.codice_fiscale}</div>
              <div><span className="text-gray-500">Ragione Sociale:</span> {data.dati_contribuente.cognome_nome_ragione_sociale}</div>
            </div>
          </div>
        )}

        {/* Totali */}
        {data.totali && (
          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="font-semibold text-green-800 mb-2">Totale Versamento</h3>
            <div className="text-2xl font-bold text-green-700">
              € {(data.totali.TOTALE_VERSAMENTO || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </div>
            <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
              <div>
                <span className="text-gray-500">Erario:</span> € {(data.totali.saldo_erario || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </div>
              <div>
                <span className="text-gray-500">INPS:</span> € {(data.totali.saldo_inps || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </div>
              <div>
                <span className="text-gray-500">Regioni:</span> € {(data.totali.saldo_regioni || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        )}

        {/* Conteggio Tributi */}
        <div className="bg-purple-50 rounded-lg p-4">
          <h3 className="font-semibold text-purple-800 mb-2">Tributi Estratti</h3>
          <div className="grid grid-cols-5 gap-2 text-sm">
            <div className="text-center">
              <div className="text-xl font-bold text-purple-700">{tributi.erario || 0}</div>
              <div className="text-gray-500">Erario</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-purple-700">{tributi.inps || 0}</div>
              <div className="text-gray-500">INPS</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-purple-700">{tributi.regioni || 0}</div>
              <div className="text-gray-500">Regioni</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-purple-700">{tributi.imu_locali || 0}</div>
              <div className="text-gray-500">IMU/Locali</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-green-700">{tributi.totale || 0}</div>
              <div className="text-gray-500">TOTALE</div>
            </div>
          </div>
        </div>

        {/* Sezione Erario */}
        {data.sezione_erario?.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 font-semibold">Sezione Erario ({data.sezione_erario.length} tributi)</div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">Codice</th>
                  <th className="px-3 py-2 text-left">Descrizione</th>
                  <th className="px-3 py-2 text-center">Anno</th>
                  <th className="px-3 py-2 text-right">Debito</th>
                  <th className="px-3 py-2 text-right">Credito</th>
                </tr>
              </thead>
              <tbody>
                {data.sezione_erario.map((t, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2 font-mono font-bold">{t.codice_tributo}</td>
                    <td className="px-3 py-2">{t.descrizione_tributo || '-'}</td>
                    <td className="px-3 py-2 text-center">{t.anno_riferimento}</td>
                    <td className="px-3 py-2 text-right text-red-600">
                      {t.importo_a_debito > 0 ? `€ ${t.importo_a_debito.toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="px-3 py-2 text-right text-green-600">
                      {t.importo_a_credito > 0 ? `€ ${t.importo_a_credito.toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Sezione INPS */}
        {data.sezione_inps?.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 font-semibold">Sezione INPS ({data.sezione_inps.length} tributi)</div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">Causale</th>
                  <th className="px-3 py-2 text-left">Matricola</th>
                  <th className="px-3 py-2 text-center">Periodo</th>
                  <th className="px-3 py-2 text-right">Debito</th>
                </tr>
              </thead>
              <tbody>
                {data.sezione_inps.map((t, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2 font-mono font-bold">{t.causale_contributo}</td>
                    <td className="px-3 py-2">{t.matricola_inps || '-'}</td>
                    <td className="px-3 py-2 text-center">{t.periodo_da} - {t.periodo_a}</td>
                    <td className="px-3 py-2 text-right text-red-600">
                      € {(t.importo_a_debito || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderCedolinoResult = (data) => {
    const validazione = data.validazione || {};
    
    return (
      <div className="space-y-6">
        {/* Header con formato riconosciuto */}
        <div className="bg-blue-50 rounded-lg p-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-blue-800">Formato Riconosciuto</h3>
            <div className="text-xl font-bold text-blue-700">{data.formato_riconosciuto || 'Generico'}</div>
          </div>
          {validazione.calcolo_corretto !== undefined && (
            <div className={`flex items-center gap-2 ${validazione.calcolo_corretto ? 'text-green-600' : 'text-orange-600'}`}>
              {validazione.calcolo_corretto ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
              <span className="font-semibold">{validazione.calcolo_corretto ? 'Calcolo Verificato' : 'Verifica Necessaria'}</span>
            </div>
          )}
        </div>

        {/* Dati Dipendente */}
        {data.dati_dipendente && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-2">Dipendente</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Nome:</span><br/>
                <span className="font-semibold">{data.dati_dipendente.cognome} {data.dati_dipendente.nome}</span>
              </div>
              <div>
                <span className="text-gray-500">CF:</span><br/>
                <span className="font-mono">{data.dati_dipendente.codice_fiscale}</span>
              </div>
              <div>
                <span className="text-gray-500">Qualifica:</span><br/>
                <span>{data.dati_dipendente.qualifica} - {data.dati_dipendente.livello}</span>
              </div>
            </div>
          </div>
        )}

        {/* Importi Finali - NETTO IN EVIDENZA */}
        {data.importi_finali && (
          <div className="bg-green-50 rounded-lg p-6">
            <h3 className="font-semibold text-green-800 mb-4">Importi</h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-gray-500 text-sm">Lordo</div>
                <div className="text-lg font-semibold">
                  € {(data.importi_finali.retribuzione_lorda || data.importi_finali.totale_competenze || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-500 text-sm">Trattenute</div>
                <div className="text-lg font-semibold text-red-600">
                  - € {(data.importi_finali.totale_trattenute || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="text-center border-l-2 border-green-300 pl-4">
                <div className="text-gray-500 text-sm">NETTO IN BUSTA</div>
                <div className="text-2xl font-bold text-green-700">
                  € {(data.importi_finali.netto_in_busta || data.importi_finali.netto_da_pagare || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-500 text-sm">Validazione</div>
                <div className="text-sm">
                  Calcolato: € {(validazione.netto_calcolato || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                  <br/>
                  Diff: € {(validazione.differenza || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ferie e Permessi */}
        {data.ferie_permessi && (
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-2">Ferie e Permessi</h3>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Ferie Saldo:</span>
                <span className="font-semibold ml-2">{data.ferie_permessi.ferie_saldo || 0}</span>
              </div>
              <div>
                <span className="text-gray-500">Permessi Saldo:</span>
                <span className="font-semibold ml-2">{data.ferie_permessi.permessi_saldo || 0}</span>
              </div>
              <div>
                <span className="text-gray-500">ROL Saldo:</span>
                <span className="font-semibold ml-2">{data.ferie_permessi.rol_saldo || 0}</span>
              </div>
              <div>
                <span className="text-gray-500">Ex Festività:</span>
                <span className="font-semibold ml-2">{data.ferie_permessi.ex_festivita_saldo || 0}</span>
              </div>
            </div>
          </div>
        )}

        {/* TFR */}
        {data.tfr && data.tfr.quota_tfr_mese > 0 && (
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-2">TFR</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Retribuzione Utile:</span>
                <span className="font-semibold ml-2">€ {(data.tfr.retribuzione_utile_tfr || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="text-gray-500">Quota Mese:</span>
                <span className="font-semibold ml-2">€ {(data.tfr.quota_tfr_mese || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="text-gray-500">Totale Maturato:</span>
                <span className="font-semibold ml-2">€ {(data.tfr.totale_tfr_maturato || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <PageLayout 
      title="Import Documenti AI" 
      subtitle="Parser migliorato per F24 e Cedolini"
      icon={<FileText size={24} />}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Upload Area */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
            }`}
          >
            <input {...getInputProps()} />
            <Upload size={48} className="mx-auto text-gray-400 mb-4" />
            {isDragActive ? (
              <p className="text-blue-600 font-semibold">Rilascia il file qui...</p>
            ) : (
              <>
                <p className="text-gray-600 mb-2">Trascina un file PDF o immagine qui</p>
                <p className="text-gray-400 text-sm">oppure clicca per selezionare</p>
              </>
            )}
          </div>

          {file && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText size={24} className="text-blue-600" />
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <button 
                onClick={() => { setFile(null); setResult(null); setError(null); }}
                className="text-gray-400 hover:text-red-500"
              >
                ✕
              </button>
            </div>
          )}

          {/* Tipo Documento */}
          <div className="mt-4 flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Tipo documento:</label>
            <select 
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="border rounded-lg px-3 py-2"
            >
              <option value="auto">Rileva automaticamente</option>
              <option value="f24">Modello F24</option>
              <option value="cedolino">Cedolino / Busta Paga</option>
            </select>
          </div>

          {/* Parse Button */}
          <button
            onClick={handleParse}
            disabled={!file || loading}
            className={`mt-4 w-full py-3 rounded-lg font-semibold text-white transition-colors flex items-center justify-center gap-2 ${
              !file || loading 
                ? 'bg-gray-300 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Analisi in corso...
              </>
            ) : (
              <>
                <FileText size={20} />
                Analizza Documento
              </>
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="text-red-500 flex-shrink-0" size={24} />
            <div>
              <h4 className="font-semibold text-red-800">Errore</h4>
              <p className="text-red-600">{error}</p>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                {result.success !== false ? (
                  <CheckCircle className="text-green-500" size={24} />
                ) : (
                  <AlertCircle className="text-orange-500" size={24} />
                )}
                Risultato Estrazione
              </h3>
              {result._parsing_info && (
                <span className="text-sm text-gray-500">
                  {result._parsing_info.parser} • {result._parsing_info.pages_processed} pagine
                </span>
              )}
            </div>

            {/* Render based on document type */}
            {result.sezione_erario !== undefined ? (
              renderF24Result(result)
            ) : result.dati_dipendente !== undefined ? (
              renderCedolinoResult(result)
            ) : (
              <pre className="bg-gray-50 p-4 rounded-lg overflow-auto text-sm">
                {JSON.stringify(result, null, 2)}
              </pre>
            )}

            {/* Raw JSON Toggle */}
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                Mostra JSON completo
              </summary>
              <pre className="mt-2 bg-gray-50 p-4 rounded-lg overflow-auto text-xs max-h-96">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
