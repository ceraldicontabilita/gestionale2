import React from 'react'
import { Car } from 'lucide-react'
import UploadPage from '../components/UploadPage'
import { formatEuro } from '../lib/utils'

const columns = [
  { key: 'tipo', label: 'Tipo' },
  { key: 'numero_verbale', label: 'N° verbale', mono: true },
  { key: 'data_verbale', label: 'Data' },
  { key: 'targa', label: 'Targa', mono: true },
  { key: 'ente', label: 'Ente' },
  { key: 'importo', label: 'Importo', align: 'right', render: r => formatEuro(r.importo) },
  { key: 'stato', label: 'Stato', render: r => r.stato || '—' },
]

export default function Verbali() {
  return (
    <UploadPage
      title="Verbali"
      icon={Car}
      acceptExt=".pdf"
      uploadUrl="/api/verbali/upload-pdf"
      listUrl="/api/verbali"
      columns={columns}
    />
  )
}
