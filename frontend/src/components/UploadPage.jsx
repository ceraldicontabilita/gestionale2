import React, { useState, useEffect, useRef } from 'react'
import { Upload, FileText, AlertCircle } from 'lucide-react'
import { s, colors, formatEuro } from '../lib/utils'

/**
 * Componente riutilizzabile per pagine upload documenti.
 * Props:
 *  - title: string
 *  - icon: LucideIcon
 *  - acceptExt: string (".xml", ".pdf", ".csv")
 *  - uploadUrl: string (API endpoint per upload)
 *  - listUrl: string (API endpoint per lista)
 *  - columns: [{key, label, render?}]
 *  - statsUrl?: string
 */
export default function UploadPage({ title, icon: Icon, acceptExt, uploadUrl, listUrl, columns, statsUrl }) {
  const [items, setItems] = useState([])
  const [totale, setTotale] = useState(0)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const fileRef = useRef()

  const load = () => {
    setLoading(true)
    fetch(listUrl)
      .then(r => r.json())
      .then(data => {
        setItems(data.items || data || [])
        setTotale(data.totale || (data.items || data || []).length)
      })
      .catch(console.error)
      .finally(() => setLoading(false))

    if (statsUrl) {
      fetch(statsUrl).then(r => r.json()).then(setStats).catch(() => {})
    }
  }

  useEffect(load, [listUrl, statsUrl])

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadResult(null)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch(uploadUrl, { method: 'POST', body: fd })
      const data = await res.json()
      setUploadResult(data)
      if (data.ok || res.ok) load()
    } catch (err) {
      setUploadResult({ ok: false, error: err.message })
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div>
      <div style={{ ...s.flexBetween, marginBottom: 20 }}>
        <div style={{ ...s.flex, gap: 12 }}>
          <Icon size={24} color={colors.primary} />
          <h1 style={s.h1}>{title}</h1>
          <span style={{ fontSize: 13, color: colors.textMuted }}>{totale} documenti</span>
        </div>
        <label style={{ ...s.btn, ...s.btnPrimary, cursor: 'pointer', opacity: uploading ? 0.6 : 1 }}>
          <Upload size={16} />
          {uploading ? 'Caricamento...' : `Carica ${acceptExt.toUpperCase()}`}
          <input ref={fileRef} type="file" accept={acceptExt} onChange={handleUpload} style={{ display: 'none' }} disabled={uploading} />
        </label>
      </div>

      {/* Upload result */}
      {uploadResult && (
        <div style={{
          ...s.card, padding: '12px 16px', marginBottom: 12,
          borderLeft: `4px solid ${uploadResult.ok !== false ? colors.success : colors.danger}`,
        }}>
          {uploadResult.ok !== false ? (
            <span style={{ color: colors.success, fontWeight: 600 }}>
              Caricato! {uploadResult.inserite != null && `${uploadResult.inserite} inserite, ${uploadResult.duplicate || 0} duplicate`}
            </span>
          ) : (
            <span style={{ color: colors.danger }}>
              <AlertCircle size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              {uploadResult.error || uploadResult.detail || 'Errore upload'}
            </span>
          )}
        </div>
      )}

      {/* Stats cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
          {Object.entries(stats).filter(([k]) => k !== '_id').map(([k, v]) => (
            <div key={k} style={{ ...s.card, padding: 12 }}>
              <div style={s.label}>{k.replace(/_/g, ' ')}</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {typeof v === 'number' && k.includes('import') || k.includes('totale') || k.includes('imponibile') || k.includes('iva')
                  ? formatEuro(v)
                  : v}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: colors.textMuted }}>Caricamento...</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: colors.textMuted }}>
            <FileText size={32} color={colors.border} style={{ marginBottom: 8 }} />
            <div>Nessun documento. Carica un file {acceptExt.toUpperCase()} per iniziare.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  {columns.map(c => (
                    <th key={c.key} style={{ ...s.th, ...(c.align === 'right' ? { textAlign: 'right' } : {}) }}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item._id || idx}>
                    {columns.map(c => (
                      <td key={c.key} style={{ ...s.td, ...(c.align === 'right' ? { textAlign: 'right', fontWeight: 600 } : {}), ...(c.mono ? { fontFamily: 'monospace', fontSize: 13 } : {}) }}>
                        {c.render ? c.render(item) : (item[c.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
