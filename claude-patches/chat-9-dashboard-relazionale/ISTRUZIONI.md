# PATCH Chat 9e — Dashboard Relazionale (Frontend + API)
## Data: 22 Aprile 2026

---

## File nuovi

### Frontend
```
frontend/src/pages/DashboardRelazionale.jsx  — pagina React completa
```

### Backend
```
app/routers/partite_aperte_api.py            — GET /api/partite-aperte/stats, /lista, /scadute
app/routers/riconciliazione_stats_api.py      — GET /api/riconciliazione/stats
```

---

## Cosa mostra la Dashboard Relazionale

### Tab Panoramica
- 4 KPI: alert critici, warning, info, totali
- Card Partite Aperte: totale per tipo (fatture, F24, stipendi, POS) con residuo €
- Card Riconciliazione: match confermati/candidati/respinti con totali €
- Alert critici recenti (top 5)
- Mappa moduli: griglia con conteggio alert per modulo, colorata per severità

### Tab Alert
- Filtro per modulo (fornitori, fatture, f24, cedolini, dipendenti, banca, cassa, magazzino, documenti)
- Lista alert con icona severità, titolo, dettaglio, codice, data
- Badge severità colorato

### Tab Partite Aperte
- KPI per tipo partita (cliccabili per filtrare)
- Filtro per tipo partita
- Tabella con: tipo, controparte, importo, residuo, scadenza, stato
- Residuo in rosso se > 0, in verde se chiuso

### Tab Riconciliazione
- KPI per stato match (confermato/candidato/respinto) con totali €

---

## Modifiche da fare

### 1. Registrare i router in `main.py` o `router_registry.py`

```python
from app.routers.partite_aperte_api import router as partite_router
from app.routers.riconciliazione_stats_api import router as ric_stats_router

app.include_router(partite_router, prefix="/api")
app.include_router(ric_stats_router, prefix="/api")
```

### 2. Aggiungere la route nel frontend router (App.jsx o routes)

```jsx
import DashboardRelazionale from './pages/DashboardRelazionale';

// Nella definizione route:
<Route path="/dashboard-relazionale" element={<DashboardRelazionale />} />
```

### 3. Aggiungere nel menu/sidebar

Aggiungere link a `/dashboard-relazionale` nel menu principale, possibilmente nella sezione Strumenti o come voce separata.

---

## Design

- Usa SOLO il design system da `src/lib/utils.js`
- Palette navy #0f2744 + oro #b8860b
- Zero Tailwind, zero Shadcn
- Responsive: griglia collassa su mobile
- Badge colorati per severità e tipo
- Tutto inline styles, coerente con il resto del gestionale
