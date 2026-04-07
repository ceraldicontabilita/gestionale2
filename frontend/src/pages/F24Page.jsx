import React from 'react'
import { FileCheck } from 'lucide-react'
import UploadPage from '../components/UploadPage'
import { formatEuro } from '../lib/utils'

const columns = [
  { key: 'data_versamento', label: 'Data vers.' },
  { key: 'contribuente_cf', label: 'C.F.', mono: true },
  { key: 'contribuente_denominazione', label: 'Contribuente' },
  { key: 'tributi', label: 'Tributi', render: r => (r.sezione_erario?.length || 0) + (r.sezione_inps?.length || 0) },
  { key: 'totale', label: 'Totale', align: 'right', render: r => formatEuro(r.totale) },
  { key: 'stato', label: 'Stato', render: r => r.stato || 'da_pagare' },
]

export default function F24Page() {
  return (
    <UploadPage
      title="F24"
      icon={FileCheck}
      acceptExt=".pdf"
      uploadUrl="/api/f24/upload-pdf"
      listUrl="/api/f24"
      columns={columns}
    />
  )
}
