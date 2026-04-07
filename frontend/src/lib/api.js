const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Errore server')
  }
  return res.json()
}

async function upload(path, file, fieldName = 'file') {
  const formData = new FormData()
  formData.append(fieldName, file)
  const res = await fetch(`${BASE}${path}`, { method: 'POST', body: formData })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Errore upload')
  }
  return res.json()
}

export const api = {
  // ── HEALTH ──────────────────────────────────────
  health: () => request('/health'),

  // ── DIPENDENTI ──────────────────────────────────
  getDipendenti: (stato) => request(`/dipendenti${stato ? `?stato=${stato}` : ''}`),
  getDipendente: (id) => request(`/dipendenti/${id}`),
  creaDipendente: (data) => request('/dipendenti', { method: 'POST', body: JSON.stringify(data) }),
  aggiornaDipendente: (id, data) => request(`/dipendenti/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // ── PIGNORAMENTI ────────────────────────────────
  getPignoramenti: (dipId) => request(`/dipendenti/${dipId}/pignoramenti`),
  aggiungiPignoramento: (dipId, data) => request(`/dipendenti/${dipId}/pignoramenti`, { method: 'POST', body: JSON.stringify(data) }),
  aggiornaStatoPignoramento: (dipId, pigId, stato) => request(`/dipendenti/${dipId}/pignoramenti/${pigId}/stato`, { method: 'PUT', body: JSON.stringify({ stato }) }),
  generaDichiarazione: (dipId, pigId) => request(`/dipendenti/${dipId}/pignoramenti/${pigId}/genera-dichiarazione`, { method: 'POST' }),
  uploadPignoramento: (file) => upload('/dipendenti/upload-pignoramento', file),

  // ── FATTURE ─────────────────────────────────────
  getFatture: (params = {}) => {
    const q = new URLSearchParams()
    if (params.anno) q.set('anno', params.anno)
    if (params.fornitore) q.set('fornitore', params.fornitore)
    if (params.skip) q.set('skip', params.skip)
    if (params.limit) q.set('limit', params.limit)
    return request(`/fatture?${q}`)
  },
  getFattura: (id) => request(`/fatture/${id}`),
  getStatsFatture: (anno) => request(`/fatture/stats?anno=${anno}`),
  uploadFatturaXml: (file) => upload('/fatture/upload-xml', file),

  // ── CEDOLINI ────────────────────────────────────
  getCedolini: (params = {}) => {
    const q = new URLSearchParams()
    if (params.anno) q.set('anno', params.anno)
    if (params.mese) q.set('mese', params.mese)
    return request(`/cedolini?${q}`)
  },
  uploadCedoliniPdf: (file) => upload('/cedolini/upload-pdf', file),
  riconciliaCedolini: () => request('/cedolini/riconcilia', { method: 'POST' }),

  // ── ESTRATTO CONTO ──────────────────────────────
  getMovimenti: (params = {}) => {
    const q = new URLSearchParams()
    if (params.data_da) q.set('data_da', params.data_da)
    if (params.data_a) q.set('data_a', params.data_a)
    if (params.categoria) q.set('categoria', params.categoria)
    if (params.riconciliato !== undefined) q.set('riconciliato', params.riconciliato)
    if (params.skip) q.set('skip', params.skip)
    if (params.limit) q.set('limit', params.limit)
    return request(`/estratto-conto?${q}`)
  },
  getSaldoBanca: () => request('/estratto-conto/saldo'),
  uploadEstrattoContoPdf: (file) => upload('/estratto-conto/upload-pdf', file),

  // ── F24 ─────────────────────────────────────────
  getF24: (anno) => request(`/f24${anno ? `?anno=${anno}` : ''}`),
  uploadF24Pdf: (file) => upload('/f24/upload-pdf', file),

  // ── CORRISPETTIVI ───────────────────────────────
  getCorrispettivi: (params = {}) => {
    const q = new URLSearchParams()
    if (params.anno) q.set('anno', params.anno)
    if (params.mese) q.set('mese', params.mese)
    return request(`/corrispettivi?${q}`)
  },
  getStatsCorrispettivi: (anno) => request(`/corrispettivi/stats${anno ? `?anno=${anno}` : ''}`),
  uploadCorrispettivoXml: (file) => upload('/corrispettivi/upload-xml', file),

  // ── DISTINTE ────────────────────────────────────
  getDistinte: (params = {}) => {
    const q = new URLSearchParams()
    if (params.skip) q.set('skip', params.skip)
    if (params.limit) q.set('limit', params.limit)
    return request(`/distinte?${q}`)
  },
  uploadDistintaPdf: (file) => upload('/distinte/upload-pdf', file),

  // ── VERBALI ─────────────────────────────────────
  getVerbali: (tipo) => request(`/verbali${tipo ? `?tipo=${tipo}` : ''}`),
  getVerbale: (id) => request(`/verbali/${id}`),
  uploadVerbalePdf: (file) => upload('/verbali/upload-pdf', file),
}
