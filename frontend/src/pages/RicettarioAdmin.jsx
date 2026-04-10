import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { COLORS, STYLES, button, badge , useIsMobile, RG, pagePad } from '../lib/utils';
import { PageLayout } from '../components/PageLayout';

export default function RicettarioAdmin() {
  const isMobile = useIsMobile();
  const [ricette, setRicette] = useState([]);
  const [stats, setStats] = useState({ totale: 0, da_approvare: 0 });
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState(null);
  const [selezionata, setSelezionata] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nome: '', reparto: '', porzioni: 1, note: '', approvata: false });

  const carica = useCallback(async () => {
    setLoading(true);
    try {
      const [resRic, resSt] = await Promise.all([
        api.get('/api/cucina/ricette'),
        api.get('/api/cucina/ricette/stats'),
      ]);
      setRicette(resRic.data || []);
      setStats(resSt.data || { totale: 0, da_approvare: 0 });
    } catch (e) {
      setErrore('Errore nel caricamento ricette');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carica(); }, [carica]);

  const salva = async () => {
    try {
      await api.post('/api/cucina/ricette', { ...form, ingredienti: [] });
      setShowForm(false);
      setForm({ nome: '', reparto: '', porzioni: 1, note: '', approvata: false });
      carica();
    } catch { setErrore('Errore nel salvataggio'); }
  };

  const elimina = async (id) => {
    if (!window.confirm('Eliminare questa ricetta?')) return;
    try {
      await api.delete(`/api/cucina/ricette/${id}`);
      if (selezionata?.id === id) setSelezionata(null);
      carica();
    } catch { setErrore('Errore nell\'eliminazione'); }
  };

  return (
    <PageLayout>
      {/* Header */}
      <div style={STYLES.header}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>📖 Ricettario</h1>
          <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: 14 }}>Gestione ricette e ingredienti</p>
        </div>
        <button style={button('primary')} onClick={() => setShowForm(true)}>+ Nuova Ricetta</button>
      </div>

      {/* Badge stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={badge('info')}>Totale: {stats.totale}</span>
        {stats.da_approvare > 0 && (
          <span style={badge('warning')}>Da approvare: {stats.da_approvare}</span>
        )}
      </div>

      {errore && <div style={{ ...badge('danger'), marginBottom: 12 }}>{errore}</div>}

      {/* Form creazione */}
      {showForm && (
        <div style={{ ...STYLES.card, marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 12px', color: COLORS.primary }}>Nuova Ricetta</h3>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Nome *</label>
              <input style={STYLES.input} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Es. Pasta al pomodoro" />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Reparto</label>
              <input style={STYLES.input} value={form.reparto} onChange={e => setForm(f => ({ ...f, reparto: e.target.value }))} placeholder="Es. Cucina calda" />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Porzioni</label>
              <input style={STYLES.input} type="number" min="1" value={form.porzioni} onChange={e => setForm(f => ({ ...f, porzioni: parseInt(e.target.value) || 1 }))} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Note</label>
              <input style={STYLES.input} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Note facoltative" />
            </div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button style={button('primary')} onClick={salva} disabled={!form.nome}>Salva</button>
            <button style={button('secondary')} onClick={() => setShowForm(false)}>Annulla</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selezionata ? '1fr 1fr' : '1fr', gap: 16 }}>
        {/* Tabella ricette */}
        <div style={STYLES.card}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: COLORS.gray }}>Caricamento...</div>
          ) : ricette.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: COLORS.gray }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📖</div>
              <p>Nessuna ricetta trovata. Creane una!</p>
            </div>
          ) : (
            <table style={STYLES.table}>
              <thead>
                <tr>
                  <th style={STYLES.th}>Nome</th>
                  <th style={STYLES.th}>Reparto</th>
                  <th style={STYLES.th}>Porzioni</th>
                  <th style={STYLES.th}>Stato</th>
                  <th style={STYLES.th}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {ricette.map(r => (
                  <tr key={r.id} style={{ background: selezionata?.id === r.id ? '#eff6ff' : 'transparent', cursor: 'pointer' }}>
                    <td style={STYLES.td} onClick={() => setSelezionata(r)}>{r.nome}</td>
                    <td style={STYLES.td} onClick={() => setSelezionata(r)}>{r.reparto || '-'}</td>
                    <td style={STYLES.td} onClick={() => setSelezionata(r)}>{r.porzioni || 1}</td>
                    <td style={STYLES.td}>
                      <span style={badge(r.approvata ? 'success' : 'warning')}>
                        {r.approvata ? 'Approvata' : 'Bozza'}
                      </span>
                    </td>
                    <td style={STYLES.td}>
                      <button style={{ ...button('danger'), padding: '4px 10px', fontSize: 12 }} onClick={() => elimina(r.id)}>Elimina</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Dettaglio ricetta selezionata */}
        {selezionata && (
          <div style={STYLES.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: COLORS.primary }}>{selezionata.nome}</h3>
              <button style={{ ...button('secondary'), padding: '4px 10px', fontSize: 12 }} onClick={() => setSelezionata(null)}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div><strong>Reparto:</strong> {selezionata.reparto || '-'}</div>
              <div><strong>Porzioni:</strong> {selezionata.porzioni || 1}</div>
              <div><strong>Food Cost:</strong> €{(selezionata.food_cost || 0).toFixed(3)}</div>
              <div><strong>Stato:</strong> <span style={badge(selezionata.approvata ? 'success' : 'warning')}>{selezionata.approvata ? 'Approvata' : 'Bozza'}</span></div>
            </div>
            {selezionata.note && <p style={{ color: COLORS.gray, fontSize: 13 }}>{selezionata.note}</p>}
            {selezionata.ingredienti?.length > 0 ? (
              <>
                <h4 style={{ margin: '12px 0 8px', color: COLORS.primary }}>Ingredienti ({selezionata.ingredienti.length})</h4>
                <table style={STYLES.table}>
                  <thead>
                    <tr>
                      <th style={STYLES.th}>Ingrediente</th>
                      <th style={STYLES.th}>Quantità</th>
                      <th style={STYLES.th}>Unità</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selezionata.ingredienti.map((ing, i) => (
                      <tr key={i}>
                        <td style={STYLES.td}>{ing.nome || ing.descrizione || '-'}</td>
                        <td style={STYLES.td}>{ing.quantita || '-'}</td>
                        <td style={STYLES.td}>{ing.unita || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <p style={{ color: COLORS.gray, fontSize: 13, marginTop: 8 }}>Nessun ingrediente inserito.</p>
            )}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
