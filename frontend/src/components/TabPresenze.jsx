import React, { useState, useEffect } from 'react'
import {
  Calendar, Clock, TrendingUp, AlertCircle, Upload,
  ChevronLeft, ChevronRight, Sun, Coffee, Activity
} from 'lucide-react'
import { s, colors, shadow, formatOre, giustBadge } from '../lib/utils'

const API = '/api'

/* ── Palette colori cella calendario ───────────────────────── */
function cellStyle(giorno, selected) {
  const base = {
    width: 36, height: 36, borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
    transition: 'all .12s', position: 'relative', flexDirection: 'column',
    gap: 2, userSelect: 'none',
  }
  if (!giorno) return { ...base, cursor: 'default' }
  if (selected) return { ...base, background: colors.primary, color: '#fff', boxShadow: shadow.btn }
  if (giorno.festivo && !giorno.giustificativi?.length && !giorno.ore_ordinarie) {
    return { ...base, color: colors.textLight, background: 'transparent' }
  }
  const codici = giorno.giustificativi?.map(g => g.codice) || []
  if (codici.includes('AI')) return { ...base, background: colors.dangerBg, color: colors.dangerText }
  if (codici.includes('MA')) return { ...base, background: colors.warningBg, color: colors.warningText }
  if (codici.includes('FE')) return { ...base, background: colors.infoBg, color: colors.infoText }
  if (codici.includes('PE')) return { ...base, background: colors.primaryBg, color: colors.primaryText }
  if (giorno.ore_ordinarie > 0) return { ...base, background: colors.successBg, color: colors.successText }
  return { ...base, background: colors.borderLight, color: colors.textLight }
}

/* ── Dot indicatore tipo giornata ───────────────────────────── */
function GiornoDot({ codice }) {
  const { color } = giustBadge(codice)
  return (
    <div style={{
      width: 5, height: 5, borderRadius: '50%',
      background: color, flexShrink: 0,
    }} />
  )
}

/* ── Metric card KPI ────────────────────────────────────────── */
function KpiCard({ icon: Icon, label, value, sub, color: c, bg }) {
  return (
    <div style={{ ...s.metricCard, display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{
        width: 48, height: 48, borderRadius: 14, flexShrink: 0,
        background: bg || colors.primaryBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={22} color={c || colors.primary} strokeWidth={2} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 3 }}>
          {label}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: colors.text, lineHeight: 1.1 }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: colors.textLight, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

/* ── Badge giustificativo ───────────────────────────────────── */
function GiustChip({ codice, ore }) {
  const { color, bg, label } = giustBadge(codice)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 12, fontWeight: 700, padding: '4px 10px',
      borderRadius: 20, color, background: bg,
    }}>
      {label}
      {ore > 0 && <span style={{ opacity: 0.75, fontWeight: 400 }}>{formatOre(ore)}</span>}
    </span>
  )
}

/* ── Barra riepilogo mese ───────────────────────────────────── */
function BarraMese({ totali, legenda }) {
  const totOrd = totali?.ore_ordinarie || 0
  const totAss = Object.entries(totali || {})
    .filter(([k]) => k !== 'ore_ordinarie')
    .reduce((acc, [, v]) => acc + v, 0)

  const MAX = Math.max(totOrd + totAss, 1)
  const segmenti = [
    { codice: 'ORD', ore: totOrd, color: colors.success, label: 'Ordinarie' },
    ...Object.entries(totali || {})
      .filter(([k]) => k !== 'ore_ordinarie')
      .map(([k, v]) => ({ codice: k, ore: v, ...giustBadge(k) }))
  ]

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', height: 8, borderRadius: 8, overflow: 'hidden', gap: 2, marginBottom: 10 }}>
        {segmenti.filter(s => s.ore > 0).map(seg => (
          <div key={seg.codice} style={{
            width: `${(seg.ore / MAX) * 100}%`,
            background: seg.color || colors.primary,
            borderRadius: 8, minWidth: 4,
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {segmenti.filter(s => s.ore > 0).map(seg => (
          <div key={seg.codice} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: seg.color || colors.primary, flexShrink: 0 }} />
            <span style={{ color: colors.textMuted }}>{seg.label || legenda?.[seg.codice] || seg.codice}</span>
            <span style={{ fontWeight: 700, color: colors.text }}>{formatOre(seg.ore)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPALE — TabPresenze
   ═══════════════════════════════════════════════════════════════ */
export default function TabPresenze({ codiceFiscale }) {
  const [anno, setAnno]           = useState(new Date().getFullYear())
  const [meseSelezionato, setMese]= useState(new Date().getMonth() + 1)
  const [riepilogo, setRiepilogo] = useState(null)
  const [dettaglio, setDettaglio] = useState(null)
  const [loadingRiep, setLoadingRiep] = useState(false)
  const [loadingDet, setLoadingDet]   = useState(false)
  const [giornoSel, setGiornoSel] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState(null)

  /* Carica riepilogo annuale */
  useEffect(() => {
    if (!codiceFiscale) return
    setLoadingRiep(true)
    fetch(`${API}/presenze/riepilogo/${codiceFiscale}?anno=${anno}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setRiepilogo(d))
      .catch(() => setRiepilogo(null))
      .finally(() => setLoadingRiep(false))
  }, [codiceFiscale, anno])

  /* Carica dettaglio mese selezionato */
  useEffect(() => {
    if (!codiceFiscale || !meseSelezionato) return
    setLoadingDet(true)
    setGiornoSel(null)
    fetch(`${API}/presenze/dettaglio/${codiceFiscale}/${anno}/${meseSelezionato}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setDettaglio(d))
      .catch(() => setDettaglio(null))
      .finally(() => setLoadingDet(false))
  }, [codiceFiscale, anno, meseSelezionato])

  /* Upload Aut.301 */
  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadMsg(null)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch(`${API}/presenze/upload-pdf`, { method: 'POST', body: fd })
      const data = await res.json()
      setUploadMsg({ ok: data.ok, text: data.ok
        ? `✓ ${data.periodo} importato — ${data.n_giorni} giorni`
        : data.detail || 'Errore upload'
      })
      if (data.ok) {
        // Ricarica
        setTimeout(() => {
          setAnno(a => a) // trigger re-fetch
          setMese(data.mese || meseSelezionato)
        }, 300)
      }
    } catch (err) {
      setUploadMsg({ ok: false, text: err.message })
    }
    setUploading(false)
    e.target.value = ''
  }

  /* KPI annuali */
  const kpi = riepilogo?.totale_annuale || {}
  const mesiPresenti = riepilogo?.mesi || []
  const MESI_LABEL = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']

  /* Calendario mese corrente */
  const CalendarioMese = () => {
    if (!dettaglio?.giorni) return null
    const giorni = dettaglio.giorni
    const totali = dettaglio.totali || {}
    const legenda = dettaglio.legenda || {}

    // Primo giorno del mese (0=dom,1=lun...)
    const primoGiorno = new Date(anno, meseSelezionato - 1, 1).getDay()
    const offset = primoGiorno === 0 ? 6 : primoGiorno - 1 // lunedì=0

    const giornoMap = {}
    giorni.forEach(g => { giornoMap[g.giorno] = g })
    const numGiorni = new Date(anno, meseSelezionato, 0).getDate()
    const celle = Array(offset).fill(null).concat(
      Array.from({ length: numGiorni }, (_, i) => giornoMap[i + 1] || {
        giorno: i + 1,
        ore_ordinarie: 0,
        giustificativi: [],
        giorno_settimana: ['LU','MA','ME','GI','VE','SA','DO'][(offset + i) % 7],
        festivo: (offset + i) % 7 >= 5,
      })
    )
    while (celle.length % 7 !== 0) celle.push(null)

    const giornoScelto = giornoSel ? giornoMap[giornoSel] : null

    return (
      <div>
        <BarraMese totali={totali} legenda={legenda} />

        {/* Intestazione giorni */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
          {['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map(g => (
            <div key={g} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700,
              color: colors.textLight, textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 0' }}>
              {g}
            </div>
          ))}
        </div>

        {/* Griglia giorni */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {celle.map((g, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'center' }}>
              {g ? (
                <div
                  style={cellStyle(g, giornoSel === g.giorno)}
                  onClick={() => setGiornoSel(giornoSel === g.giorno ? null : g.giorno)}
                >
                  <span>{g.giorno}</span>
                  {g.giustificativi?.length > 0 && !giornoSel === g.giorno && (
                    <div style={{ display: 'flex', gap: 2 }}>
                      {g.giustificativi.slice(0, 2).map((gj, ji) => (
                        <GiornoDot key={ji} codice={gj.codice} />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ width: 36, height: 36 }} />
              )}
            </div>
          ))}
        </div>

        {/* Dettaglio giorno selezionato */}
        {giornoScelto && (
          <div style={{
            marginTop: 16, padding: '14px 16px', borderRadius: 12,
            background: colors.primaryBg, border: `1px solid ${colors.primary}20`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: colors.primaryText }}>
                {giornoScelto.giorno_settimana} {giornoScelto.giorno} {MESI_LABEL[meseSelezionato - 1]}
              </span>
              {giornoScelto.festivo && (
                <span style={{ ...s.badge(colors.infoText, colors.infoBg) }}>Festivo</span>
              )}
            </div>
            {giornoScelto.ore_ordinarie > 0 && (
              <div style={{ fontSize: 13, color: colors.successText, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Activity size={13} />
                <span>{formatOre(giornoScelto.ore_ordinarie)} ordinarie</span>
              </div>
            )}
            {giornoScelto.giustificativi?.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {giornoScelto.giustificativi.map((gj, i) => (
                  <GiustChip key={i} codice={gj.codice} ore={gj.ore} />
                ))}
              </div>
            ) : giornoScelto.ore_ordinarie === 0 ? (
              <span style={{ fontSize: 12, color: colors.textLight }}>Nessuna attività registrata</span>
            ) : null}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* ── Header con anno e upload ──────────────────────── */}
      <div style={{ ...s.flexBetween, marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ ...s.flex, ...s.gap12 }}>
          <Calendar size={20} color={colors.primary} />
          <span style={{ fontSize: 16, fontWeight: 700, color: colors.text }}>Presenze</span>
          {/* Selettore anno */}
          <div style={{ ...s.flex, ...s.gap4, background: colors.bg, borderRadius: 10, padding: '4px 6px' }}>
            <button onClick={() => setAnno(a => a - 1)} style={{ ...s.btn, ...s.btnXSmall, ...s.btnNeutral, padding: '4px 8px' }}>
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontSize: 14, fontWeight: 700, color: colors.text, minWidth: 40, textAlign: 'center' }}>{anno}</span>
            <button onClick={() => setAnno(a => a + 1)} style={{ ...s.btn, ...s.btnXSmall, ...s.btnNeutral, padding: '4px 8px' }}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
        {/* Upload Aut.301 */}
        <label style={{ ...s.btn, ...s.btnGhost, ...s.btnSmall, cursor: 'pointer', opacity: uploading ? 0.6 : 1 }}>
          <Upload size={14} />
          {uploading ? 'Caricamento...' : 'Carica Aut.301'}
          <input type="file" accept=".pdf" onChange={handleUpload} style={{ display: 'none' }} disabled={uploading} />
        </label>
      </div>

      {/* Messaggio upload */}
      {uploadMsg && (
        <div style={{
          padding: '10px 16px', borderRadius: 10, marginBottom: 16,
          background: uploadMsg.ok ? colors.successBg : colors.dangerBg,
          color: uploadMsg.ok ? colors.successText : colors.dangerText,
          fontSize: 13, fontWeight: 600,
          border: `1px solid ${uploadMsg.ok ? colors.success : colors.danger}30`,
        }}>
          {uploadMsg.text}
        </div>
      )}

      {/* ── KPI annuali ───────────────────────────────────── */}
      {loadingRiep ? (
        <div style={{ padding: 32, textAlign: 'center', color: colors.textLight, fontSize: 13 }}>Caricamento riepilogo...</div>
      ) : mesiPresenti.length === 0 ? (
        <div style={{
          ...s.card, textAlign: 'center', padding: '40px 24px',
          color: colors.textLight,
        }}>
          <Calendar size={36} color={colors.border} style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: colors.textMuted, marginBottom: 6 }}>
            Nessuna presenza registrata per il {anno}
          </div>
          <div style={{ fontSize: 13, color: colors.textLight }}>
            Carica i fogli presenze Aut.301 per visualizzare i dati
          </div>
        </div>
      ) : (
        <>
          {/* KPI Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
            <KpiCard
              icon={Clock}
              label="Ore ordinarie"
              value={formatOre(kpi.ore_ordinarie || 0)}
              sub={`${mesiPresenti.length} mes${mesiPresenti.length === 1 ? 'e' : 'i'} registrati`}
              color={colors.success} bg={colors.successBg}
            />
            {kpi.AI > 0 && (
              <KpiCard icon={AlertCircle} label="Ass. ingiustificate"
                value={formatOre(kpi.AI)} color={colors.danger} bg={colors.dangerBg} />
            )}
            {kpi.FE > 0 && (
              <KpiCard icon={Sun} label="Ferie godute"
                value={formatOre(kpi.FE)} color={colors.info} bg={colors.infoBg} />
            )}
            {kpi.MA > 0 && (
              <KpiCard icon={Activity} label="Malattia"
                value={formatOre(kpi.MA)} color={colors.warning} bg={colors.warningBg} />
            )}
            {kpi.PE > 0 && (
              <KpiCard icon={Coffee} label="Permessi"
                value={formatOre(kpi.PE)} color={colors.primary} bg={colors.primaryBg} />
            )}
          </div>

          {/* ── Griglia mesi ────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8, marginBottom: 20 }}>
            {MESI_LABEL.map((m, i) => {
              const meseN = i + 1
              const datiMese = mesiPresenti.find(ms => ms.mese === meseN)
              const attivo = meseSelezionato === meseN
              const hasData = !!datiMese
              return (
                <button
                  key={meseN}
                  onClick={() => hasData && setMese(meseN)}
                  style={{
                    fontFamily: 'inherit',
                    padding: '10px 6px',
                    borderRadius: 12,
                    border: attivo ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
                    background: attivo ? colors.primary : (hasData ? colors.card : colors.bg),
                    color: attivo ? '#fff' : (hasData ? colors.text : colors.textLight),
                    cursor: hasData ? 'pointer' : 'default',
                    textAlign: 'center',
                    transition: 'all .12s',
                    boxShadow: attivo ? shadow.btn : (hasData ? shadow.xs : 'none'),
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: hasData ? 4 : 0 }}>{m}</div>
                  {hasData && (
                    <div style={{ fontSize: 10, opacity: 0.8, lineHeight: 1.3 }}>
                      {formatOre(datiMese.totali?.ore_ordinarie || 0)}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* ── Dettaglio mese ──────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>
            {/* Calendario */}
            <div style={s.card}>
              <div style={{ ...s.flexBetween, marginBottom: 16 }}>
                <h2 style={{ ...s.h2, margin: 0 }}>
                  {MESI_LABEL[meseSelezionato - 1]} {anno}
                </h2>
                {dettaglio?.cessato && (
                  <span style={{ ...s.badge(colors.dangerText, colors.dangerBg) }}>Cessato</span>
                )}
              </div>
              {loadingDet ? (
                <div style={{ padding: 24, textAlign: 'center', color: colors.textLight, fontSize: 13 }}>Caricamento...</div>
              ) : dettaglio ? (
                <CalendarioMese />
              ) : (
                <div style={{ padding: 24, textAlign: 'center', color: colors.textLight, fontSize: 13 }}>
                  Nessun foglio presenze per questo mese
                </div>
              )}
            </div>

            {/* Pannello laterale riepilogo mese + legenda */}
            <div>
              {dettaglio && (
                <>
                  {/* Totali mese */}
                  <div style={s.card}>
                    <h3 style={{ ...s.h3, marginBottom: 14 }}>Totali mese</h3>
                    {Object.entries(dettaglio.totali || {}).map(([cod, ore]) => {
                      const isOrd = cod === 'ore_ordinarie'
                      const { color: c, bg, label } = isOrd
                        ? { color: colors.successText, bg: colors.successBg, label: 'Ordinarie' }
                        : giustBadge(cod)
                      return (
                        <div key={cod} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 12px', borderRadius: 10, marginBottom: 6,
                          background: bg, border: `1px solid ${c}20`,
                        }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: c }}>
                            {isOrd ? '🕐 ' : ''}{label}
                          </span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: c }}>
                            {formatOre(ore)}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Legenda */}
                  {Object.keys(dettaglio.legenda || {}).length > 0 && (
                    <div style={{ ...s.card, padding: 16 }}>
                      <h3 style={{ ...s.h3, marginBottom: 10 }}>Legenda</h3>
                      {Object.entries(dettaglio.legenda).map(([cod, desc]) => {
                        const { color: c, bg } = giustBadge(cod)
                        return (
                          <div key={cod} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <div style={{ ...s.badge(c, bg), minWidth: 32, justifyContent: 'center' }}>{cod}</div>
                            <span style={{ fontSize: 12, color: colors.textMuted }}>{desc}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Storico mesi (mini-table) */}
                  <div style={s.cardNoPad}>
                    <div style={{ padding: '14px 16px', borderBottom: `1px solid ${colors.border}` }}>
                      <h3 style={{ ...s.h3, margin: 0 }}>Storico {anno}</h3>
                    </div>
                    <table style={s.table}>
                      <thead>
                        <tr>
                          <th style={{ ...s.th, padding: '8px 12px' }}>Mese</th>
                          <th style={{ ...s.th, padding: '8px 12px', textAlign: 'right' }}>Ordinarie</th>
                          <th style={{ ...s.th, padding: '8px 12px', textAlign: 'right' }}>Assenze</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mesiPresenti.map(ms => {
                          const assenze = Object.entries(ms.totali || {})
                            .filter(([k]) => k !== 'ore_ordinarie')
                            .reduce((a, [, v]) => a + v, 0)
                          const isSelected = ms.mese === meseSelezionato
                          return (
                            <tr key={ms.mese}
                              onClick={() => setMese(ms.mese)}
                              style={{
                                ...s.trHover,
                                background: isSelected ? colors.primaryBg : 'transparent',
                              }}
                              onMouseEnter={e => !isSelected && (e.currentTarget.style.background = colors.bg)}
                              onMouseLeave={e => !isSelected && (e.currentTarget.style.background = 'transparent')}
                            >
                              <td style={{ ...s.td, padding: '8px 12px', fontWeight: isSelected ? 700 : 400,
                                color: isSelected ? colors.primary : colors.text }}>
                                {MESI_LABEL[ms.mese - 1]}
                              </td>
                              <td style={{ ...s.td, padding: '8px 12px', textAlign: 'right',
                                fontSize: 12, color: colors.successText, fontWeight: 600 }}>
                                {formatOre(ms.totali?.ore_ordinarie || 0)}
                              </td>
                              <td style={{ ...s.td, padding: '8px 12px', textAlign: 'right',
                                fontSize: 12, color: assenze > 0 ? colors.dangerText : colors.textLight, fontWeight: assenze > 0 ? 600 : 400 }}>
                                {assenze > 0 ? formatOre(assenze) : '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
