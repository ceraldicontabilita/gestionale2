import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { COLORS, STYLES, button, badge } from '../lib/utils';
import { PageLayout } from '../components/PageLayout';

export default function CatalogoOrdini() {
  const [prodotti, setProdotti] = useState([]);
  const [fornitori, setFornitori] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState(null);
  const [cerca, setCerca] = useState('');
  const [filtroFornitore, setFiltroFornitore] = useState('');
  const [selezionati, setSelezionati] = useState([]);
  const [showOrdine, setShowOrdine] = useState(false);
  const [invio, setInvio] = useState(false);

  const carica = useCallback(async () => {
    setLoading(true);
    try {
      const [resP, resF] = await Promise.all([
        api.get('/api/cucina/ordini-fornitori/prodotti-suggeriti'),
        api.get('/api/fornitori'),
      ]);
      setProdotti(resP.data || []);
      setFornitori(resF.data || []);
    } catch {
      setErrore('Errore nel caricamento catalogo');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carica(); }, [carica]);

  const prodottiFiltrati = prodotti.filter(p => {
    const matchCerca = !cerca || p.nome?.toLowerCase().includes(cerca.toLowerCase());
    const matchFor = !filtroFornitore || p.fornitore === filtroFornitore;
    return matchCerca && matchFor;
  });

  const toggleSelezione = (prodotto) => {
    setSelezionati(prev => {
      const esiste = prev.find(p => p.nome === prodotto.nome);
      if (esiste) return prev.filter(p => p.nome !== prodotto.nome);
      return [...prev, { ...prodotto, quantita: 1, unit_price: prodotto.ultimo_prezzo || 0 }];
    });
  };

  const creaOrdine = async () => {
    if (selezionati.length === 0) return;
    setInvio(true);
    try {
      await api.post('/api/cucina/ordini-fornitori', {
        fornitore: filtroFornitore || 'Vario',
        items: selezionati.map(p => ({
          nome: p.nome,
          quantita: p.quantita,
          prezzo: p.unit_price,
          unita: p.unita || '',
        })),
        note: '',
      });
      setSelezionati([]);
      setShowOrdine(false);
      alert('Ordine creato con successo!');
    } catch {
      setErrore('Errore nella creazione dell\'ordine');
    } finally {
      setInvio(false);
    }
  };

  const fornitoriFiltrati = [...new Set(prodotti.map(p => p.fornitore).filter(Boolean))];

  return (
    <PageLayout>
      <div style={STYLES.header}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>🛒 Catalogo Ordini</h1>
          <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: 14 }}>Prodotti suggeriti da ordinare ai fornitori</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {selezionati.length > 0 && (
            <span style={badge('info')}>{selezionati.length} selezionati</span>
          )}
          <button
            style={button('primary', selezionati.length === 0)}
            onClick={() => setShowOrdine(true)}
            disabled={selezionati.length === 0}
          >
            Crea Ordine
          </button>
        </div>
      </div>

      {errore && <div style={{ ...badge('danger'), marginBottom: 12 }}>{errore}</div>}

      {/* Filtri */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          style={{ ...STYLES.input, maxWidth: 280 }}
          placeholder="Cerca prodotto..."
          value={cerca}
          onChange={e => setCerca(e.target.value)}
        />
        <select
          style={{ ...STYLES.select, maxWidth: 220 }}
          value={filtroFornitore}
          onChange={e => setFiltroFornitore(e.target.value)}
        >
          <option value="">Tutti i fornitori</option>
          {fornitoriFiltrati.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      {/* Modale ordine */}
      {showOrdine && (
        <div style={{ ...STYLES.card, marginBottom: 16, border: `2px solid ${COLORS.primary}` }}>
          <h3 style={{ margin: '0 0 12px', color: COLORS.primary }}>Riepilogo Ordine</h3>
          <table style={STYLES.table}>
            <thead>
              <tr>
                <th style={STYLES.th}>Prodotto</th>
                <th style={STYLES.th}>Quantità</th>
                <th style={STYLES.th}>Prezzo</th>
                <th style={STYLES.th}></th>
              </tr>
            </thead>
            <tbody>
              {selezionati.map((p, i) => (
                <tr key={i}>
                  <td style={STYLES.td}>{p.nome}</td>
                  <td style={STYLES.td}>
                    <input
                      type="number"
                      min="1"
                      style={{ ...STYLES.input, width: 80 }}
                      value={p.quantita}
                      onChange={e => setSelezionati(prev =>
                        prev.map((x, xi) => xi === i ? { ...x, quantita: parseInt(e.target.value) || 1 } : x)
                      )}
                    />
                  </td>
                  <td style={STYLES.td}>€ {(p.unit_price || 0).toFixed(2)}</td>
                  <td style={STYLES.td}>
                    <button style={{ ...button('danger'), padding: '4px 8px', fontSize: 12 }} onClick={() => toggleSelezione(p)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button style={button('primary', invio)} onClick={creaOrdine} disabled={invio}>{invio ? 'Invio...' : 'Conferma Ordine'}</button>
            <button style={button('secondary')} onClick={() => setShowOrdine(false)}>Annulla</button>
          </div>
        </div>
      )}

      {/* Lista prodotti */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: COLORS.gray }}>Caricamento...</div>
      ) : (
        <div style={STYLES.card}>
          {prodottiFiltrati.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: COLORS.gray }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🛒</div>
              <p>Nessun prodotto trovato. I suggerimenti vengono generati dagli acquisti storici.</p>
            </div>
          ) : (
            <table style={STYLES.table}>
              <thead>
                <tr>
                  <th style={STYLES.th}></th>
                  <th style={STYLES.th}>Prodotto</th>
                  <th style={STYLES.th}>Fornitore</th>
                  <th style={STYLES.th}>Unità</th>
                  <th style={STYLES.th}>Ultimo Prezzo</th>
                  <th style={STYLES.th}>N° Acquisti</th>
                </tr>
              </thead>
              <tbody>
                {prodottiFiltrati.map((p, i) => {
                  const sel = selezionati.find(s => s.nome === p.nome);
                  return (
                    <tr key={i} style={{ background: sel ? '#eff6ff' : 'transparent' }}>
                      <td style={STYLES.td}>
                        <input type="checkbox" checked={!!sel} onChange={() => toggleSelezione(p)} />
                      </td>
                      <td style={{ ...STYLES.td, fontWeight: 600 }}>{p.nome}</td>
                      <td style={STYLES.td}>{p.fornitore || '-'}</td>
                      <td style={STYLES.td}>{p.unita || '-'}</td>
                      <td style={{ ...STYLES.td, fontWeight: 700, color: COLORS.primary }}>
                        {p.ultimo_prezzo ? `€ ${p.ultimo_prezzo.toFixed(2)}` : '-'}
                      </td>
                      <td style={STYLES.td}>{p.n_acquisti || 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </PageLayout>
  );
}
