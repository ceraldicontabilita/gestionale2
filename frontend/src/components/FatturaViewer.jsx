import React, { useState, useEffect, useRef } from 'react'
import { ArrowLeft, ExternalLink, AlertCircle, FileText, Loader } from 'lucide-react'
import { s, colors, shadow, formatEuro } from '../lib/utils'

/**
 * FatturaViewer — visualizza fattura elettronica XML con foglio stile XSL AssoSoftware.
 * 
 * Strategia:
 *  1. Carica l'XML raw dalla API (/api/fatture/{id}/xml-raw)
 *  2. Carica il foglio XSL (/FoglioStileAssoSoftware.xsl)
 *  3. Trasforma con XSLTProcessor nativo del browser
 *  4. Mostra l'HTML risultante in un div sandbox
 *  5. Fallback: dati strutturati dal DB se XML non disponibile
 */
export default function FatturaViewer({ fatturaId, onClose, fatturaData }) {
  const [stato, setStato] = useState('loading') // loading | xsl | fallback | error
  const [errore, setErrore] = useState(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!fatturaId) return
    setStato('loading')
    setErrore(null)

    const caricaEVisualizza = async () => {
      try {
        // 1) Carica XML raw dalla API
        const xmlRes = await fetch(`/api/fatture/${fatturaId}/xml-raw`)
        
        if (!xmlRes.ok) {
          // XML non disponibile — usa fallback con dati DB
          setStato('fallback')
          return
        }

        const xmlText = await xmlRes.text()

        // 2) Carica foglio XSL (è in /public, servito da Vite come asset statico)
        const xslRes = await fetch('/FoglioStileAssoSoftware.xsl')
        if (!xslRes.ok) throw new Error('Foglio XSL non trovato')
        const xslText = await xslRes.text()

        // 3) Trasforma XML → HTML con XSLTProcessor nativo
        const parser = new DOMParser()
        const xmlDoc = parser.parseFromString(xmlText, 'application/xml')
        const xslDoc = parser.parseFromString(xslText, 'application/xml')

        // Controlla errori di parsing
        const xmlErr = xmlDoc.querySelector('parsererror')
        const xslErr = xslDoc.querySelector('parsererror')
        if (xmlErr) throw new Error('XML malformato: ' + xmlErr.textContent.slice(0, 100))
        if (xslErr) throw new Error('XSL malformato')

        const xsltProcessor = new XSLTProcessor()
        xsltProcessor.importStylesheet(xslDoc)
        const resultDoc = xsltProcessor.transformToDocument(xmlDoc)

        // 4) Serializza e inserisci nel container
        const serializer = new XMLSerializer()
        const htmlStr = serializer.serializeToString(resultDoc)

        if (containerRef.current) {
          // Usiamo srcdoc su iframe per isolamento completo
          const iframe = containerRef.current.querySelector('iframe')
          if (iframe) {
            iframe.srcdoc = htmlStr
          }
        }

        setStato('xsl')
      } catch (err) {
        console.error('Errore viewer fattura:', err)
        // Fallback se XSLTProcessor non supportato o errore
        setStato('fallback')
        setErrore(err.message)
      }
    }

    caricaEVisualizza()
  }, [fatturaId])

  /* ── Fallback: dati strutturati dal DB ───────────────────── */
  const FallbackView = () => {
    if (!fatturaData) return (
      <div style={{ padding: 40, textAlign: 'center', color: colors.textLight }}>
        Nessun dato disponibile
      </div>
    )
    const f = fatturaData
    const linee = f.linee || []
    const iva = f.riepilogo_iva || []
    const pag = f.pagamenti || []

    return (
      <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: colors.text, fontSize: 14 }}>
        
        {/* Intestazione */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          {/* Cedente */}
          <div style={{ padding: 20, borderRadius: 12, background: colors.primaryBg, border: `1px solid ${colors.primary}20` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: colors.primary, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 8 }}>
              Fornitore (Cedente)
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: colors.text, marginBottom: 4 }}>{f.fornitore_denominazione}</div>
            <div style={{ fontSize: 13, color: colors.textMuted }}>P.IVA: {f.fornitore_piva}</div>
          </div>
          {/* Cessionario */}
          <div style={{ padding: 20, borderRadius: 12, background: colors.bg, border: `1px solid ${colors.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 8 }}>
              Acquirente (Cessionario)
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: colors.text, marginBottom: 4 }}>CERALDI GROUP S.R.L.</div>
            <div style={{ fontSize: 13, color: colors.textMuted }}>P.IVA: 04523831214</div>
          </div>
        </div>

        {/* Dati fattura */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            ['Tipo', f.tipo_documento || 'TD01'],
            ['Numero', f.numero],
            ['Data', f.data],
            ['Totale', formatEuro(f.importo_totale)],
          ].map(([label, val]) => (
            <div key={label} style={{ padding: '12px 16px', borderRadius: 10, background: colors.card, border: `1px solid ${colors.border}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: colors.textLight, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: colors.text }}>{val || '—'}</div>
            </div>
          ))}
        </div>

        {/* Linee dettaglio */}
        {linee.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10 }}>
              Dettaglio voci
            </div>
            <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${colors.border}` }}>
              <table style={{ ...s.table }}>
                <thead>
                  <tr>
                    <th style={{ ...s.th, width: 40 }}>#</th>
                    <th style={s.th}>Descrizione</th>
                    <th style={{ ...s.th, width: 70, textAlign: 'right' }}>Q.tà</th>
                    <th style={{ ...s.th, width: 80 }}>U.M.</th>
                    <th style={{ ...s.th, width: 110, textAlign: 'right' }}>Prezzo unit.</th>
                    <th style={{ ...s.th, width: 60, textAlign: 'right' }}>IVA%</th>
                    <th style={{ ...s.th, width: 110, textAlign: 'right' }}>Importo</th>
                  </tr>
                </thead>
                <tbody>
                  {linee.map((l, i) => (
                    <tr key={i} onMouseEnter={e => e.currentTarget.style.background=colors.bg}
                        onMouseLeave={e => e.currentTarget.style.background=''}>
                      <td style={{ ...s.td, color: colors.textLight, fontSize: 12 }}>{l.numero || i+1}</td>
                      <td style={s.td}>{l.descrizione}</td>
                      <td style={{ ...s.td, textAlign: 'right' }}>{l.quantita}</td>
                      <td style={{ ...s.td, color: colors.textMuted }}>{l.unita_misura}</td>
                      <td style={{ ...s.td, textAlign: 'right', fontFamily: 'monospace' }}>{formatEuro(l.prezzo_unitario)}</td>
                      <td style={{ ...s.td, textAlign: 'right' }}>{l.aliquota_iva}%</td>
                      <td style={{ ...s.td, textAlign: 'right', fontWeight: 700 }}>{formatEuro(l.prezzo_totale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Riepilogo IVA + Totali */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, marginBottom: 20 }}>
          {/* Riepilogo IVA */}
          {iva.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10 }}>
                Riepilogo IVA
              </div>
              <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${colors.border}` }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Aliquota</th>
                      <th style={{ ...s.th, textAlign: 'right' }}>Imponibile</th>
                      <th style={{ ...s.th, textAlign: 'right' }}>Imposta</th>
                      <th style={s.th}>Natura</th>
                    </tr>
                  </thead>
                  <tbody>
                    {iva.map((r, i) => (
                      <tr key={i}>
                        <td style={s.td}>{r.aliquota}%</td>
                        <td style={{ ...s.td, textAlign: 'right' }}>{formatEuro(r.imponibile)}</td>
                        <td style={{ ...s.td, textAlign: 'right' }}>{formatEuro(r.imposta)}</td>
                        <td style={{ ...s.td, color: colors.textMuted }}>{r.natura || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Box totali */}
          <div style={{ padding: 20, borderRadius: 12, background: colors.primaryBg, border: `1px solid ${colors.primary}30`, alignSelf: 'end' }}>
            {[
              ['Imponibile', f.imponibile],
              ['IVA', f.iva],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 14 }}>
                <span style={{ color: colors.textMuted }}>{label}</span>
                <span style={{ fontWeight: 600 }}>{formatEuro(val)}</span>
              </div>
            ))}
            <div style={{ borderTop: `2px solid ${colors.primary}30`, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 18 }}>
              <span style={{ fontWeight: 700, color: colors.primaryText }}>TOTALE</span>
              <span style={{ fontWeight: 800, color: colors.primary }}>{formatEuro(f.importo_totale)}</span>
            </div>
          </div>
        </div>

        {/* Dati pagamento */}
        {pag.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10 }}>
              Pagamento
            </div>
            <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${colors.border}` }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Modalità</th>
                    <th style={s.th}>Scadenza</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Importo</th>
                    <th style={s.th}>IBAN</th>
                  </tr>
                </thead>
                <tbody>
                  {pag.map((p, i) => (
                    <tr key={i}>
                      <td style={s.td}>{p.modalita}</td>
                      <td style={{ ...s.td, color: colors.textMuted }}>{p.data_scadenza || '—'}</td>
                      <td style={{ ...s.td, textAlign: 'right', fontWeight: 700 }}>{formatEuro(p.importo)}</td>
                      <td style={{ ...s.td, fontFamily: 'monospace', fontSize: 12, color: colors.textMuted }}>{p.iban || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {errore && (
          <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 8, background: colors.warningBg, border: `1px solid ${colors.warning}30`, fontSize: 12, color: colors.warningText }}>
            Nota: XML originale non disponibile ({errore}). Visualizzazione dai dati importati.
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(15,10,40,0.55)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '24px 16px', overflowY: 'auto',
    }}>
      <div style={{
        width: '100%', maxWidth: 1000,
        background: colors.card, borderRadius: 20,
        boxShadow: shadow.lg, overflow: 'hidden',
        minHeight: 400,
      }}>
        {/* Header modale */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px',
          borderBottom: `1px solid ${colors.border}`,
          background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryLight} 100%)`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <FileText size={20} color="rgba(255,255,255,0.9)" />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
                Fattura {fatturaData?.numero || ''}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                {fatturaData?.fornitore_denominazione || ''} · {fatturaData?.data || ''}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {stato === 'xsl' && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                background: 'rgba(255,255,255,0.2)', color: '#fff',
              }}>
                XML · Foglio AssoSoftware
              </span>
            )}
            <button onClick={onClose} style={{
              fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
              padding: '7px 16px', borderRadius: 10,
              background: 'rgba(255,255,255,0.2)', color: '#fff',
              border: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <ArrowLeft size={14} /> Chiudi
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 24 }} ref={containerRef}>
          {stato === 'loading' && (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <Loader size={32} color={colors.primary} style={{ animation: 'spin 1s linear infinite' }} />
              </div>
              <div style={{ color: colors.textMuted, fontSize: 14 }}>Caricamento fattura XML...</div>
            </div>
          )}

          {stato === 'xsl' && (
            /* iframe con il documento HTML trasformato dall'XSL */
            <iframe
              title="Fattura Elettronica"
              style={{
                width: '100%', border: 'none',
                minHeight: 700, borderRadius: 8,
              }}
              onLoad={e => {
                // Auto-resize iframe all'altezza del contenuto
                try {
                  const h = e.target.contentDocument?.body?.scrollHeight
                  if (h) e.target.style.height = h + 40 + 'px'
                } catch {}
              }}
            />
          )}

          {stato === 'fallback' && <FallbackView />}

          {stato === 'error' && (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <AlertCircle size={32} color={colors.danger} style={{ marginBottom: 12 }} />
              <div style={{ color: colors.dangerText, fontSize: 14 }}>{errore}</div>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
