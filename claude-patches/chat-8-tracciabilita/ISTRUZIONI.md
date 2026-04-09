# Patch Chat 8 — Tracciabilità + Prima Nota + Bugfix

## PANORAMICA

1. **Tracciabilità**: router backend copiati da repo tracciabilita e adattati a gestionale2. Le pagine HACCP ora chiamano `/api/tr/*` locale, non più ceraldiapp.it. TopNav snellita con un unico link "Tracciabilità".

2. **Prima Nota**: nuovo modulo Cassa + Banca + Provvisoria. Auto-alimentazione da corrispettivi, estratto conto, fatture passive, F24. CRUD manuale. Conferma in blocco.

3. **Bugfix import_hub.py**: fornitori flat → nested, iban → iban_cedolino.

---

## FILE BACKEND — dove vanno

| File | Destinazione | Note |
|---|---|---|
| `tr_utils.py` | `app/tr_utils.py` | NUOVO — utility date/chiusure |
| `tr_temperature.py` | `app/routers/tr_temperature.py` | NUOVO — temperature +/- |
| `tr_sanificazione.py` | `app/routers/tr_sanificazione.py` | NUOVO — sanificazione |
| `tr_disinfestazione.py` | `app/routers/tr_disinfestazione.py` | NUOVO — disinfestazione |
| `tr_dashboard.py` | `app/routers/tr_dashboard.py` | NUOVO — produzioni/vendita/lotti/chiusure/acquaviva |
| `tr_sconti.py` | `app/routers/tr_sconti.py` | NUOVO — sconti merce |
| `tr_ordini_fornitori.py` | `app/routers/tr_ordini_fornitori.py` | NUOVO — ordini fornitori |
| `prima_nota.py` | `app/routers/prima_nota.py` | NUOVO — cassa/banca/provvisoria |
| `import_hub.py` | `app/routers/import_hub.py` | SOVRASCRIVE — bugfix |

## FILE FRONTEND — dove vanno

| File | Destinazione | Note |
|---|---|---|
| `Tracciabilita.jsx` | `frontend/src/pages/Tracciabilita.jsx` | NUOVO — wrapper 6 tab |
| `PrimaNota.jsx` | `frontend/src/pages/PrimaNota.jsx` | NUOVO — 3 sezioni cassa/banca/provv. |
| `App.jsx` | `frontend/src/App.jsx` | SOVRASCRIVE — route /tracciabilita + /prima-nota |
| `TopNav.jsx` | `frontend/src/components/TopNav.jsx` | SOVRASCRIVE — snellita + Prima Nota |
| `DashboardHACCP.jsx` | `frontend/src/pages/DashboardHACCP.jsx` | SOVRASCRIVE — API locale |
| `TemperatureHACCP.jsx` | `frontend/src/pages/TemperatureHACCP.jsx` | SOVRASCRIVE — API locale |
| `SanificazioneHACCP.jsx` | `frontend/src/pages/SanificazioneHACCP.jsx` | SOVRASCRIVE — API locale |
| `DisinfestazioneHACCP.jsx` | `frontend/src/pages/DisinfestazioneHACCP.jsx` | SOVRASCRIVE — API locale |
| `ScontiMerce.jsx` | `frontend/src/pages/ScontiMerce.jsx` | SOVRASCRIVE — API locale |
| `OrdiniFornitore.jsx` | `frontend/src/pages/OrdiniFornitore.jsx` | SOVRASCRIVE — API locale |

## MODIFICHE A main.py (DA FARE MANUALMENTE)

```python
# Aggiungere agli import:
from app.routers import (
    tr_temperature, tr_sanificazione, tr_disinfestazione,
    tr_dashboard, tr_sconti, tr_ordini_fornitori,
    prima_nota
)

# Aggiungere dopo i router esistenti:
app.include_router(tr_temperature.router,       prefix="/api/tr",         tags=["tracciabilita"])
app.include_router(tr_sanificazione.router,      prefix="/api/tr",         tags=["tracciabilita"])
app.include_router(tr_disinfestazione.router,    prefix="/api/tr",         tags=["tracciabilita"])
app.include_router(tr_dashboard.router,          prefix="/api/tr",         tags=["tracciabilita"])
app.include_router(tr_sconti.router,             prefix="/api/tr",         tags=["tracciabilita"])
app.include_router(tr_ordini_fornitori.router,   prefix="/api/tr",         tags=["tracciabilita"])
app.include_router(prima_nota.router,            prefix="/api/prima-nota", tags=["prima-nota"])
```

## TOPNAV FINALE (ordine link)

Importa → Dipendenti → Pignoramenti → Fatture → Cedolini → EC → Distinte → 📓 Prima Nota → ⚠️ Alert → 🏠 Tributi → 🏢 Fornitori → F24 → F24 Privati → Corrispettivi → Verbali → 📋 Tracciabilità → Mittenti

## PRIMA NOTA — Endpoint principali

- `GET  /api/prima-nota/movimenti?sezione=cassa|banca|provvisoria`
- `POST /api/prima-nota/movimenti` (inserimento manuale)
- `PUT  /api/prima-nota/movimenti/{id}` (modifica/conferma)
- `DELETE /api/prima-nota/movimenti/{id}`
- `GET  /api/prima-nota/saldi?sezione=...`
- `GET  /api/prima-nota/saldi-mensili?sezione=...&anno=...`
- `GET  /api/prima-nota/riepilogo-annuale?anno=...`
- `POST /api/prima-nota/genera-da-corrispettivi` → cassa
- `POST /api/prima-nota/genera-da-estratto-conto` → banca
- `POST /api/prima-nota/genera-da-fatture` → provvisoria
- `POST /api/prima-nota/genera-da-f24` → banca
- `POST /api/prima-nota/genera-tutto` (tutte le fonti)
- `POST /api/prima-nota/conferma-tutti?sezione=...`

Collection: `prima_nota` (campo `sezione`: cassa|banca|provvisoria)
