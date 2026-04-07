import React from 'react'
import { FileText } from 'lucide-react'
import UploadPage from '../components/UploadPage'
import { formatEuro } from '../lib/utils'

const columns = [
  { key: 'data', label: 'Data' },
  { key: 'numero', label: 'Numero', mono: true },
  { key: 'fornitore', label: 'Fornitore', render: r => r.fornitore_denominazione || '—' },
  { key: 'piva', label: 'P.IVA', mono: true, render: r => r.fornitore_piva || '—' },
  { key: 'imponibile', label: 'Imponibile', align: 'right', render: r => formatEuro(r.imponibile) },
  { key: 'iva', label: 'IVA', align: 'right', render: r => formatEuro(r.iva) },
  { key: 'importo_totale', label: 'Totale', align: 'right', render: r => formatEuro(r.importo_totale) },
  { key: 'stato', label: 'Stato', render: r => r.stato || '—' },
]

export default function Fatture() {
  return (
    <UploadPage
      title="Fatture Passive"
      icon={FileText}
      acceptExt=".xml"
      uploadUrl="/api/fatture/upload-xml"
      listUrl="/api/fatture"
      statsUrl="/api/fatture/stats"
      columns={columns}
    />
  )
}
