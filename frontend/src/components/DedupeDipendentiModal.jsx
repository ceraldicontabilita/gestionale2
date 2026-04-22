import React, { useState, useEffect, useCallback } from 'react';
import { X, AlertTriangle, CheckCircle, ChevronRight } from 'lucide-react';
import api from '../api';
import { COLORS } from '../lib/utils';

/**
 * Modal di gestione duplicati dipendenti.
 * - Mostra i gruppi di sospetti duplicati rilevati dal backend
 * - Per ogni gruppo consente di scegliere il record "target" e unificare
 * - I cedolini del duplicato vengono re-point al target ed eventuali duplicati
 *   (stesso anno+mese) vengono eliminati dal backend — nessun cedolino duplicato.
 */
export default function DedupeDipendentiModal({ open, onClose, onMerged }) {
  const [loading, setLoading] = useState(false);
  const [gruppi, setGruppi] = useState([]);
  const [merging, setMerging] = useState(null);
  const [targetByGroup, setTargetByGroup] = useState({});
  const [result, setResult] = useState(null);

  const loadDuplicati = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/dipendenti/duplicati');
      const g = r.data?.gruppi || [];
      setGruppi(g);
      // Inizializza target: il record più "ricco" (con più campi valorizzati) di ogni gruppo
      const score = d => {
        let s = 0;
        const fields = [
          'codice_fiscale',
          'iban',
          'mansione',
          'livello',
          'tipo_contratto',
          'data_assunzione',
          'telefono',
          'email',
        ];
        fields.forEach(f => {
          if (d[f]) s += 2;
        });
        if (d.progressivi && Object.keys(d.progressivi).length) s += 5;
        if (d.tfr && Object.keys(d.tfr).length) s += 5;
        return s;
      };
      const initial = {};
      g.forEach((gruppo, idx) => {
        const sorted = [...(gruppo.dipendenti || [])].sort((a, b) => score(b) - score(a));
        initial[idx] = sorted[0]?.id || null;
      });
      setTargetByGroup(initial);
    } catch {
      setGruppi([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadDuplicati();
      setResult(null);
    }
  }, [open, loadDuplicati]);

  const eseguiMerge = async (gruppo, gruppoIdx) => {
    const targetId = targetByGroup[gruppoIdx];
    if (!targetId) return;
    const duplicati = gruppo.dipendenti.filter(d => d.id !== targetId);
    setMerging(gruppoIdx);
    setResult(null);
    try {
      const stats = [];
      for (const dup of duplicati) {
        const r = await api.post('/api/dipendenti/duplicati/merge', {
          target_id: targetId,
          duplicate_id: dup.id,
          soft: true,
        });
        stats.push(r.data);
      }
      setResult({ success: true, gruppoIdx, stats });
      await loadDuplicati();
      if (onMerged) onMerged();
    } catch (e) {
      setResult({ success: false, error: e.response?.data?.detail || e.message });
    } finally {
      setMerging(null);
    }
  };

  const autoMergeAll = async () => {
    if (
      !window.confirm(
        'Eseguire auto-merge di tutti i duplicati ad alta certezza? I cedolini duplicati (stesso anno+mese) verranno eliminati.'
      )
    )
      return;
    setMerging('auto');
    try {
      const r = await api.post('/api/dipendenti/duplicati/auto-merge', { dry_run: false });
      setResult({ success: true, auto: true, data: r.data });
      await loadDuplicati();
      if (onMerged) onMerged();
    } catch (e) {
      setResult({ success: false, error: e.response?.data?.detail || e.message });
    } finally {
      setMerging(null);
    }
  };

  if (!open) return null;

  const altaCertezzaCount = gruppi.filter(g => g.certezza === 'alta').length;

  return (
    <div
      data-testid="dedupe-modal"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 16,
          width: 'min(880px, 92vw)',
          maxHeight: '86vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: `1px solid ${COLORS.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: COLORS.text }}>
              Gestione duplicati dipendenti
            </h2>
            <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>
              I cedolini dei duplicati verranno riassegnati al record scelto; eventuali cedolini
              duplicati (stesso anno+mese) verranno eliminati.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: COLORS.textMuted,
            }}
            data-testid="btn-close-dedupe"
          >
            <X size={20} />
          </button>
        </div>

        {/* Azioni globali */}
        <div
          style={{
            padding: '12px 24px',
            borderBottom: `1px solid ${COLORS.border}`,
            background: '#f8fafc',
            display: 'flex',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: 13, color: COLORS.text, flex: 1 }}>
            {loading
              ? 'Analisi in corso…'
              : `${gruppi.length} gruppo/i sospetti · ${altaCertezzaCount} ad alta certezza`}
          </div>
          <button
            data-testid="btn-auto-merge-all"
            onClick={autoMergeAll}
            disabled={altaCertezzaCount === 0 || merging === 'auto'}
            style={{
              padding: '7px 14px',
              border: 'none',
              borderRadius: 6,
              background: altaCertezzaCount === 0 ? '#cbd5e1' : COLORS.primary,
              color: 'white',
              fontSize: 12,
              fontWeight: 600,
              cursor: altaCertezzaCount === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {merging === 'auto' ? 'Auto-merge…' : `Auto-merge alta certezza (${altaCertezzaCount})`}
          </button>
        </div>

        {/* Risultato */}
        {result && (
          <div
            style={{
              padding: '10px 24px',
              background: result.success ? '#f0fdf4' : '#fef2f2',
              color: result.success ? '#15803d' : '#dc2626',
              fontSize: 13,
              borderBottom: `1px solid ${COLORS.border}`,
            }}
          >
            {result.success
              ? result.auto
                ? `✓ Auto-merge completato: ${result.data?.totale_merges || 0} merge eseguiti.`
                : `✓ Merge eseguito con successo (${result.stats?.length || 0}).`
              : `✗ Errore: ${result.error}`}
          </div>
        )}

        {/* Lista gruppi */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px' }}>
          {loading && (
            <div style={{ padding: 40, textAlign: 'center', color: COLORS.textMuted }}>
              Caricamento…
            </div>
          )}
          {!loading && gruppi.length === 0 && (
            <div
              style={{
                padding: 40,
                textAlign: 'center',
                color: COLORS.textMuted,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <CheckCircle size={36} color="#16a34a" />
              <div style={{ fontWeight: 600, color: COLORS.text }}>Nessun duplicato rilevato</div>
              <div style={{ fontSize: 12 }}>L'anagrafica è pulita.</div>
            </div>
          )}
          {gruppi.map((g, idx) => (
            <div
              key={idx}
              data-testid={`dup-group-${idx}`}
              style={{
                border: `1px solid ${g.certezza === 'alta' ? '#fca5a5' : '#fde68a'}`,
                borderRadius: 10,
                padding: 14,
                marginBottom: 14,
                background: g.certezza === 'alta' ? '#fef2f2' : '#fffbeb',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <AlertTriangle size={16} color={g.certezza === 'alta' ? '#dc2626' : '#d97706'} />
                <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.text, flex: 1 }}>
                  {g.tipo === 'codice_fiscale_identico'
                    ? 'Codice fiscale identico'
                    : 'Nome + cognome identici'}{' '}
                  — «{g.chiave}»
                </div>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 99,
                    fontSize: 10,
                    fontWeight: 700,
                    background: g.certezza === 'alta' ? '#dc2626' : '#d97706',
                    color: 'white',
                  }}
                >
                  {g.certezza === 'alta' ? 'CERTO' : 'DA VERIFICARE'}
                </span>
              </div>

              <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 8 }}>
                Scegli quale record mantenere come target (riceverà tutti i dati):
              </div>

              {g.dipendenti.map(d => {
                const isTarget = targetByGroup[idx] === d.id;
                return (
                  <label
                    key={d.id}
                    data-testid={`dup-opt-${d.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: isTarget ? 'white' : 'transparent',
                      border: isTarget ? `1px solid ${COLORS.primary}` : '1px solid transparent',
                      marginBottom: 4,
                    }}
                  >
                    <input
                      type="radio"
                      name={`group-${idx}`}
                      checked={isTarget}
                      onChange={() => setTargetByGroup(p => ({ ...p, [idx]: d.id }))}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>
                        {d.nome_completo || `${d.cognome || ''} ${d.nome || ''}`.trim()}
                      </div>
                      <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
                        ID: {d.id?.slice(0, 8)}… · CF: {d.codice_fiscale || '—'} · IBAN:{' '}
                        {d.iban ? '✓' : '—'} · Mansione: {d.mansione || '—'}
                        {d.progressivi && ' · progressivi ✓'}
                        {d.tfr && ' · TFR ✓'}
                      </div>
                    </div>
                    {isTarget && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.primary }}>
                        TARGET
                      </span>
                    )}
                  </label>
                );
              })}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  data-testid={`btn-merge-${idx}`}
                  onClick={() => eseguiMerge(g, idx)}
                  disabled={merging === idx || !targetByGroup[idx]}
                  style={{
                    padding: '6px 14px',
                    border: 'none',
                    borderRadius: 6,
                    background: merging === idx ? '#cbd5e1' : COLORS.primary,
                    color: 'white',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {merging === idx ? 'Unifico…' : 'Unifica qui'}
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
