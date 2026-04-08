import React, { useState, useEffect } from 'react'
import {
  Home, AlertTriangle, CheckCircle, Clock, FileText,
  Upload, RefreshCw, User, ChevronDown, ChevronRight,
  Printer, Euro
} from 'lucide-react'
import { s, colors, shadow, formatEuro, font } from '../lib/utils'

const API = '/api/tributi'

/* ── Badge stato rata ──────────────────────────────── */
function StatoRata({ stato, inRitardo }) {
  if (stato === 'pagata') return (
    <span style={{ ...s.badge(colors.successText, colors.successBg), fontSize: 10 }}>✅ Pagata</span>
  )
  if (inRitardo) return (
    <span style={{ ...s.badge(colors.dangerText, colors.dangerBg), fontSize: 10 }}>🔴 In ritardo</span>
  )
  return <span style={{ ...s.badge(colors.warningText, colors.warningBg), fontSize: 10 }}>⏳ Da pagare</span>
}

/* ── Card avviso singolo ───────────────────────────── */
function AvvisoCard({ doc, onPaga, privato }) {
  const [open, setOpen] = useState(false)
  const intestatario = doc.intestatario?.nome || doc.codice_fiscale || '?'
  const oggi = new Date().toISOString().split('T')[0]

  return (
    <div style={{
      ...s.card,
      marginBottom: 10,
      borderLeft: privato ? `3px solid ${colors.primary}` : `3px solid ${colors.info}`,
    }}>
      {/* Header */}
      <div style={{ ...s.flexBetween, cursor: 'pointer', marginBottom: open ? 12 : 0 }}
           onClick={() => setOpen(!open)}>
        <div style={{ ...s.flex, gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: privato ? colors.primaryBg : colors.infoBg }}>
            <User size={16} color={privato ? colors.primary : colors.info} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: colors.text }}>
              {doc.tipo_tributo} {doc.anno}
              {privato && (
                <span style={{ ...s.badge(colors.primary, colors.primaryBg), fontSize: 9, marginLeft: 6 }}>
                  PRIVATO
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: colors.textMuted }}>
              {intestatario} · {doc.protocollo || 'N/D'}
              {doc.data_emissione && ` · emesso ${doc.data_emissione}`}
            </div>
          </div>
        </div>
        <div style={{ ...s.flex, gap: 12, alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: colors.text }}>
              {formatEuro(doc.totale_acconto || 0)}
            </div>
            <div style={{ fontSize: 11, color: colors.textLight }}>acconto</div>
          </div>
          {open ? <ChevronDown size={16} color={colors.textMuted} /> : <ChevronRight size={16} color={colors.textMuted} />}
        </div>
      </div>

      {/* Dettaglio */}
      {open && (
        <div>
          {/* Immobile */}
          {doc.immobili?.length > 0 && (
            <div style={{ padding: '10px 12px', background: colors.bg, borderRadius: 8, marginBottom: 10 }}>
              {doc.immobili.map((im, i) => (
                <div key={i} style={{ fontSize: 12, color: colors.textMuted }}>
                  <Home size={12} style={{ display: 'inline', marginRight: 4 }} />
                  {im.indirizzo} — {im.mq} mq — {im.dati_catastali}
                </div>
              ))}
              {doc.categoria_utenza && (
                <div style={{ fontSize: 11, color: colors.textLight, marginTop: 4 }}>
                  Categoria {doc.categoria_utenza.codice}: {doc.categoria_utenza.descrizione}
                </div>
              )}
            </div>
          )}

          {/* Componenti perequative ARERA */}
          {doc.componenti_perequative?.totale > 0 && (
            <div style={{ fontSize: 11, color: colors.textLight, marginBottom: 8,
              padding: '6px 10px', background: colors.infoBg, borderRadius: 6 }}>
              Componenti ARERA: UR1 €{doc.componenti_perequative.UR1?.toFixed(2)} +
              UR2 €{doc.componenti_perequative.UR2?.toFixed(2)} +
              UR3 €{doc.componenti_perequative.UR3?.toFixed(2)} =
              <strong> €{doc.componenti_perequative.totale?.toFixed(2)}</strong>
            </div>
          )}

          {/* Saldo futuro */}
          {doc.scadenza_saldo && (
            <div style={{ fontSize: 11, color: colors.warningText, marginBottom: 8,
              padding: '6px 10px', background: colors.warningBg, borderRadius: 6 }}>
              ⚠️ Saldo/conguaglio: scadenza {doc.scadenza_saldo} — importo da definire con tariffe 2025
            </div>
          )}

          {/* Rate */}
          <div style={s.cardNoPad}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Rata</th>
                  <th style={s.th}>TARI</th>
                  <th style={s.th}>TEFA</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Totale</th>
                  <th style={s.th}>Scadenza</th>
                  <th style={s.th}>Stato</th>
                  <th style={s.th}></th>
                </tr>
              </thead>
              <tbody>
                {(doc.rate || []).map((r, i) => {
                  const inRitardo = r.scadenza && r.scadenza.split('/').reverse().join('-') < oggi && r.stato !== 'pagata'
                  return (
                    <tr key={i} style={{
                      background: r.stato === 'pagata' ? colors.successBg + '40' :
                                  inRitardo ? colors.dangerBg + '40' : 'transparent'
                    }}>
                      <td style={s.td}>
                        <span style={{ fontWeight: 600, fontSize: 12 }}>{r.numero}</span>
                      </td>
                      <td style={s.td}>{formatEuro(r.importo_tari)}</td>
                      <td style={s.td}>{formatEuro(r.importo_tefa)}</td>
                      <td style={{ ...s.td, textAlign: 'right', fontWeight: 700 }}>
                        {formatEuro(r.importo_totale)}
                      </td>
                      <td style={s.td}>{r.scadenza}</td>
                      <td style={s.td}>
                        <StatoRata stato={r.stato} inRitardo={inRitardo} />
                      </td>
                      <td style={{ ...s.td, textAlign: 'right' }}>
                        {r.stato !== 'pagata' && (
                          <button
                            onClick={() => onPaga(doc._id, r.numero, r, doc, privato)}
                            style={{ ...s.btn, ...s.btnPrimary, ...s.btnSmall, gap: 4 }}>
                            <Printer size={12} /> Paga
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Modale di pagamento / stampa ──────────────────── */
function ModalePagamento({ rata, doc, privato, onClose, onConferma }) {
  if (!rata) return null
  const intestatario = doc.intestatario || {}

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{ ...s.card, width: 480, maxWidth: '95vw' }}>
        <div style={{ ...s.flex, gap: 10, marginBottom: 16 }}>
          <Printer size={20} color={colors.primary} />
          <h3 style={s.h2}>Pagamento rata {rata.numero}</h3>
        </div>

        {privato && (
          <div style={{ padding: '8px 12px', borderRadius: 8, background: colors.primaryBg,
            marginBottom: 12, fontSize: 12, color: colors.primary, fontWeight: 600 }}>
            👤 Documento PRIVATO — {intestatario.nome || doc.codice_fiscale}
            <br />
            <span style={{ fontWeight: 400 }}>Non è un documento di Ceraldi Group SRL</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          <div style={s.metricCard}>
            <div style={s.label}>TARI</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{formatEuro(rata.importo_tari)}</div>
          </div>
          <div style={s.metricCard}>
            <div style={s.label}>TEFA</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{formatEuro(rata.importo_tefa)}</div>
          </div>
        </div>

        <div style={{ padding: '12px 16px', borderRadius: 10, background: colors.bg, marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 4 }}>Dati F24 Semplificato</div>
          <div style={{ fontSize: 13, lineHeight: 1.8 }}>
            <div><strong>Contribuente:</strong> {intestatario.nome || doc.codice_fiscale}</div>
            <div><strong>CF:</strong> {doc.codice_fiscale}</div>
            <div><strong>Sezione:</strong> E L (Elementi Identificativi)</div>
            <div><strong>Codice tributo TARI:</strong> 3944 · Ente: F839</div>
            <div><strong>Anno riferimento:</strong> {doc.anno}</div>
            <div><strong>ID Operazione:</strong> <code style={{ fontSize: 11 }}>{rata.id_operazione}</code></div>
            <div style={{ marginTop: 8, fontWeight: 700, fontSize: 15 }}>
              Totale da versare: {formatEuro(rata.importo_totale)}
              <span style={{ fontSize: 11, fontWeight: 400, color: colors.textMuted, marginLeft: 4 }}>
                (scadenza {rata.scadenza})
              </span>
            </div>
          </div>
        </div>

        <div style={{ fontSize: 11, color: colors.textLight, marginBottom: 16, lineHeight: 1.5 }}>
          Il modello F24 pre-compilato si trova nel documento originale allegato all'avviso.
          Verifica che l'Identificativo Operazione corrisponda prima di procedere al pagamento.
        </div>

        <div style={{ ...s.flex, gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ ...s.btn, ...s.btnNeutral }}>Annulla</button>
          <button onClick={onConferma} style={{ ...s.btn, ...s.btnPrimary, gap: 6 }}>
            <CheckCircle size={14} /> Segna come pagata
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Componente upload ─────────────────────────────── */
function UploadZone({ onUpload }) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [risultato, setRisultato] = useState(null)
  const [destinazione, setDestinazione] = useState('auto')

  const gestisciFile = async (files) => {
    if (!files.length) return
    setLoading(true)
    setRisultato(null)
    const fd = new FormData()
    for (const f of files) fd.append('files', f)
    const params = destinazione === 'privato' ? '?forza_privato=true' :
                   destinazione === 'azienda' ? '?forza_azienda=true' : ''
    try {
      const res = await fetch(`${API}/upload-pdf${params}`, { method: 'POST', body: fd })
      setRisultato(await res.json())
      if (onUpload) onUpload()
    } catch (e) {
      setRisultato({ errore: e.message })
    }
    setLoading(false)
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ ...s.flex, gap: 8, marginBottom: 8 }}>
        <label style={{ fontSize: 12, color: colors.textMuted }}>Destinazione:</label>
        {['auto', 'privato', 'azienda'].map(d => (
          <button key={d} onClick={() => setDestinazione(d)} style={{
            fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 8,
            border: 'none', cursor: 'pointer',
            background: destinazione === d ? colors.primary : colors.bg,
            color: destinazione === d ? '#fff' : colors.textMuted,
          }}>{d === 'auto' ? '🔍 Auto' : d === 'privato' ? '👤 Privato' : '🏢 Azienda'}</button>
        ))}
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); gestisciFile([...e.dataTransfer.files]) }}
        style={{
          border: `2px dashed ${dragging ? colors.primary : colors.border}`,
          borderRadius: 12, padding: '20px', textAlign: 'center',
          background: dragging ? colors.primaryBg : colors.bg,
          cursor: 'pointer', transition: 'all .2s',
        }}
        onClick={() => document.getElementById('tari-upload').click()}
      >
        <Upload size={20} color={dragging ? colors.primary : colors.textMuted} style={{ margin: '0 auto 6px' }} />
        <div style={{ fontSize: 13, color: colors.textMuted }}>
          {loading ? 'Elaborazione...' : 'Trascina PDF avviso TARI/IMU o clicca'}
        </div>
        <input id="tari-upload" type="file" accept=".pdf" multiple hidden
               onChange={e => gestisciFile([...e.target.files])} />
      </div>

      {risultato?.risultati?.map((r, i) => (
        <div key={i} style={{
          marginTop: 8, padding: '10px 14px', borderRadius: 8,
          background: r.ok ? colors.successBg : r.richiesta_conferma ? colors.warningBg : colors.dangerBg,
          fontSize: 12,
          color: r.ok ? colors.successText : r.richiesta_conferma ? colors.warningText : colors.dangerText,
        }}>
          {r.ok ? (
            <>✅ <strong>{r.intestatario}</strong> — {r.tipo_tributo} {r.anno} — {formatEuro(r.totale_acconto)} — {r.note || r.nota}</>
          ) : r.richiesta_conferma ? (
            <>⚠️ CF {r.cf} non riconosciuto — usa "Privato" o "Azienda" e ricarica</>
          ) : (
            <>❌ {r.errore}</>
          )}
        </div>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   COMPONENTE PRINCIPALE
   ═══════════════════════════════════════════════════ */
export default function TributiPrivati() {
  const [sezione, setSezione] = useState('scadenze')
  const [scadenze, setScadenze] = useState([])
  const [docsPrivati, setDocsPrivati] = useState([])
  const [docsAzienda, setDocsAzienda] = useState([])
  const [loading, setLoading] = useState(true)
  const [modaleRata, setModaleRata] = useState(null)

  const carica = async () => {
    setLoading(true)
    try {
      const [sc, priv, az] = await Promise.all([
        fetch(`${API}/scadenze`).then(r => r.json()),
        fetch(`${API}/privati`).then(r => r.json()),
        fetch(`${API}/azienda`).then(r => r.json()),
      ])
      setScadenze(Array.isArray(sc) ? sc : [])
      setDocsPrivati(Array.isArray(priv) ? priv : [])
      setDocsAzienda(Array.isArray(az) ? az : [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { carica() }, [])

  const handlePaga = (docId, numeroRata, rata, doc, privato) => {
    setModaleRata({ docId, numeroRata, rata, doc, privato })
  }

  const confermaPageamento = async () => {
    if (!modaleRata) return
    await fetch(`${API}/${modaleRata.docId}/paga-rata?rata_numero=${modaleRata.numeroRata}`, { method: 'POST' })
    setModaleRata(null)
    carica()
  }

  const oggi = new Date().toISOString().split('T')[0]
  const scadInRitardo = scadenze.filter(s => s.in_ritardo)
  const scadProssime = scadenze.filter(s => !s.in_ritardo && s.importo)

  return (
    <div style={s.page}>
      <div style={s.container}>

        {/* Header */}
        <div style={{ ...s.flexBetween, marginBottom: 24 }}>
          <div style={{ ...s.flex, gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12,
              background: colors.primaryBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Home size={22} color={colors.primary} />
            </div>
            <div>
              <h1 style={s.h1}>Tributi Locali</h1>
              <div style={{ fontSize: 12, color: colors.textLight }}>
                TARI · IMU · Tributi comunali — azienda e privati
              </div>
            </div>
          </div>
          <button onClick={carica} style={{ ...s.btn, ...s.btnNeutral, ...s.btnSmall }}>
            <RefreshCw size={14} /> Aggiorna
          </button>
        </div>

        {/* KPI scadenze */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          <div style={{ ...s.metricCard, borderLeft: `3px solid ${scadInRitardo.length > 0 ? colors.danger : colors.success}` }}>
            <div style={s.label}>In ritardo</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: scadInRitardo.length > 0 ? colors.danger : colors.success }}>
              {scadInRitardo.length}
            </div>
          </div>
          <div style={{ ...s.metricCard, borderLeft: `3px solid ${colors.warning}` }}>
            <div style={s.label}>Da pagare</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: colors.warning }}>{scadProssime.length}</div>
          </div>
          <div style={{ ...s.metricCard, borderLeft: `3px solid ${colors.primary}` }}>
            <div style={s.label}>Totale dovuto</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: colors.primary }}>
              {formatEuro(scadenze.filter(s => s.importo).reduce((a, s) => a + (s.importo || 0), 0))}
            </div>
          </div>
        </div>

        {/* Tab */}
        <div style={{ ...s.flex, gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { id: 'scadenze', label: `📅 Scadenze (${scadenze.length})` },
            { id: 'upload', label: '📤 Importa PDF' },
            { id: 'privati', label: `👤 Privati (${docsPrivati.length})` },
            { id: 'azienda', label: `🏢 Azienda (${docsAzienda.length})` },
          ].map(t => (
            <button key={t.id} onClick={() => setSezione(t.id)} style={{
              fontFamily: font, fontSize: 12, fontWeight: 600,
              padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: sezione === t.id
                ? `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryLight} 100%)`
                : colors.bg,
              color: sezione === t.id ? '#fff' : colors.textMuted,
              boxShadow: sezione === t.id ? shadow.btn : 'none',
            }}>{t.label}</button>
          ))}
        </div>

        {loading && <div style={{ textAlign: 'center', color: colors.textLight, padding: 40 }}>Caricamento...</div>}

        {/* ── Scadenze ── */}
        {!loading && sezione === 'scadenze' && (
          <div>
            {scadInRitardo.length > 0 && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: colors.dangerBg,
                marginBottom: 14, fontSize: 13, color: colors.dangerText, fontWeight: 600 }}>
                🔴 {scadInRitardo.length} rata{scadInRitardo.length > 1 ? 'e' : ''} in ritardo
              </div>
            )}
            <div style={s.cardNoPad}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Chi</th>
                    <th style={s.th}>Tributo</th>
                    <th style={s.th}>Anno</th>
                    <th style={s.th}>Rata</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Importo</th>
                    <th style={s.th}>Scadenza</th>
                    <th style={s.th}>Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {scadenze.map((sc, i) => (
                    <tr key={i} style={{
                      background: sc.in_ritardo ? colors.dangerBg + '30' :
                                  sc.privato ? colors.primaryBg + '20' : 'transparent'
                    }}>
                      <td style={s.td}>
                        <div style={{ fontSize: 12 }}>{sc.intestatario}</div>
                        {sc.privato && (
                          <span style={{ ...s.badge(colors.primary, colors.primaryBg), fontSize: 9 }}>privato</span>
                        )}
                      </td>
                      <td style={{ ...s.td, fontSize: 12 }}>{sc.tipo_tributo}</td>
                      <td style={s.td}>{sc.anno}</td>
                      <td style={s.td}>{sc.rata}</td>
                      <td style={{ ...s.td, textAlign: 'right', fontWeight: 700 }}>
                        {sc.importo ? formatEuro(sc.importo) : <span style={{ color: colors.textLight }}>TBD</span>}
                      </td>
                      <td style={s.td}>{sc.scadenza || '—'}</td>
                      <td style={s.td}>
                        {sc.importo
                          ? <StatoRata stato="da_pagare" inRitardo={sc.in_ritardo} />
                          : <span style={{ fontSize: 10, color: colors.textLight }}>In attesa avviso saldo</span>
                        }
                      </td>
                    </tr>
                  ))}
                  {scadenze.length === 0 && (
                    <tr><td colSpan={7} style={{ ...s.td, textAlign: 'center', color: colors.textLight }}>
                      Nessun avviso registrato
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Upload ── */}
        {sezione === 'upload' && (
          <div>
            <div style={{ fontSize: 13, color: colors.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
              Importa avvisi di pagamento TARI, IMU o altri tributi comunali in formato PDF.
              Il sistema rileva automaticamente se il documento è intestato all'azienda o a un privato.
            </div>
            <UploadZone onUpload={carica} />
          </div>
        )}

        {/* ── Privati ── */}
        {!loading && sezione === 'privati' && (
          <div>
            {docsPrivati.length === 0 ? (
              <div style={{ ...s.card, textAlign: 'center', color: colors.textLight }}>
                Nessun tributo privato registrato
              </div>
            ) : docsPrivati.map(doc => (
              <AvvisoCard key={doc._id} doc={doc} privato={true} onPaga={handlePaga} />
            ))}
          </div>
        )}

        {/* ── Azienda ── */}
        {!loading && sezione === 'azienda' && (
          <div>
            {docsAzienda.length === 0 ? (
              <div style={{ ...s.card, textAlign: 'center', color: colors.textLight }}>
                Nessun tributo aziendale registrato
              </div>
            ) : docsAzienda.map(doc => (
              <AvvisoCard key={doc._id} doc={doc} privato={false} onPaga={handlePaga} />
            ))}
          </div>
        )}

      </div>

      {/* Modale pagamento */}
      {modaleRata && (
        <ModalePagamento
          rata={modaleRata.rata}
          doc={modaleRata.doc}
          privato={modaleRata.privato}
          onClose={() => setModaleRata(null)}
          onConferma={confermaPageamento}
        />
      )}
    </div>
  )
}
