/**
 * FatturaViewer — Modale visualizzazione fattura FatturaPA
 * Strategia: XSLTProcessor nativo browser
 *   1. Fetch XML raw da /api/fatture/{id}/xml-raw
 *   2. Fetch XSL da /FoglioStileAssoSoftware.xsl (public asset)
 *   3. XSLTProcessor.transformToDocument() → HTML
 *   4. Serialize → iframe srcdoc
 *   5. Fallback: dati strutturati dal DB via /api/fatture/{id}
 *
 * Usa solo token da frontend/src/lib/utils.js — nessun colore hardcoded
 */
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { X, FileText, AlertCircle, Loader, Download, ExternalLink } from 'lucide-react'
import { s, colors, shadow } from '../lib/utils'

const API = '/api'

export default function FatturaViewer({ fatturaId, fatturaData, onClose }) {
  const [status, setStatus]     = useState('idle')  // idle | loading | xsl | done | fallback | error
  const [errorMsg, setErrorMsg] = useState('')
  const [fattura, setFattura]   = useState(fatturaData || null)
  const iframeRef = useRef()
  const overlayRef = useRef()

  /* ── Chiudi con ESC ─────────────────────────────────────── */
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  /* ── Blocca scroll body ─────────────────────────────────── */
  useEffect(() => {
    if (fatturaId) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [fatturaId])

  /* ── Carica e trasforma XML ─────────────────────────────── */
  const loadXml = useCallback(async () => {
    if (!fatturaId) return
    setStatus('loading')
    setErrorMsg('')

    try {
      /* 1. Fetch XML raw */
      const xmlRes = await fetch(`${API}/fatture/${fatturaId}/xml-raw`)
      if (!xmlRes.ok) throw new Error(`XML non disponibile (${xmlRes.status})`)
      const xmlText = await xmlRes.text()

      setStatus('xsl')

      /* 2. Fetch foglio stile AssoSoftware */
      const xslRes = await fetch('/FoglioStileAssoSoftware.xsl')
      if (!xslRes.ok) throw new Error('Foglio stile non trovato')
      const xslText = await xslRes.text()

      /* 3. Parsa entrambi */
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(xmlText, 'application/xml')
      const xslDoc = parser.parseFromString(xslText, 'application/xml')

      // Controlla errori di parsing
      const xmlErr = xmlDoc.querySelector('parsererror')
      const xslErr = xslDoc.querySelector('parsererror')
      if (xmlErr) throw new Error('XML fattura non valido: ' + xmlErr.textContent.slice(0, 100))
      if (xslErr) throw new Error('XSL non valido')

      /* 4. Trasformazione XSLT */
      if (!window.XSLTProcessor) throw new Error('Browser non supporta XSLTProcessor')

      const proc = new XSLTProcessor()
      proc.importStylesheet(xslDoc)
      const htmlDoc = proc.transformToDocument(xmlDoc)

      /* 5. Serialize → srcdoc iframe */
      const serial = new XMLSerializer()
      let htmlStr = serial.serializeToString(htmlDoc)

      // Aggiungi charset e base styles se mancano
      if (!htmlStr.includes('<meta charset')) {
        htmlStr = htmlStr.replace('<head>', '<head><meta charset="UTF-8">')
      }
      // Aggiungi font Plus Jakarta Sans per coerenza
      if (!htmlStr.includes('googleapis')) {
        htmlStr = htmlStr.replace('</head>',
          `<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
           <style>
             body { font-family: 'Plus Jakarta Sans', Arial, sans-serif !important; }
             table { border-collapse: collapse; }
           </style>
           </head>`)
      }

      if (iframeRef.current) {
        iframeRef.current.srcdoc = htmlStr
      }
      setStatus('done')

    } catch (err) {
      console.warn('XSLT viewer error:', err.message)
      setErrorMsg(err.message)
      // Prova fallback dati strutturati
      await loadFallback()
    }
  }, [fatturaId])

  const loadFallback = async () => {
    setStatus('fallback')
    try {
      const res = await fetch(`${API}/fatture/${fatturaId}`)
      if (res.ok) {
        const data = await res.json()
        setFattura(data)
      }
    } catch (e) {
      setStatus('error')
    }
  }

  useEffect(() => {
    if (fatturaId) loadXml()
  }, [fatturaId, loadXml])

  if (!fatturaId) return null

  /* ── Info fattura per header modale ─────────────────────── */
  const info = fattura || fatturaData || {}
  const titolo = info.fornitore_denominazione
    ? `${info.fornitore_denominazione} — ${info.numero || ''} del ${info.data || ''}`
    : `Fattura ${fatturaId.slice(-6)}`

  return (
    <>
      {/* Overlay */}
      <div
        ref={overlayRef}
        onClick={e => { if (e.target === overlayRef.current) onClose() }}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(30, 27, 75, 0.55)',
          backdropFilter: 'blur(3px)',
          zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
          animation: 'fadeIn .15s ease',
        }}
      >
        {/* Modale */}
        <div style={{
          width: '100%', maxWidth: 960,
          height: '90vh',
          background: colors.card,
          borderRadius: 20,
          boxShadow: '0 24px 80px rgba(30,27,75,0.25), 0 8px 24px rgba(0,0,0,0.10)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideUp .18s ease',
        }}>

          {/* ── Header ───────────────────────────────────── */}
          <div style={{
            ...s.flexBetween,
            padding: '16px 20px',
            borderBottom: `1px solid ${colors.border}`,
            background: colors.card,
            flexShrink: 0,
          }}>
            <div style={{ ...s.flex, gap: 10, minWidth: 0 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: colors.primaryBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <FileText size={18} color={colors.primary} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: colors.text,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  maxWidth: 700 }}>
                  {titolo}
                </div>
                <div style={{ fontSize: 11, color: colors.textLight, marginTop: 1 }}>
                  {status === 'loading' && 'Caricamento XML...'}
                  {status === 'xsl' && 'Applicazione foglio stile AssoSoftware...'}
                  {status === 'done' && 'Foglio stile AssoSoftware · FatturaPA'}
                  {status === 'fallback' && 'Vista semplificata (XML non disponibile)'}
                  {status === 'error' && 'Errore caricamento'}
                </div>
              </div>
            </div>
            <div style={{ ...s.flex, gap: 8, flexShrink: 0 }}>
              {/* Scarica XML raw */}
              {status === 'done' && (
                <a
                  href={`${API}/fatture/${fatturaId}/xml-raw`}
                  download={`fattura_${fatturaId.slice(-6)}.xml`}
                  style={{ ...s.btn, ...s.btnOutline, ...s.btnSmall, textDecoration: 'none' }}
                >
                  <Download size={13} />
                  XML
                </a>
              )}
              <button onClick={onClose} style={{
                width: 32, height: 32, borderRadius: 8,
                border: 'none', background: colors.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: colors.textMuted,
                transition: 'all .12s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = colors.dangerBg; e.currentTarget.style.color = colors.danger }}
                onMouseLeave={e => { e.currentTarget.style.background = colors.bg; e.currentTarget.style.color = colors.textMuted }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* ── Corpo ────────────────────────────────────── */}
          <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>

            {/* Loading */}
            {(status === 'loading' || status === 'xsl') && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 16, background: colors.card, zIndex: 2,
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: colors.primaryBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: 'pulse 1.2s ease infinite',
                }}>
                  <Loader size={22} color={colors.primary} style={{ animation: 'spin 1s linear infinite' }} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: colors.text, marginBottom: 4 }}>
                    {status === 'loading' ? 'Caricamento XML...' : 'Trasformazione XSLT...'}
                  </div>
                  <div style={{ fontSize: 12, color: colors.textLight }}>
                    Foglio stile AssoSoftware
                  </div>
                </div>
              </div>
            )}

            {/* Errore + banner */}
            {errorMsg && status !== 'fallback' && (
              <div style={{
                padding: '10px 20px', background: colors.warningBg,
                borderBottom: `1px solid ${colors.warning}30`,
                fontSize: 12, color: colors.warningText,
                display: 'flex', alignItems: 'center', gap: 8,
                flexShrink: 0,
              }}>
                <AlertCircle size={13} />
                {errorMsg} — visualizzazione semplificata
              </div>
            )}

            {/* iframe XSLT — visibile solo quando done */}
            <iframe
              ref={iframeRef}
              title="Fattura FatturaPA"
              style={{
                width: '100%', height: '100%',
                border: 'none',
                display: status === 'done' ? 'block' : 'none',
              }}
              sandbox="allow-same-origin"
            />

            {/* Fallback: dati strutturati dal DB */}
            {status === 'fallback' && fattura && (
              <FallbackView fattura={fattura} />
            )}

            {/* Errore definitivo */}
            {status === 'error' && (
              <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                height: '100%', gap: 12, color: colors.textMuted,
              }}>
                <AlertCircle size={40} color={colors.border} />
                <div style={{ fontSize: 15, fontWeight: 600, color: colors.textMuted }}>
                  Impossibile visualizzare la fattura
                </div>
                <div style={{ fontSize: 13, color: colors.textLight }}>
                  {errorMsg || 'XML non disponibile nel sistema'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.6 } }
      `}</style>
    </>
  )
}

/* ── Vista fallback dati strutturati MongoDB ────────────────── */
function FallbackView({ fattura: f }) {
  const fmt = n => n != null ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n) : '—'
  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 24 }}>
      {/* Testata */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div style={s.card}>
          <div style={s.h3}>Fornitore (Cedente)</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: colors.text, marginBottom: 4 }}>
            {f.fornitore_denominazione || '—'}
          </div>
          <div style={{ fontSize: 13, color: colors.textMuted, fontFamily: 'monospace' }}>
            P.IVA {f.fornitore_piva || '—'}
          </div>
        </div>
        <div style={s.card}>
          <div style={s.h3}>Documento</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              ['Numero', f.numero],
              ['Data', f.data],
              ['Tipo', f.tipo_documento],
              ['Stato', f.stato],
            ].map(([k, v]) => (
              <div key={k}>
                <div style={{ ...s.label, marginBottom: 2 }}>{k}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>{v || '—'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Linee */}
      {f.linee?.length > 0 && (
        <div style={{ ...s.cardNoPad, marginBottom: 16 }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${colors.border}` }}>
            <div style={s.h3}>Dettaglio linee</div>
          </div>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>#</th>
                <th style={s.th}>Descrizione</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Qtà</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Prezzo</th>
                <th style={{ ...s.th, textAlign: 'right' }}>IVA %</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Totale</th>
              </tr>
            </thead>
            <tbody>
              {f.linee.map((l, i) => (
                <tr key={i}
                  onMouseEnter={e => e.currentTarget.style.background = colors.bg}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={{ ...s.td, color: colors.textLight }}>{l.numero || i + 1}</td>
                  <td style={s.td}>{l.descrizione || '—'}</td>
                  <td style={{ ...s.td, textAlign: 'right', fontFamily: 'monospace' }}>{l.quantita ?? '—'}</td>
                  <td style={{ ...s.td, textAlign: 'right', fontFamily: 'monospace' }}>{fmt(l.prezzo_unitario)}</td>
                  <td style={{ ...s.td, textAlign: 'right', fontFamily: 'monospace' }}>{l.aliquota_iva != null ? `${l.aliquota_iva}%` : l.natura || '—'}</td>
                  <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{fmt(l.prezzo_totale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Riepilogo IVA + Totali */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'start' }}>
        {f.riepilogo_iva?.length > 0 && (
          <div style={s.cardNoPad}>
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${colors.border}` }}>
              <div style={s.h3}>Riepilogo IVA</div>
            </div>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Aliquota</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Imponibile</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Imposta</th>
                </tr>
              </thead>
              <tbody>
                {f.riepilogo_iva.map((r, i) => (
                  <tr key={i}>
                    <td style={s.td}>{r.aliquota_iva != null ? `${r.aliquota_iva}%` : r.natura || '—'}</td>
                    <td style={{ ...s.td, textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.imponibile)}</td>
                    <td style={{ ...s.td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(r.imposta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Box totali */}
        <div style={{ ...s.card, minWidth: 240 }}>
          <div style={s.h3}>Totali</div>
          {[
            ['Imponibile', f.imponibile],
            ['IVA', f.iva],
          ].map(([k, v]) => (
            <div key={k} style={{ ...s.flexBetween, marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: colors.textMuted }}>{k}</span>
              <span style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 600, color: colors.text }}>{fmt(v)}</span>
            </div>
          ))}
          <div style={{ borderTop: `2px solid ${colors.border}`, paddingTop: 10, ...s.flexBetween }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: colors.text }}>Totale</span>
            <span style={{
              fontSize: 18, fontWeight: 800, fontFamily: 'monospace',
              color: colors.primary,
            }}>{fmt(f.importo_totale)}</span>
          </div>
        </div>
      </div>

      {/* Causale */}
      {f.causale && (
        <div style={{ ...s.card, marginTop: 0, background: colors.bg }}>
          <div style={s.h3}>Causale</div>
          <div style={{ fontSize: 13, color: colors.textMuted }}>{f.causale}</div>
        </div>
      )}
    </div>
  )
}
