# Design System — Ceraldi ERP
> SOURCE OF TRUTH: `/app/frontend/src/lib/utils.js`

---

## REGOLA ASSOLUTA

**NO Tailwind, NO Shadcn** per le pagine gestionali.
Usare ESCLUSIVAMENTE le costanti da `lib/utils.js` con CSS inline.

---

## Costanti Disponibili

### COLORS
```js
import { COLORS } from '../../lib/utils';

COLORS.primary      = '#1e3a5f'   // Blu scuro principale
COLORS.primaryLight = '#2d5a87'   // Blu più chiaro
COLORS.success      = '#4caf50'   // Verde
COLORS.warning      = '#ff9800'   // Arancione
COLORS.danger       = '#ef4444'   // Rosso
COLORS.info         = '#2196f3'   // Blu info
COLORS.purple       = '#9c27b0'
COLORS.gray         = '#6b7280'
COLORS.grayLight    = '#e5e7eb'
COLORS.grayBg       = '#f9fafb'
COLORS.white        = '#ffffff'
// Extra (usati nelle pagine HR)
COLORS.text         = '#1e293b'
COLORS.textMuted    = '#64748b'
COLORS.border       = '#e2e8f0'
```

### SPACING (numeri, usare con `px`)
```js
SPACING.xs  = 4
SPACING.sm  = 8
SPACING.md  = 12
SPACING.lg  = 16
SPACING.xl  = 20
SPACING.xxl = 24
```

### STYLES (oggetti stile pronti)
```js
STYLES.page    // { padding: 20, maxWidth: 1400, margin: '0 auto' }
STYLES.header  // { gradient #1e3a5f→#2d5a87, borderRadius: 12, color: white }
STYLES.card    // { background: white, borderRadius: 12, boxShadow: ..., border }
STYLES.input   // { padding: '10px 12px', borderRadius: 8, border: 2px solid grayLight }
STYLES.select  // uguale a input
STYLES.table   // { width: '100%', borderCollapse: 'collapse' }
STYLES.th      // { padding: '12px 16px', fontWeight: 600, background: grayBg }
STYLES.td      // { padding: '12px 16px', borderBottom: '1px solid grayLight' }
```

---

## Template Pagina Standard

```jsx
import { COLORS, STYLES, SPACING } from '../../lib/utils';
import { SomeIcon } from 'lucide-react';

export default function NuovaPagina() {
  return (
    <div style={{ padding: SPACING.xl, maxWidth: 1200 }}>
      
      {/* Header */}
      <div style={{ ...STYLES.header, marginBottom: SPACING.lg }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Titolo</h1>
          <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: 13 }}>Sottotitolo</p>
        </div>
        <button style={{ ...STYLES.btnPrimary }}>Azione</button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {[{ label: 'Totale', value: 42 }].map(k => (
          <div key={k.label} style={{ ...STYLES.card, padding: '16px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase' }}>
              {k.label}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.text, marginTop: 6 }}>
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {/* Tabella */}
      <div style={{ ...STYLES.card }}>
        <table style={STYLES.table}>
          <thead>
            <tr>
              <th style={STYLES.th}>Campo</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={STYLES.td}>Valore</td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  );
}
```

---

## Componenti UI Comuni

### Button Primary
```jsx
<button style={{
  padding: '8px 16px', border: 'none', borderRadius: 6,
  background: COLORS.primary, color: 'white',
  cursor: 'pointer', fontSize: 13, fontWeight: 600
}}>Testo</button>
```

### Badge Stato
```jsx
<span style={{
  padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
  background: condizione ? '#dcfce7' : '#fef9c3',
  color: condizione ? '#16a34a' : '#a16207'
}}>
  {condizione ? 'Attivo' : 'In attesa'}
</span>
```

### Tab Navigation
```jsx
<div style={{ display: 'flex', borderBottom: `1px solid ${COLORS.border}` }}>
  {tabs.map(t => (
    <button key={t.id} onClick={() => setTab(t.id)} style={{
      padding: '12px 20px', background: 'none', border: 'none',
      borderBottom: tab === t.id ? `3px solid ${COLORS.primary}` : '3px solid transparent',
      color: tab === t.id ? COLORS.primary : COLORS.textMuted,
      fontWeight: tab === t.id ? 700 : 400, cursor: 'pointer', fontSize: 13,
    }}>{t.label}</button>
  ))}
</div>
```

### Loading Spinner
```jsx
<div style={{ padding: 40, textAlign: 'center', color: COLORS.textMuted }}>
  <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
  <div>Caricamento…</div>
</div>
<style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
```

---

## Icone
- Libreria: **lucide-react** (già installata)
- NO emoji nel codice sorgente
- Import: `import { FileText, Download, RefreshCw, Mail } from 'lucide-react'`

---

## data-testid (obbligatori)
Ogni elemento interattivo o con dati critici DEVE avere `data-testid`:
```jsx
<button data-testid="btn-import-gmail">Importa da Gmail</button>
<select data-testid="select-anno-cedolini">...</select>
<div data-testid="import-result-banner">...</div>
```
