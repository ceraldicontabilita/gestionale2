import React from 'react'
import { CreditCard } from 'lucide-react'
import UploadPage from '../components/UploadPage'
import { formatEuro } from '../lib/utils'

const columns = [
  { key: 'data', label: 'Data' },
  { key: 'matricola_rt', label: 'Matricola RT', mono: true },
  { key: 'numero_chiusura', label: 'N° chiusura' },
  { key: 'totale_corrispettivi', label: 'Totale', align: 'right', render: r => formatEuro(r.totale_corrispettivi) },
  { key: 'docs', label: 'Doc. comm.', render: r => r.numero_documenti_commerciali || 0 },
]

export default function Corrispettivi() {
  return (
    <UploadPage
      title="Corrispettivi"
      icon={CreditCard}
      acceptExt=".xml"
      uploadUrl="/api/corrispettivi/upload-xml"
      listUrl="/api/corrispettivi"
      columns={columns}
    />
  )
}
