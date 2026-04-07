import React from 'react'
import { Receipt } from 'lucide-react'
import UploadPage from '../components/UploadPage'
import { formatEuro } from '../lib/utils'

const columns = [
  { key: 'periodo', label: 'Periodo', render: r => r.mese && r.anno ? `${String(r.mese).padStart(2,'0')}/${r.anno}` : '—' },
  { key: 'cognome', label: 'Cognome' },
  { key: 'nome', label: 'Nome' },
  { key: 'codice_fiscale', label: 'C.F.', mono: true },
  { key: 'lordo', label: 'Lordo', align: 'right', render: r => formatEuro(r.lordo) },
  { key: 'netto', label: 'Netto', align: 'right', render: r => formatEuro(r.netto) },
  { key: 'irpef', label: 'IRPEF', align: 'right', render: r => formatEuro(r.irpef) },
]

export default function Cedolini() {
  return (
    <UploadPage
      title="Cedolini"
      icon={Receipt}
      acceptExt=".pdf"
      uploadUrl="/api/cedolini/upload-pdf"
      listUrl="/api/cedolini"
      columns={columns}
    />
  )
}
