import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { COLORS, STYLES, button, badge } from '../lib/utils';
import { PageLayout } from '../components/PageLayout';

const FORM_VUOTO = { nome: '', categoria: '', prezzo_netto: '', aliquota_iva: 10, costo_produzione: '', margine: '', attivo: true, note: '' };

export default function ProdottiVendita() {
  const [prodotti, setProdotti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(FORM_VUOTO);
  const [editId, setEditId] = useState(null);
  const [cerca, setCerca] = useState('');

  const carica = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/cucina/prodotti-vendita/lista');
      setProdotti(res.data || []);
    } catch {
      setErrore('Errore nel caricamento prodotti');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carica(); }, [carica]);

  const apriModifica = (p) => {
    setForm({ ...p, prezzo_netto: p.prezzo_netto || '', aliquota_iva: p.aliquota_iva || 10, costo_produzione: p.costo_produzione || '', margine: p.margine || '' });
    setEditId(p.id);
    setShowForm(true);
  };

  const annulla = () => {
    setForm(FORM_VUOTO);
    setEditId(null);
    setShowForm(false);
  };

  const salva = async () => {
    const dati = {
      ...form,
      prezzo_netto: parseFloat(form.prezzo_netto) || 0,
      aliquota_iva: parseFloat(form.aliquota_iva) || 10,
      costo_produzione: parseFloat(form.costo_produzione) || 0,
      margine: parseFloat(form.margine) || 0,
    };
    try {
      if (editId) {
        await api.put(`/api/cucina/prodotti-vendita/${editId}`, dati);
      } else {
        await api.post('/api/cucina/prodotti-vendita', dati);
      }
      annulla();
      carica();
    } catch {
      setErrore('Errore nel salvataggio');
    }
  };

  const elimina = async (id) => {
    if (!window.confirm('Eliminare questo prodotto?')) return;
    try {
      await api.delete(`/api/cucina/prodotti-vendita/${id}`);
      carica();
    } catch {
      setErrore('Errore nell\'eliminazione');
    }
  };

  const prodottiFiltrati = prodotti.filter(p =>
    !cerca || p.nome?.toLowerCase().includes(cerca.toLowerCase()) || p.categoria?.toLowerCase().includes(cerca.toLowerCase())
  );

  const prezzoLordo = (netto, iva) => {
    const n = parseFloat(netto) || 0;
    const i = parseFloat(iva) || 0;
    return (n * (1 + i / 100)).toFixed(2);
  };

  return (
    <PageLayout>
      <div style={STYLES.header}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>🛍️ Prodotti Vendita</h1>
          <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: 14 }}>Listino prodotti del locale</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={badge('info')}>{prodotti.length} prodotti</span>
          <button style={button('primary')} onClick={() => { setForm(FORM_VUOTO); setEditId(null); setShowForm(true); }}>+ Aggiungi</button>
        </div>
      </div>

      {errore && <div style={{ ...badge('danger'), marginBottom: 12 }}>{errore}</div>}

      {/* Form aggiunta / modifica */}
      {showForm && (
        <div style={{ ...STYLES.card, marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 12px', color: COLORS.primary }}>{editId ? 'Modifica Prodotto' : 'Nuovo Prodotto'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Nome *</label>
              <input style={STYLES.input} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome prodotto" />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Categoria</label>
              <input style={STYLES.input} value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} placeholder="Es. Primo, Antipasto" />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Prezzo Netto (€)</label>
              <input style={STYLES.input} type="number" step="0.01" min="0" value={form.prezzo_netto} onChange={e => setForm(f => ({ ...f, prezzo_netto: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>IVA (%)</label>
              <select style={STYLES.select} value={form.aliquota_iva} onChange={e => setForm(f => ({ ...f, aliquota_iva: parseFloat(e.target.value) }))}>
                <option value={4}>4%</option>
                <option value={5}>5%</option>
                <option value={10}>10%</option>
                <option value={22}>22%</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Costo Produzione (€)</label>
              <input style={STYLES.input} type="number" step="0.001" min="0" value={form.costo_produzione} onChange={e => setForm(f => ({ ...f, costo_produzione: e.target.value }))} placeholder="0.000" />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Note</label>
              <input style={STYLES.input} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Note facoltative" />
            </div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button style={button('primary')} onClick={salva} disabled={!form.nome}>Salva</button>
            <button style={button('secondary')} onClick={annulla}>Annulla</button>
            {form.prezzo_netto && (
              <span style={{ marginLeft: 8, color: COLORS.gray, fontSize: 13 }}>
                Prezzo lordo: <strong>€ {prezzoLordo(form.prezzo_netto, form.aliquota_iva)}</strong>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Ricerca */}
      <div style={{ marginBottom: 12 }}>
        <input
          style={{ ...STYLES.input, maxWidth: 320 }}
          placeholder="Cerca per nome o categoria..."
          value={cerca}
          onChange={e => setCerca(e.target.value)}
        />
      </div>

      {/* Tabella */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: COLORS.gray }}>Caricamento...</div>
      ) : (
        <div style={STYLES.card}>
          {prodottiFiltrati.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: COLORS.gray }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🛍️</div>
              <p>Nessun prodotto trovato. Aggiungine uno!</p>
            </div>
          ) : (
            <table style={STYLES.table}>
              <thead>
                <tr>
                  <th style={STYLES.th}>Nome</th>
                  <th style={STYLES.th}>Categoria</th>
                  <th style={STYLES.th}>Prezzo Netto</th>
                  <th style={STYLES.th}>IVA</th>
                  <th style={STYLES.th}>Prezzo Lordo</th>
                  <th style={STYLES.th}>Costo Prod.</th>
                  <th style={STYLES.th}>Stato</th>
                  <th style={STYLES.th}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {prodottiFiltrati.map(p => (
                  <tr key={p.id}>
                    <td style={{ ...STYLES.td, fontWeight: 600 }}>{p.nome}</td>
                    <td style={STYLES.td}>{p.categoria || '-'}</td>
                    <td style={STYLES.td}>€ {(p.prezzo_netto || 0).toFixed(2)}</td>
                    <td style={STYLES.td}>{p.aliquota_iva || 10}%</td>
                    <td style={{ ...STYLES.td, fontWeight: 700, color: COLORS.primary }}>
                      € {prezzoLordo(p.prezzo_netto, p.aliquota_iva)}
                    </td>
                    <td style={STYLES.td}>{p.costo_produzione ? `€ ${p.costo_produzione.toFixed(3)}` : '-'}</td>
                    <td style={STYLES.td}>
                      <span style={badge(p.attivo !== false ? 'success' : 'danger')}>
                        {p.attivo !== false ? 'Attivo' : 'Disattivo'}
                      </span>
                    </td>
                    <td style={STYLES.td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button style={{ ...button('info'), padding: '4px 10px', fontSize: 12 }} onClick={() => apriModifica(p)}>Modifica</button>
                        <button style={{ ...button('danger'), padding: '4px 10px', fontSize: 12 }} onClick={() => elimina(p.id)}>Elimina</button>
                      </div>
                    </td>
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
