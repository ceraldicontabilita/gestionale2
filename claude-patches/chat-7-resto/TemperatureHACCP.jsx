import { useState, useEffect, useCallback, useRef } from 'react'
import { Thermometer, Snowflake, ChevronLeft, ChevronRight, RefreshCw, Pencil, Check, X, AlertTriangle } from 'lucide-react'
import { s, colors, font } from '../lib/utils'

const API = 'https://ceraldiapp.it/api'
const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
               'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

function giorniNelMese(m, a) { return new Date(a, m, 0).getDate() }

// ─── RINOMINA INLINE ─────────────────────────────────────────────────────────
function ColonnaHeader({ nome, onRinomina, colore }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(nome)
  const inputRef = useRef()

  useEffect(() => { setVal(nome) }, [nome])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  function conferma() {
    const trimmed = val.trim()
    if (trimmed && trimmed !== nome) onRinomina(trimmed)
    setEditing(false)
  }

  function annulla() { setVal(nome); setEditing(false) }

  if (editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 80 }}>
        <input
          ref={inputRef}
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') conferma(); if (e.key === 'Escape') annulla() }}
          style={{
            width: 70, fontSize: 10, padding: '2px 4px',
            border: `1px solid ${colore}`, borderRadius: 4,
            fontFamily: font, color: colors.text, background: '#fff'
          }}
        />
        <button onClick={conferma} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 1, color: '#00B884' }}>
          <Check size={11} />
        </button>
        <button onClick={annulla} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 1, color: '#F44336' }}>
          <X size={11} />
        </button>
      </div>
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      title="Clicca per rinominare"
      style={{
        display: 'flex', alignItems: 'center', gap: 3,
        cursor: 'pointer', userSelect: 'none',
        justifyContent: 'center'
      }}
    >
      <span style={{ fontSize: 10 }}>{nome}</span>
      <Pencil size={9} color={colors.textMuted} style={{ opacity: 0.5 }} />
    </div>
  )
}

// ─── CELLA TEMPERATURA ───────────────────────────────────────────────────────
function CellaTemp({ record, tempMin, tempMax, colore }) {
  if (!record) return <span style={{ color: colors.textLight, fontSize: 11 }}>—</span>
  if (record.is_chiuso) return <span title="CHIUSO" style={{ fontSize: 12 }}>🚫</span>
  if (record.is_manutenzione) return <span title="MANUTENZIONE" style={{ fontSize: 12 }}>🔧</span>
  if (record.is_non_usato) return <span title="NON USATO" style={{ fontSize: 12 }}>⏸</span>
  const temp = record.temp ?? record
  if (temp == null) return <span style={{ color: colors.textLight, fontSize: 11 }}>—</span>
  const fuori = temp > tempMax || temp < tempMin
  return (
    <span
      title={record.operatore ? `${temp}°C – ${record.operatore}` : `${temp}°C`}
      style={{
        fontSize: 11, fontWeight: fuori ? 700 : 500,
        color: fuori ? colors.dangerText : colore,
        background: fuori ? colors.dangerBg : 'transparent',
        borderRadius: 4, padding: fuori ? '1px 3px' : 0,
      }}
    >{temp}°</span>
  )
}

// ─── GRIGLIA COMUNE ──────────────────────────────────────────────────────────
function GrigliaTemperature({ schede, mese, anno, numApparecchi, nomi, onRinomina, tempMin, tempMax, colore, labelCol }) {
  const nGiorni = giorniNelMese(mese, anno)
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ ...s.table, minWidth: numApparecchi * 80 + 50 }}>
        <thead>
          <tr>
            <th style={{ ...s.th, width: 40, position: 'sticky', left: 0, zIndex: 2 }}>G</th>
            {Array.from({ length: numApparecchi }, (_, i) => (
              <th key={i+1} style={{ ...s.th, minWidth: 76, textAlign: 'center', fontSize: 10 }}>
                <ColonnaHeader
                  nome={nomi[i+1] || `${labelCol}${i+1}`}
                  onRinomina={nuovo => onRinomina(i+1, nuovo)}
                  colore={colore}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: nGiorni }, (_, gi) => {
            const g = gi + 1
            return (
              <tr key={g} style={{ background: g % 2 === 0 ? colors.bg : colors.card }}>
                <td style={{ ...s.td, fontWeight: 700, position: 'sticky', left: 0, background: 'inherit', width: 40, padding: '6px 10px' }}>{g}</td>
                {Array.from({ length: numApparecchi }, (_, ai) => {
                  const n = ai + 1
                  const record = schede[n]?.temperature?.[String(mese)]?.[String(g)]
                  return (
                    <td key={n} style={{ ...s.td, textAlign: 'center', padding: '4px 2px' }}>
                      <CellaTemp record={record} tempMin={tempMin} tempMax={tempMax} colore={colore} />
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── PANNELLO TEMPERATURE ────────────────────────────────────────────────────
function PannelloTemperature({ tipo }) {
  const isPos = tipo === 'positiva'
  const [mese, setMese] = useState(new Date().getMonth() + 1)
  const [anno, setAnno] = useState(new Date().getFullYear())
  const [schede, setSchede] = useState({})
  const [nomi, setNomi] = useState({})
  const [loading, setLoading] = useState(true)
  const [errore, setErrore] = useState(null)
  const [salvatoMsg, setSalvatoMsg] = useState(null)

  const endpoint = isPos ? 'temperature-positive' : 'temperature-negative'
  const keyNome  = isPos ? 'frigorifero_nome' : 'congelatore_nome'
  const keyNum   = isPos ? 'frigorifero_numero' : 'congelatore_numero'
  const tempMin  = isPos ? 0 : -22
  const tempMax  = isPos ? 4 : -18
  const range    = isPos ? '0°C / +4°C' : '-22°C / -18°C'
  const colore   = isPos ? '#C2410C' : '#0E7490'
  const labelCol = isPos ? 'F' : 'C'

  // Chiave localStorage per persistere i nomi localmente
  const localKey = `nomi_${endpoint}`

  const fetch12Schede = useCallback(async () => {
    setLoading(true); setErrore(null)
    try {
      const results = await Promise.all(
        Array.from({ length: 12 }, (_, i) =>
          fetch(`${API}/${endpoint}/scheda/${anno}/${i + 1}`).then(r => r.json())
        )
      )
      // Nomi salvati localmente (rinomina inline persistente)
      let nomiSalvati = {}
      try { nomiSalvati = JSON.parse(localStorage.getItem(localKey) || '{}') } catch {}

      const map = {}, nomiMap = {}
      results.forEach((d, i) => {
        map[i + 1] = d
        // Priorità: nome locale > nome dal server > fallback
        nomiMap[i + 1] = nomiSalvati[i+1] || d[keyNome] || `${labelCol}${i+1}`
      })
      setSchede(map); setNomi(nomiMap)
    } catch { setErrore('Errore connessione a ceraldiapp.it') }
    setLoading(false)
  }, [anno, endpoint, keyNome, labelCol, localKey])

  useEffect(() => { fetch12Schede() }, [fetch12Schede])

  // Rinomina inline: salva localmente + chiama API ceraldiapp.it
  async function handleRinomina(numero, nuovoNome) {
    // 1) Aggiorna stato locale immediato
    setNomi(prev => ({ ...prev, [numero]: nuovoNome }))

    // 2) Persisti in localStorage (fallback se API non risponde)
    try {
      const curr = JSON.parse(localStorage.getItem(localKey) || '{}')
      curr[numero] = nuovoNome
      localStorage.setItem(localKey, JSON.stringify(curr))
    } catch {}

    // 3) Chiama API ceraldiapp.it per aggiornare il nome sul server
    try {
      const body = isPos
        ? { frigorifero_nome: nuovoNome }
        : { congelatore_nome: nuovoNome }

      const r = await fetch(`${API}/${endpoint}/scheda/${anno}/${numero}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (r.ok) {
        setSalvatoMsg(`"${nuovoNome}" salvato`)
        setTimeout(() => setSalvatoMsg(null), 2500)
      } else {
        // API non supporta PATCH? Almeno rimane in localStorage
        setSalvatoMsg(`"${nuovoNome}" salvato localmente`)
        setTimeout(() => setSalvatoMsg(null), 2500)
      }
    } catch {
      setSalvatoMsg(`"${nuovoNome}" salvato localmente`)
      setTimeout(() => setSalvatoMsg(null), 2500)
    }
  }

  const cambiaMese = (d) => {
    let nm = mese + d, na = anno
    if (nm < 1) { nm = 12; na-- }
    if (nm > 12) { nm = 1; na++ }
    setMese(nm); setAnno(na)
  }

  const allarmi = Object.values(schede).reduce((acc, sch) => {
    const giorni = sch?.temperature?.[String(mese)] || {}
    Object.values(giorni).forEach(r => {
      if (r && !r.is_chiuso && !r.is_manutenzione && !r.is_non_usato) {
        const t = r.temp ?? r
        if (t != null && (t > tempMax || t < tempMin)) acc++
      }
    })
    return acc
  }, 0)

  return (
    <div>
      {/* Sub-header */}
      <div style={{ ...s.flexBetween, marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={s.flex}>
          <button style={{ ...s.btn, ...s.btnNeutral, ...s.btnSmall }} onClick={() => cambiaMese(-1)}><ChevronLeft size={15}/></button>
          <span style={{ fontFamily: font, fontWeight: 600, minWidth: 130, textAlign: 'center', margin: '0 4px' }}>{MESI[mese-1]} {anno}</span>
          <button style={{ ...s.btn, ...s.btnNeutral, ...s.btnSmall }} onClick={() => cambiaMese(1)}><ChevronRight size={15}/></button>
        </div>
        <div style={{ ...s.flex, gap: 8 }}>
          {salvatoMsg && (
            <span style={{ fontSize: 12, color: '#00B884', fontWeight: 600 }}>✓ {salvatoMsg}</span>
          )}
          {allarmi > 0 && (
            <span style={s.badge(colors.dangerText, colors.dangerBg)}>
              <AlertTriangle size={12} style={{ marginRight: 4 }} />{allarmi} fuori range
            </span>
          )}
          <button style={{ ...s.btn, ...s.btnNeutral, ...s.btnSmall }} onClick={fetch12Schede}><RefreshCw size={13}/></button>
        </div>
      </div>

      {/* Info strip */}
      <div style={{ ...s.flex, gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={s.badge(colors.infoText, colors.infoBg)}>Range: {range}</span>
        <span style={{ ...s.caption }}>Operatori: Pocci Salvatore, Vincenzo Ceraldi</span>
        <span style={{ ...s.caption }}>Reg. CE 852/2004 • D.Lgs. 193/2007</span>
        <span style={{ fontSize: 11, color: colors.textMuted, fontStyle: 'italic' }}>
          <Pencil size={10} style={{ marginRight: 3 }} />Clicca intestazione colonna per rinominare
        </span>
      </div>

      {errore && <div style={{ ...s.card, background: colors.dangerBg, color: colors.dangerText, marginBottom: 12 }}>{errore}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: colors.textMuted }}>
          <RefreshCw size={22} style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: 8 }}>Caricamento schede...</p>
        </div>
      ) : (
        <div style={s.cardNoPad}>
          <GrigliaTemperature
            schede={schede} mese={mese} anno={anno}
            numApparecchi={12} nomi={nomi}
            onRinomina={handleRinomina}
            tempMin={tempMin} tempMax={tempMax}
            colore={colore} labelCol={labelCol}
          />
        </div>
      )}

      {/* Legenda */}
      <div style={{ ...s.flex, gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
        <span style={s.badge(colore, isPos ? '#FFF7ED' : '#ECFEFF')}>Temp OK</span>
        <span style={s.badge(colors.dangerText, colors.dangerBg)}>Fuori range</span>
        <span style={s.badge(colors.textMuted, colors.bg)}>🚫 Chiuso</span>
        <span style={s.badge(colors.warningText, colors.warningBg)}>🔧 Manutenzione</span>
        <span style={s.badge(colors.textMuted, colors.borderLight)}>⏸ Non usato</span>
      </div>
    </div>
  )
}

// ─── PAGINA PRINCIPALE ───────────────────────────────────────────────────────
export default function TemperatureHACCP() {
  const [tab, setTab] = useState('positiva')

  const tabs = [
    { key: 'positiva', label: 'Frigoriferi (+)', icon: Thermometer, colore: colors.warning },
    { key: 'negativa', label: 'Congelatori (−)', icon: Snowflake,   colore: colors.info },
  ]

  return (
    <div>
      <div style={{ ...s.flexBetween, marginBottom: 20 }}>
        <div>
          <h1 style={s.h1}>
            {tab === 'positiva'
              ? <><Thermometer size={22} style={{ marginRight: 8, color: colors.warning, verticalAlign: 'middle' }} />Temperature Frigoriferi</>
              : <><Snowflake size={22} style={{ marginRight: 8, color: colors.info, verticalAlign: 'middle' }} />Temperature Congelatori</>
            }
          </h1>
          <p style={{ ...s.caption, marginTop: 4 }}>HACCP — Ceraldi Group S.R.L.</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ ...s.flex, gap: 4, marginBottom: 20, borderBottom: `2px solid ${colors.border}`, paddingBottom: 0 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              ...s.btn, gap: 6, borderRadius: '8px 8px 0 0',
              padding: '8px 18px',
              background: tab === t.key ? colors.card : 'transparent',
              color: tab === t.key ? t.colore : colors.textMuted,
              fontWeight: tab === t.key ? 700 : 500,
              borderBottom: tab === t.key ? `2px solid ${t.colore}` : '2px solid transparent',
              marginBottom: -2,
              transition: 'all .15s',
            }}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      <PannelloTemperature tipo={tab} />

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
