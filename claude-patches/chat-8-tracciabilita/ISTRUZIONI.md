# Patch Chat 8 — Tracciabilità completa + Bugfix Import

## PANORAMICA

Questa patch risolve il problema principale: le pagine HACCP/sconti/ordini chiamavano
`ceraldiapp.it` come API esterna (che non funziona su Emergent). Ora i router backend 
sono stati importati dal repo `tracciabilita`, adattati al pattern gestionale2 
(Depends/get_database), e montati sotto `/api/tr/*`.

La TopNav è stata snellita: i 6 link HACCP/sconti/ordini sono sostituiti da un unico
"📋 Tracciabilità" che apre una pagina con tab interni.

---

## FILE BACKEND — dove vanno

| File nella patch | Destinazione nel repo | Descrizione |
|---|---|---|
| `tr_utils.py` | `app/tr_utils.py` | Utility condivise (date, chiusure, Pasqua) |
| `tr_temperature.py` | `app/routers/tr_temperature.py` | Temperature positive (frigo) + negative (congelatori) |
| `tr_sanificazione.py` | `app/routers/tr_sanificazione.py` | Sanificazione attrezzature + apparecchi |
| `tr_disinfestazione.py` | `app/routers/tr_disinfestazione.py` | Disinfestazione (ANTHIRAT CONTROL) |
| `tr_dashboard.py` | `app/routers/tr_dashboard.py` | Produzioni, vendita banco, lotti, chiusure, acquaviva |
| `tr_sconti.py` | `app/routers/tr_sconti.py` | Sconti merce (importa da fatture) |
| `tr_ordini_fornitori.py` | `app/routers/tr_ordini_fornitori.py` | Ordini fornitori + catalogo prodotti suggeriti |
| `import_hub.py` | `app/routers/import_hub.py` | SOVRASCRIVE — fix fornitori flat + iban distinta |

## FILE FRONTEND — dove vanno

| File nella patch | Destinazione nel repo | Descrizione |
|---|---|---|
| `Tracciabilita.jsx` | `frontend/src/pages/Tracciabilita.jsx` | NUOVA — pagina wrapper con 6 tab interni |
| `App.jsx` | `frontend/src/App.jsx` | SOVRASCRIVE — rimuove route HACCP separate, aggiunge /tracciabilita |
| `TopNav.jsx` | `frontend/src/components/TopNav.jsx` | SOVRASCRIVE — 1 link "Tracciabilità" al posto di 6+ |
| `DashboardHACCP.jsx` | `frontend/src/pages/DashboardHACCP.jsx` | SOVRASCRIVE — API da ceraldiapp.it → /api/tr |
| `TemperatureHACCP.jsx` | `frontend/src/pages/TemperatureHACCP.jsx` | SOVRASCRIVE — API da ceraldiapp.it → /api/tr |
| `SanificazioneHACCP.jsx` | `frontend/src/pages/SanificazioneHACCP.jsx` | SOVRASCRIVE — API da ceraldiapp.it → /api/tr |
| `DisinfestazioneHACCP.jsx` | `frontend/src/pages/DisinfestazioneHACCP.jsx` | SOVRASCRIVE — API da ceraldiapp.it → /api/tr |
| `ScontiMerce.jsx` | `frontend/src/pages/ScontiMerce.jsx` | SOVRASCRIVE — API da ceraldiapp.it → /api/tr |
| `OrdiniFornitore.jsx` | `frontend/src/pages/OrdiniFornitore.jsx` | SOVRASCRIVE — HACCP_API da ceraldiapp.it → /api/tr |

## MODIFICHE A main.py (DA FARE MANUALMENTE)

Aggiungere in `app/main.py` gli import e i router:

```python
# Dopo gli import esistenti:
from app.routers import (
    tr_temperature, tr_sanificazione, tr_disinfestazione,
    tr_dashboard, tr_sconti, tr_ordini_fornitori
)

# Dopo i router esistenti:
app.include_router(tr_temperature.router,      prefix="/api/tr", tags=["tracciabilita"])
app.include_router(tr_sanificazione.router,     prefix="/api/tr", tags=["tracciabilita"])
app.include_router(tr_disinfestazione.router,   prefix="/api/tr", tags=["tracciabilita"])
app.include_router(tr_dashboard.router,         prefix="/api/tr", tags=["tracciabilita"])
app.include_router(tr_sconti.router,            prefix="/api/tr", tags=["tracciabilita"])
app.include_router(tr_ordini_fornitori.router,  prefix="/api/tr", tags=["tracciabilita"])
```

## BUGFIX INCLUSI

1. **import_hub.py riga 155**: Upsert fornitori usava struttura flat → ora usa `anagrafica.piva/ragione_sociale`
2. **import_hub.py riga 263**: Riconciliazione distinta cercava su `iban` → ora cerca `iban_cedolino` con fallback

## COLLECTIONS MONGODB USATE DAI NUOVI ROUTER

- `temperature_positive` — schede annuali temperature frigo
- `temperature_negative` — schede annuali temperature congelatori
- `sanificazione_schede` — schede mensili sanificazione attrezzature
- `sanificazione_apparecchi` — scheda annuale sanificazione frigo/congelatori
- `disinfestazione_annuale` — scheda annuale disinfestazione
- `produzioni` — eventi di produzione
- `vendite_banco` — vendite giornaliere al banco
- `lotti` — lotti produzione
- `chiusure_giornaliere` — stato giorno produttivo/riposo
- `sconti_merce` — sconti merce ricevuti
- `ordini_fornitori` — ordini ai fornitori
- `dizionario_prodotti` — catalogo prodotti suggeriti
- `ricette` — ricette (per costo produzione)
- `prodotti_vendita` — prodotti vendita (per prezzi)
- `fatture` / `fatture_passive` — fatture (per magazzino congelatore Vandemoortele)

Queste collections erano già presenti nel DB (usate da ceraldiapp.it) sullo stesso cluster MongoDB Atlas.
