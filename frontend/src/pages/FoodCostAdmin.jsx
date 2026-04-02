import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { COLORS, STYLES, button, badge } from '../lib/utils';
import { PageLayout } from '../components/PageLayout';

export default function FoodCostAdmin() {
  const [riepilogo, setRiepilogo] = useState([]);
  const [dizionario, setDizionario] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState(null);
  const [tab, setTab] = useState('riepilogo');
  const [cerca, setCerca] = useState('');

  const carica = useCallback(async () => {
    setLoading(true);
    try {
      const [resR, resD] = await Promise.all([
        api.get('/api/cucina/food-cost/ricette-riepilogo'),
        api.get('/api/cucina/food-cost/dizionario'),
      ]);
      setRiepilogo(resR.data || []);
      setDizionario(resD.data || []);
    } catch {
      setErrore('Errore nel caricamento food cost');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carica(); }, [carica]);

  const riepilogoFiltrato = riepilogo.filter(r =>
    !cerca || r.nome?.toLowerCase().includes(cerca.toLowerCase())
  );
  const dizionarioFiltrato = dizionario.filter(d =>
    !cerca || d.nome?.toLowerCase().includes(cerca.toLowerCase())
  );

  const tabStyle = (active) => ({
    padding: '8px 16px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 13,
    border: 'none',
    borderBottom: active ? `3px solid ${COLORS.primary}` : '3px solid transparent',
    background: 'transparent',
    color: active ? COLORS.primary : COLORS.gray,
  });

  return (
    <PageLayout>
      <div style={STYLES.header}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>💰 Food Cost</h1>
          <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: 14 }}>Analisi costi per ricetta e ingredienti</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={badge('info')}>{riepilogo.length} ricette</span>
          <span style={badge('success')}>{dizionario.length} ingredienti</span>
        </div>
      </div>

      {errore && <div style={{ ...badge('danger'), marginBottom: 12 }}>{errore}</div>}

      {/* Tabs interni */}
      <div style={{ borderBottom: `2px solid ${COLORS.grayLight}`, marginBottom: 16, display: 'flex', gap: 4 }}>
        <button style={tabStyle(tab === 'riepilogo')} onClick={() => setTab('riepilogo')}>📊 Riepilogo Ricette</button>
        <button style={tabStyle(tab === 'dizionario')} onClick={() => setTab('dizionario')}>📦 Dizionario Ingredienti</button>
      </div>

      {/* Barra ricerca */}
      <div style={{ marginBottom: 12 }}>
        <input
          style={{ ...STYLES.input, maxWidth: 320 }}
          placeholder={tab === 'riepilogo' ? 'Cerca ricetta...' : 'Cerca ingrediente...'}
          value={cerca}
          onChange={e => setCerca(e.target.value)}
        />
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: COLORS.gray }}>Caricamento...</div>
      ) : tab === 'riepilogo' ? (
        <div style={STYLES.card}>
          {riepilogoFiltrato.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: COLORS.gray }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>💰</div>
              <p>Nessuna ricetta trovata. Prima crea delle ricette nel Ricettario.</p>
            </div>
          ) : (
            <table style={STYLES.table}>
              <thead>
                <tr>
                  <th style={STYLES.th}>Ricetta</th>
                  <th style={STYLES.th}>Reparto</th>
                  <th style={STYLES.th}>Porzioni</th>
                  <th style={STYLES.th}>N° Ingredienti</th>
                  <th style={STYLES.th}>Costo Totale</th>
                  <th style={STYLES.th}>Costo / Porzione</th>
                  <th style={STYLES.th}>Stato</th>
                </tr>
              </thead>
              <tbody>
                {riepilogoFiltrato.map(r => (
                  <tr key={r.id}>
                    <td style={{ ...STYLES.td, fontWeight: 600 }}>{r.nome}</td>
                    <td style={STYLES.td}>{r.reparto || '-'}</td>
                    <td style={STYLES.td}>{r.porzioni}</td>
                    <td style={STYLES.td}>{r.n_ingredienti}</td>
                    <td style={STYLES.td}>€ {(r.costo_totale || 0).toFixed(2)}</td>
                    <td style={{ ...STYLES.td, fontWeight: 700, color: COLORS.primary }}>€ {(r.costo_porzione || 0).toFixed(3)}</td>
                    <td style={STYLES.td}>
                      <span style={badge(r.approvata ? 'success' : 'warning')}>
                        {r.approvata ? 'Approvata' : 'Bozza'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div style={STYLES.card}>
          {dizionarioFiltrato.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: COLORS.gray }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
              <p>Nessun ingrediente nel dizionario. I prezzi vengono estratti dagli acquisti.</p>
            </div>
          ) : (
            <table style={STYLES.table}>
              <thead>
                <tr>
                  <th style={STYLES.th}>Ingrediente</th>
                  <th style={STYLES.th}>Fornitore</th>
                  <th style={STYLES.th}>Unità</th>
                  <th style={STYLES.th}>Prezzo Medio</th>
                  <th style={STYLES.th}>Ultimo Prezzo</th>
                  <th style={STYLES.th}>N° Acquisti</th>
                </tr>
              </thead>
              <tbody>
                {dizionarioFiltrato.map((d, i) => (
                  <tr key={i}>
                    <td style={{ ...STYLES.td, fontWeight: 600 }}>{d.nome}</td>
                    <td style={STYLES.td}>{d.fornitore || '-'}</td>
                    <td style={STYLES.td}>{d.unita || '-'}</td>
                    <td style={STYLES.td}>€ {(d.prezzo_medio || 0).toFixed(3)}</td>
                    <td style={{ ...STYLES.td, fontWeight: 700, color: COLORS.primary }}>€ {(d.ultimo_prezzo || 0).toFixed(3)}</td>
                    <td style={STYLES.td}>{d.n_acquisti || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </PageLayout>
  );
}
