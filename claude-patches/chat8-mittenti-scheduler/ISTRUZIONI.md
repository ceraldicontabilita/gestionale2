# Patch Chat 8 — Mittenti attendibili + scheduler 50 minuti

## Cosa cambia

### 1. Scheduler: da 10 minuti → 50 minuti
**File:** `app/services/email_monitor_service.py`
**Riga da modificare:** `monitor_loop(db, interval_seconds: int = 600)` → `3000`
**E nella chiamata in scheduler.py:** aggiornare il valore di default

### 2. Mittenti attendibili: solo i pattern whitelistati
Il sistema già usa `mittenti_email` in MongoDB come whitelist.
**Il comportamento corretto è già implementato:** se il mittente non è in whitelist → skip silenzioso.
**Quello che manca** è la lista completa dei mittenti configurati nel DB.

## Script da eseguire UNA VOLTA su Emergent per popolare i mittenti nel DB

Esegui questo script Python (o incollalo in una route temporanea):

```python
# Popola la collection mittenti_email con tutti i mittenti attendibili
# Eseguire UNA VOLTA tramite: python3 seed_mittenti.py

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import uuid
from datetime import datetime, timezone

MONGODB_URI = "mongodb+srv://Ceraldidatabase:Ceraldi1974@cluster0.vofh7iz.mongodb.net/Gestionale?retryWrites=true&w=majority"

MITTENTI_GMAIL = [
    # ── COMMERCIALISTA / CEDOLINI (F24 fiscali + buste paga) ──────────────
    {"pattern": "rosaria.marotta",         "tipo_documento": "cedolino",   "descrizione": "Commercialista Marotta – F24 fiscali, cedolini"},
    {"pattern": "grazia.studioferrantini", "tipo_documento": "cedolino",   "descrizione": "Studio Ferrantini Grazia – F24 contributivi, cedolini"},
    {"pattern": "f.ferrantini",            "tipo_documento": "cedolino",   "descrizione": "F. Ferrantini – F24 contributivi"},
    {"pattern": "studioferrantini",        "tipo_documento": "cedolino",   "descrizione": "Studio Ferrantini (dominio)"},

    # ── INPS ──────────────────────────────────────────────────────────────
    {"pattern": "inps.it",                 "tipo_documento": "inps",       "descrizione": "INPS – comunicazioni ufficiali"},
    {"pattern": "pec.inps",               "tipo_documento": "inps",       "descrizione": "INPS PEC – delibere, FONSI, DURC"},
    {"pattern": "fonsi",                   "tipo_documento": "inps",       "descrizione": "INPS FONSI – cassa integrazione"},

    # ── INAIL ─────────────────────────────────────────────────────────────
    {"pattern": "inail.it",               "tipo_documento": "inail",      "descrizione": "INAIL – autoliquidazione, infortuni"},

    # ── AGENZIA ENTRATE / RISCOSSIONE ────────────────────────────────────
    {"pattern": "agenziaentrate",          "tipo_documento": "cartella_esattoriale", "descrizione": "Agenzia Entrate – avvisi, cartelle"},
    {"pattern": "agenziariscossione",      "tipo_documento": "cartella_esattoriale", "descrizione": "Agenzia Riscossione – AdER"},
    {"pattern": "riscossione.gov",         "tipo_documento": "cartella_esattoriale", "descrizione": "Riscossione – cartelle esattoriali"},
    {"pattern": "ader",                    "tipo_documento": "cartella_esattoriale", "descrizione": "AdER – intimazioni, rottamazione"},

    # ── PAGOPA / COMUNE NAPOLI ───────────────────────────────────────────
    {"pattern": "pagopa.gov",              "tipo_documento": "pagopa",     "descrizione": "PagoPA – ricevute pagamenti"},
    {"pattern": "comune.napoli",           "tipo_documento": "pagopa",     "descrizione": "Comune di Napoli – avvisi PagoPA"},
    {"pattern": "napoli.gov",              "tipo_documento": "pagopa",     "descrizione": "Comune Napoli – TARI, COSAP, verbali CdS"},
    {"pattern": "municipalita.napoli",     "tipo_documento": "pagopa",     "descrizione": "Municipalità Napoli"},

    # ── PAYPAL ───────────────────────────────────────────────────────────
    {"pattern": "paypal.com",              "tipo_documento": "paypal",     "descrizione": "PayPal – estratti conto, movimenti"},
    {"pattern": "service@paypal",          "tipo_documento": "paypal",     "descrizione": "PayPal – notifiche transazioni"},

    # ── NOLEGGIO AUTO (verbali, fatture canone) ───────────────────────────
    {"pattern": "leasys",                  "tipo_documento": "generico",   "descrizione": "Leasys – verbali, fatture noleggio"},
    {"pattern": "ald",                     "tipo_documento": "generico",   "descrizione": "ALD Automotive – verbali, canoni"},
    {"pattern": "arval",                   "tipo_documento": "generico",   "descrizione": "Arval – verbali, canoni noleggio"},
    {"pattern": "leaseplan",               "tipo_documento": "generico",   "descrizione": "LeasePlan – verbali"},
    {"pattern": "ayvens",                  "tipo_documento": "generico",   "descrizione": "Ayvens (ex ALD) – verbali, canoni"},
    {"pattern": "free2move",               "tipo_documento": "generico",   "descrizione": "Free2Move – noleggio"},
    {"pattern": "psrenting",               "tipo_documento": "generico",   "descrizione": "PS Renting – noleggio"},

    # ── BANCHE (estratti conto) ───────────────────────────────────────────
    {"pattern": "bnl.it",                  "tipo_documento": "generico",   "descrizione": "BNL – estratti conto, avvisi"},
    {"pattern": "bancobpm",                "tipo_documento": "generico",   "descrizione": "Banco BPM – estratti conto"},
    {"pattern": "nexi.it",                 "tipo_documento": "generico",   "descrizione": "Nexi – estratti carta, POS"},

    # ── ARUBA FATTURE (notifica ricezione fattura elettronica) ───────────
    {"pattern": "fatturazioneelettronica.aruba.it", "tipo_documento": "fattura_xml", "descrizione": "Aruba – notifica nuova fattura elettronica ricevuta"},
    {"pattern": "noreply@fatturazioneelettronica",  "tipo_documento": "fattura_xml", "descrizione": "Aruba – notifica fattura"},
]

MITTENTI_PEC = [
    # ── SDI (Sistema di Interscambio – fatture XML) ───────────────────────
    {"pattern": "pec.fatturapa.gov.it",    "tipo_documento": "fattura_xml", "descrizione": "SDI – fatture elettroniche XML"},
    {"pattern": "fatturapa.gov.it",        "tipo_documento": "fattura_xml", "descrizione": "SDI – fatture PA"},
    {"pattern": "sdi",                     "tipo_documento": "fattura_xml", "descrizione": "SDI generico"},
    {"pattern": "noreply@pec",             "tipo_documento": "fattura_xml", "descrizione": "PEC generica SDI"},

    # ── COMMERCIALISTA / CEDOLINI via PEC ────────────────────────────────
    {"pattern": "rosaria.marotta",         "tipo_documento": "cedolino",   "descrizione": "Commercialista Marotta via PEC"},
    {"pattern": "studioferrantini",        "tipo_documento": "cedolino",   "descrizione": "Studio Ferrantini via PEC"},

    # ── INPS via PEC ─────────────────────────────────────────────────────
    {"pattern": "pec.inps.it",             "tipo_documento": "inps",       "descrizione": "INPS PEC ufficiale"},

    # ── AGENZIA ENTRATE via PEC ──────────────────────────────────────────
    {"pattern": "agenziaentrate",          "tipo_documento": "cartella_esattoriale", "descrizione": "AdE via PEC"},
    {"pattern": "riscossione",             "tipo_documento": "cartella_esattoriale", "descrizione": "Riscossione via PEC"},

    # ── PAGOPA via PEC ───────────────────────────────────────────────────
    {"pattern": "pagopa",                  "tipo_documento": "pagopa",     "descrizione": "PagoPA via PEC"},
    {"pattern": "comune.napoli",           "tipo_documento": "pagopa",     "descrizione": "Comune Napoli via PEC"},
]

async def main():
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client["Gestionale"]
    
    inseriti = 0
    aggiornati = 0
    
    async def upsert(mittente_list, canale):
        nonlocal inseriti, aggiornati
        for m in mittente_list:
            existing = await db["mittenti_email"].find_one({"pattern": m["pattern"], "canale": canale})
            doc = {
                "pattern": m["pattern"],
                "canale": canale,
                "tipo_documento": m["tipo_documento"],
                "descrizione": m["descrizione"],
                "attivo": True,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            if existing:
                await db["mittenti_email"].update_one({"_id": existing["_id"]}, {"$set": doc})
                aggiornati += 1
            else:
                doc["id"] = str(uuid.uuid4())
                doc["created_at"] = datetime.now(timezone.utc).isoformat()
                await db["mittenti_email"].insert_one(doc)
                inseriti += 1
    
    await upsert(MITTENTI_GMAIL, "gmail")
    await upsert(MITTENTI_PEC, "pec")
    
    client.close()
    print(f"✅ Inseriti: {inseriti}, Aggiornati: {aggiornati}")
    print(f"   Gmail: {len(MITTENTI_GMAIL)} pattern")
    print(f"   PEC:   {len(MITTENTI_PEC)} pattern")

asyncio.run(main())
```

## Modifica scheduler — da 10 a 50 minuti

**File:** `app/services/email_monitor_service.py`

Trova la riga:
```python
async def monitor_loop(db, interval_seconds: int = 600):
```
Sostituisci con:
```python
async def monitor_loop(db, interval_seconds: int = 3000):
```

Trova anche la riga:
```python
"""
Loop di monitoraggio che esegue sync ogni N secondi (default 10 minuti).
"""
```
Sostituisci con:
```python
"""
Loop di monitoraggio che esegue sync ogni N secondi (default 50 minuti).
"""
```

**File:** `app/scheduler.py` — se contiene riferimento al monitor, aggiorna anche lì.

## Mittenti NON da aggiungere (esclusi intenzionalmente)
- ABC Napoli → le fatture arrivano via SDI XML, non direttamente
- TIM → le fatture arrivano via SDI XML, non direttamente
- Fornitori generici → NON nella whitelist, le fatture arrivano via PEC/SDI automaticamente

## Cosa succede dopo questa patch
1. Lo scheduler gira ogni 50 minuti invece di 10
2. Solo le email dei mittenti in whitelist vengono scaricate e processate
3. Tutto il resto viene ignorato silenziosamente
4. La pagina Admin → Gestione Email Mittenti mostra la lista completa e permette di aggiungerne/disabilitarne
