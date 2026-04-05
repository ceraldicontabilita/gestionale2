# Architettura Backend — Ceraldi ERP
> Aggiornato: Aprile 2026

---

## Struttura Directory

```
/app/
├── backend/
│   ├── server.py              ← ENTRY POINT (NON cancellare!)
│   │                            from app.main import app
│   └── app/
│       ├── main.py            ← registra tutti i router
│       ├── config.py
│       ├── database.py        ← Database.get_db(), Database.connect_db()
│       ├── scheduler.py
│       │
│       ├── routers/
│       │   ├── cucina/        ← NUOVI (Aprile 2026)
│       │   │   ├── ricette.py         → /api/cucina/ricette
│       │   │   ├── food_cost.py       → /api/cucina/food-cost
│       │   │   ├── prodotti_vendita.py → /api/cucina/prodotti-vendita
│       │   │   └── ordini_fornitori.py → /api/cucina/ordini-fornitori
│       │   │
│       │   ├── f24/
│       │   │   ├── f24_main.py        → /api/f24
│       │   │   ├── f24_riconciliazione.py
│       │   │   └── ...
│       │   │
│       │   ├── accounting/
│       │   │   ├── prima_nota.py      → /api/prima-nota
│       │   │   ├── bilancio.py        → /api/bilancio
│       │   │   ├── liquidazione_iva.py
│       │   │   └── ...
│       │   │
│       │   ├── bank/
│       │   │   ├── estratto_conto.py  → /api/estratto-conto-movimenti
│       │   │   ├── bank_statement_import.py
│       │   │   └── ...
│       │   │
│       │   ├── employees/
│       │   │   ├── dipendenti.py      → /api/dipendenti
│       │   │   ├── buste_paga.py      → /api/buste-paga
│       │   │   └── ...
│       │   │
│       │   ├── warehouse/
│       │   │   ├── magazzino.py       → /api/magazzino
│       │   │   ├── tracciabilita.py   → /api/tracciabilita
│       │   │   └── ...
│       │   │
│       │   ├── cedolini.py            → /api/cedolini (include import Gmail)
│       │   ├── tfr.py                 → /api/tfr
│       │   ├── libro_unico_parser.py  → /api/paghe
│       │   ├── f24_parser.py          → /api/paghe (distinte F24)
│       │   └── ...
│       │
│       ├── services/
│       │   ├── email_document_downloader.py  ← IMAP downloader (sincrono!)
│       │   ├── email_monitor_service.py      ← scheduler orario
│       │   ├── email_full_download.py
│       │   ├── xml_invoice_processor.py
│       │   └── ...
│       │
│       └── utils/
│           ├── error_handler.py   ← @handle_errors decorator
│           ├── logger.py
│           └── ...
│
└── frontend/
    └── src/
        ├── main.jsx           ← routing React (aggiornato Apr 2026)
        ├── api.js             ← axios instance con REACT_APP_BACKEND_URL
        ├── lib/
        │   └── utils.js       ← SOURCE OF TRUTH design (COLORS, STYLES, SPACING)
        │
        └── pages/
            ├── hr/            ← NUOVA CARTELLA (Aprile 2026)
            │   ├── HRDipendenti.jsx
            │   ├── HRCedolini.jsx     ← import Gmail + /api/cedolini
            │   ├── HRPresenze.jsx
            │   └── HRTFR.jsx
            │
            ├── cucina/        ← aggiunte Passo 5 (2026)
            │   └── CucinaHub.jsx
            │
            ├── hub/
            │   └── DashboardHub.jsx
            │
            ├── RicettarioAdmin.jsx
            ├── FoodCostAdmin.jsx
            ├── CatalogoOrdini.jsx
            ├── ProdottiVendita.jsx
            └── OrdiniFornitori.jsx    ← include tab "Bozze"
```

---

## Pattern IMAP Sicuro

```python
# ✅ CORRETTO — non blocca l'event loop
async def endpoint_che_usa_imap():
    raw = await asyncio.to_thread(funzione_sincrona_imap, email_user, email_pass)
    for doc in raw:
        await db["collection"].insert_one(doc)

# ❌ SBAGLIATO — blocca tutto il server
async def endpoint_sbagliato():
    imap = imaplib.IMAP4_SSL("imap.gmail.com")  # BLOCCA!
    imap.login(user, pass)
```

---

## Pattern MongoDB

```python
# ✅ Esclude _id (sempre!)
docs = await db["collection"].find({}, {"_id": 0}).to_list(None)

# ✅ Insert senza restituire doc con _id
await db["collection"].insert_one(doc)  # non riusare doc dopo!

# ✅ DateTime corretta
from datetime import datetime, timezone
now = datetime.now(timezone.utc)  # NON datetime.utcnow()
```

---

## Registrazione Router in main.py

```python
from app.routers.cucina import ricette, food_cost, prodotti_vendita, ordini_fornitori

app.include_router(ricette.router, prefix="/api/cucina", tags=["Cucina"])
app.include_router(food_cost.router, prefix="/api/cucina", tags=["Food Cost"])
```

---

## Endpoint Principali

| Prefisso | File | Descrizione |
|---|---|---|
| `/api/cedolini` | `routers/cedolini.py` | Buste paga + import Gmail |
| `/api/dipendenti` | `routers/employees/dipendenti.py` | Anagrafica |
| `/api/paghe` | `routers/libro_unico_parser.py` | Buste paga libro unico |
| `/api/paghe` | `routers/f24_parser.py` | Distinte F24 |
| `/api/cucina` | `routers/cucina/*.py` | Cucina e food cost |
| `/api/prima-nota` | `routers/accounting/prima_nota.py` | Contabilità |
| `/api/estratto-conto-movimenti` | `routers/bank/estratto_conto.py` | Movimenti bancari |
| `/api/fatture-ricevute` | vari | Archivio fatture |
