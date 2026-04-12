# Logica Operativa — Ceraldi ERP
> Versione: Aprile 2026 (aggiornato) | P.IVA: 04523831214 | DB: Gestionale (MongoDB Atlas)

---

## REGOLE BUSINESS FONDAMENTALI

### Fonti documenti per canale:
- **FATTURE SDI** → arrivano via **PEC Aruba** (`fatturazioneceraldi@pec.it`) o **import manuale XML**. MAI da Gmail.
- **CEDOLINI / BUSTE PAGA** → arrivano via **Gmail** (dal consulente TeamSystem/Zucchetti) o import PDF Libro Unico
- **F24, ESTRATTI CONTO, VERBALI, QUIETANZE, BONIFICI, CARTELLE** → arrivano via **Gmail**
- **SCHEDE TECNICHE** → via Gmail (allegati PDF da fornitori) o ricerca web
- **PRESENZE** → importate da PDF Libro Unico del consulente via endpoint dedicato

### Scansione Email:
- **Gmail**: scansiona le cartelle configurate — molte contengono documenti organizzati per argomento
- **PEC**: scansiona INBOX + INBOX.lette — supporta P7M firmati digitalmente (OpenSSL + asn1crypto)
- **Fatture da Gmail**: ESCLUSE automaticamente (solo PEC/SDI per le fatture)

---

## INDICE

1. [Architettura Generale](#1-architettura-generale)
2. [Flusso Email → Documenti](#2-flusso-email--documenti)
3. [Fatture XML e Prima Nota](#3-fatture-xml-e-prima-nota)
4. [Prima Nota Cassa e Banca](#4-prima-nota-cassa-e-banca)
5. [Corrispettivi e Cassa](#5-corrispettivi-e-cassa)
6. [Dipendenti e HR](#6-dipendenti-e-hr)
7. [Cedolini e Buste Paga](#7-cedolini-e-buste-paga)
8. [Fornitori e Ciclo Passivo](#8-fornitori-e-ciclo-passivo)
9. [Banca ed Estratto Conto](#9-banca-ed-estratto-conto)
10. [Dashboard e Volume d'Affari](#10-dashboard-e-volume-daffari)
11. [Struttura Database](#11-struttura-database)
12. [Noleggio Auto e Verbali](#12-noleggio-auto-e-verbali)
13. [Magazzino](#13-magazzino)

---

## 1. ARCHITETTURA GENERALE

```
Frontend (React 18 + Vite)  ←→  Backend (FastAPI + Motor)  ←→  MongoDB Atlas
        :3000 (supervisor)           :8001 (supervisor)          Gestionale
```

- **Frontend**: React 18, Vite. CSS inline ONLY da `lib/utils.js`. NO Tailwind, NO Shadcn.
- **Backend**: FastAPI, Motor (async). Entry: `backend/server.py` → `from app.main import app`.
- **Database**: MongoDB Atlas, DB name: `Gestionale`. Variabili: `MONGO_URL`, `DB_NAME` in `backend/.env`.
- **Auth**: disabilitata (`AUTH_DISABLED=true`) — accesso diretto senza login.
- **Settings**: Pydantic settings con priorità `.env` > OS env (intenzionale per evitare override da piattaforma)

### Variabili d'ambiente (struttura .env)
```
MONGO_URL = mongodb+srv://Ceraldidatabase:[PASS]@cluster0.vofh7iz.mongodb.net/?retryWrites=true&w=majority
DB_NAME   = Gestionale

# Gmail
IMAP_USER     = ceraldigroupsrl@gmail.com
IMAP_PASSWORD = [APP_PASSWORD_GOOGLE]

# PEC Aruba
ARUBA_PEC_HOST = imaps.pec.aruba.it
ARUBA_PEC_USER = fatturazioneceraldi@pec.it
ARUBA_PEC_PASSWORD = [PASSWORD_PEC]
```
> ⚠️ Le credenziali reali sono nel file `backend/.env` — NON commitarle nel repo.
> ⚠️ La priorità .env > OS env è INTENZIONALE: la piattaforma inietta un MONGO_URL locale vuoto.

---

## 2. FLUSSO EMAIL → DOCUMENTI

### 2.1 Mittenti Autorizzati (`mittenti_attendibili`, 11 record)

| Canale | Pattern | Tipo Documento |
|---|---|---|
| pec | @pec.fatturapa.it | fattura_xml |
| pec | sdi@pec.fatturapa.it | fattura_xml |
| gmail | f.ferrantini@... | cedolino |
| gmail | rosaria.marotta@... | cedolino |
| gmail | partenopay@... | pagopa |
| gmail | inpscomunica@... | inps |
| gmail | notifica.acc.campania@... | cartella_esattoriale |

### 2.2 Routing per tipo_documento

| tipo_documento | Azione |
|---|---|
| `fattura_xml` | Parser XML → `invoices` (estrae anche DatiFattureCollegate per NC) |
| `cedolino` | Salva PDF in `documents_inbox` |
| `pagopa` | Documento generico, categoria=pagopa |
| `verbale` | Parser PDF → estrae targa, importo → `verbali_noleggio` |

---

## 3. FATTURE XML E PRIMA NOTA

### 3.1 Fatture SDI (ciclo passivo)
- Arrivano via Aruba PEC come `.xml` o `.p7m`
- Salvate in `invoices` (**1.405 record**)
- Parser XML estrae: `DatiFattureCollegate`, `DatiOrdineAcquisto`, `causali`, `tipo_documento`

### 3.2 Note Credito (TD04)
- **29 note credito** nel database
- Parser estrae `DatiFattureCollegate` per link automatico NC↔Fattura
- Nel modal Assegni: NC mostrate con importo **negativo** e badge rosso "Nota Credito"
- Fatture raggruppate per fornitore nel modal di associazione

### 3.3 Codici Tipo Documento FE

| Codice | Tipo | Direzione |
|---|---|---|
| TD01 | Fattura ordinaria | acquisto → uscita |
| TD04 | Nota di credito | rimborso → **importo negativo** |
| TD24/25 | Fattura differita | vendita → entrata |

### 3.4 Prima Nota Provvisori
- Fatture non ancora registrate: `GET /api/prima-nota/provvisori?anno=2026`
- 3 stati: **Cassa** (contanti), **Banca** (bonifico), **Sospesa** (in attesa)
- Sospesa: aggiorna `stato_pagamento` sulla fattura, rimuove `prima_nota_id`, resta nei provvisori

---

## 4. PRIMA NOTA CASSA E BANCA

### 4.1 Prima Nota Cassa (`prima_nota_cassa`, 136 record)
- Fonte: corrispettivi contanti, fatture pagate in contanti
- API: `GET /api/prima-nota/cassa?anno=2026`

### 4.2 Prima Nota Banca (`prima_nota_banca`, 4.365 record)
- Fonte: movimenti bancari, F24, stipendi, incassi POS
- API: `GET /api/prima-nota/banca?anno=2026`

### 4.3 Regola POS
- Pagamenti elettronici (POS) → Prima Nota **Banca** (NON cassa)
- Contanti → Prima Nota **Cassa**

---

## 5. CORRISPETTIVI E CASSA

### 5.1 Struttura (`corrispettivi`, 54 record)
```json
{
  "data": "2026-01-15",
  "pagato_contanti": 949.91,
  "pagato_elettronico": 928.70,
  "totale_giornata": 1878.61
}
```
**Nota**: il campo `anno` può essere assente — filtrare sempre per range di `data`.

### 5.2 Volume d'Affari
```
Fatturato = SUM(corrispettivi.totale_giornata) per anno
```
> ⚠️ **REGOLA CRITICA**: NON usare le fatture ricevute per il volume d'affari. Quelle sono COSTI.

---

## 6. DIPENDENTI E HR

### 6.1 Collection HR

| Collection | Record | Uso |
|---|---|---|
| `dipendenti` | 30 | Anagrafica principale — **USARE QUESTA** |
| `cedolini` | 301 | Buste paga (source: cedolino_v2 da Libro Unico) |
| `presenze` | 290 | Presenze giornaliere (generate da cedolini + import PDF) |

Campo chiave: `in_carico` (bool) — dipendenti attivi.

### 6.2 Route HR
```
/dipendenti          → HRDipendenti.jsx   (anagrafica + dettaglio con tab Cedolini/Verbali/etc.)
/cedolini            → HRCedolini.jsx     (buste paga — vista Per Mese / Per Dipendente)
/presenze            → HRPresenze.jsx     (calendario presenze da Libro Unico + import PDF)
/tfr                 → HRTFR.jsx          (gestione TFR)
```

### 6.3 Presenze
- Collection `presenze`: dati mensili per dipendente con griglia giornaliera
- Campi: `codice_fiscale`, `cognome`, `nome`, `anno`, `mese`, `giorni[]`, `totali`, `legenda`
- Ogni giorno: `giorno`, `giorno_settimana`, `ore_ordinarie`, `giustificativi[]`, `festivo`
- Import: `POST /api/attendance/libro-unico/import-pdf` (upload PDF Libro Unico)
- Lettura: `GET /api/attendance/libro-unico?anno=2026&mese=2`

### 6.4 Cedolini
- Campi chiave: `nome_dipendente` (COGNOME NOME), `codice_fiscale`, `netto`, `netto_mese`
- `lordo` spesso 0.0 (parser Zucchetti non lo estrae)
- `source: cedolino_v2` per tutti i record attuali
- Frontend usa: `nome_dipendente || (cognome + nome)` per display

### 6.5 API HR
```
GET  /api/dipendenti                              → lista (30)
GET  /api/cedolini?anno=2026&limit=500            → cedolini per anno
POST /api/cedolini/import-gmail?since_days=180    → importa da Gmail
GET  /api/attendance/libro-unico?anno=2026        → presenze da Libro Unico
POST /api/attendance/libro-unico/import-pdf       → upload PDF presenze
```

---

## 7. CEDOLINI E BUSTE PAGA

### 7.1 Schema Cedolino (source: cedolino_v2)
```json
{
  "codice_fiscale": "XXXXXX00X00X000X",
  "cognome": "Rossi",
  "nome": "Mario",
  "nome_dipendente": "ROSSI MARIO",
  "anno": 2026,
  "mese": 2,
  "lordo": 0.0,
  "netto": 936.0,
  "netto_mese": 936.0,
  "tfr_mese": 133.82,
  "mansione": "Barista",
  "livello": "5' Livello",
  "source": "cedolino_v2",
  "dedup_key": "XXXXXX00X00X000X_02_2026"
}
```

### 7.2 Formato supportato
- **Zucchetti nuovo** (cedolino_v2) — formato attuale dal consulente

---

## 8. FORNITORI E CICLO PASSIVO

### 8.1 Collections

| Collection | Record | Note |
|---|---|---|
| `fornitori` | 245 | Collection principale (usata da `Collections.SUPPLIERS`) |
| `suppliers` | 15 | Legacy — NON usare per nuovi sviluppi |
| `invoices` | 1.405 | Fatture passive ricevute (TD01 + TD04 + TD24) |
| `scadenziario_fornitori` | 185 | Scadenze pagamento |

> **Canonica**: `fornitori` (la classe `Collections.SUPPLIERS` punta a "fornitori")

### 8.2 Note Credito nel Ciclo Passivo
- 29 NC (TD04) nel database
- Parser XML estrae `DatiFattureCollegate` per riferimenti incrociati
- Nel modal Assegni: fatture ordinate per fornitore, NC con segno negativo
- Netting: Fattura + NC selezionate insieme → totale netto = importo assegno

---

## 9. BANCA ED ESTRATTO CONTO

### 9.1 Collections

| Collection | Record | Contenuto |
|---|---|---|
| `estratto_conto_movimenti` | 8.839 | Movimenti bancari |
| `assegni` | 220 | Gestione assegni (con associazione fatture) |
| `prima_nota_banca` | 4.365 | Prima nota banca |

### 9.2 Assegni
- 220 assegni raggruppati per carnet
- Modal associazione fatture: **ordinato per fornitore** con header sticky
- Note credito (TD04) con importo negativo e badge rosso
- Massimo 4 fatture per assegno, solo dello stesso fornitore

### 9.3 Import Estratto Conto
- `POST /api/bank/import-estratto-conto` — CSV BPM, separatore `;`, UTF-8-BOM
- Deduplicazione: `data + importo + descrizione_originale`

---

## 10. DASHBOARD E VOLUME D'AFFARI

### 10.1 KPI Principali

| Indicatore | Fonte | Formula |
|---|---|---|
| Volume d'Affari | `corrispettivi` | SUM(totale_giornata) |
| Costi Fornitore | `invoices` | SUM(total_amount) dove tipo_documento=TD01 |
| Utile Lordo | — | Volume − Costi |
| Saldo IVA | Verifica Coerenza | IVA debito − IVA credito |

---

## 11. STRUTTURA DATABASE

```
Gestionale (MongoDB Atlas — Aprile 2026)
│
├── HR
│   ├── dipendenti (30)              ← CANONICA: anagrafica dipendenti
│   ├── cedolini (301)               ← buste paga (Libro Unico Zucchetti v2)
│   └── presenze (290)               ← presenze giornaliere (da cedolini + PDF)
│
├── CONTABILITA
│   ├── prima_nota_cassa (136)
│   ├── prima_nota_banca (4.365)
│   ├── corrispettivi (54)
│   ├── invoices (1.405)             ← fatture passive SDI (TD01+TD04+TD24)
│   └── piano_conti (30)
│
├── FORNITORI
│   ├── fornitori (245)              ← CANONICA per modulo principale
│   └── scadenziario_fornitori (185)
│
├── BANCA
│   ├── estratto_conto_movimenti (8.839)
│   └── assegni (220)
│
├── NOLEGGIO
│   ├── veicoli_noleggio (4)         ← flotta attiva
│   └── verbali_noleggio (165)       ← verbali con targa/driver/PDF
│
├── MAGAZZINO
│   ├── warehouse_stocks (496)       ← giacenze (USARE QUESTA, non warehouse_inventory)
│   ├── warehouse_movements (788)
│   └── dizionario_prodotti (680)    ← catalogo prodotti da fatture
│
├── EMAIL
│   ├── mittenti_attendibili (11)
│   ├── email_message_index (68)
│   └── documents_inbox (32)
│
└── FISCALE
    └── f24_unificato (1)
```

---

## 12. NOLEGGIO AUTO E VERBALI

### 12.1 Flotta (`veicoli_noleggio`, 4 veicoli)
- HB411GV (BMW X3) — Vincenzo Ceraldi — Leasys
- GW980EP (Mazda) — Antonietta Ceraldi — ARVAL
- GX037HJ (BMW X1) — Valerio Ceraldi — ALD
- GG782PN (Alfa Romeo Stelvio) — Vincenzo Ceraldi — Leasys

### 12.2 Verbali (`verbali_noleggio`, 165 record)
- Scaricati da PEC (notifiche sanzioni CdS)
- Targa estratta da PDF con PyMuPDF
- Driver collegato tramite targa → veicolo → driver
- Stati: salvato (91), pagato (28), fattura_ricevuta (16), identificato (10), pagato_attesa_fattura (10), da_scaricare (7), riconciliato (3)

### 12.3 API Verbali
```
GET  /api/verbali-riconciliazione/dashboard
GET  /api/verbali-riconciliazione/lista
POST /api/verbali-riconciliazione/scan-fatture-verbali
POST /api/verbali-riconciliazione/collega-driver-massivo
POST /api/verbali-riconciliazione/riconcilia/{numero}
GET  /api/verbali-noleggio/pdf/{numero}
```

---

## 13. MAGAZZINO

### 13.1 Collections

| Collection | Record | Uso |
|---|---|---|
| `warehouse_stocks` | 496 | **Giacenze reali** — USARE QUESTA |
| `warehouse_movements` | 788 | Movimenti carico/scarico |
| `dizionario_prodotti` | 680 | Catalogo prodotti da fatture XML |
| `warehouse_inventory` | 0 | VUOTA — non usare |

> ⚠️ `warehouse_inventory` è vuota. Il backend è stato corretto per leggere da `warehouse_stocks`.

### 13.2 API Magazzino
```
GET  /api/products/catalog               → catalogo (da warehouse_stocks)
GET  /api/products/categories             → categorie
GET  /api/products/search?q=...           → ricerca predittiva
```

---

## NOTE CRITICHE PER SVILUPPO

1. **IMAP sempre in thread**: `await asyncio.to_thread(funzione_sync_imap, ...)`
2. **Collection dipendenti**: usare `dipendenti` (30 record), NON `employees`
3. **Collection fornitori**: usare `fornitori` (245 record), NON `suppliers`
4. **Collection magazzino**: usare `warehouse_stocks` (496 record), NON `warehouse_inventory`
5. **DB name**: `Gestionale` (NON `azienda_erp_db`)
6. **Anno corrispettivi**: filtrare per range di `data` (il campo `anno` può mancare)
7. **Design**: CSS inline da `lib/utils.js` per pagine gestionali. NO Tailwind, NO Shadcn
8. **`_id` MongoDB**: escludere sempre con `{"_id": 0}` o via Pydantic
9. **Auth**: disabilitata (`AUTH_DISABLED=true`)
10. **server.py**: NON cancellare — punto di avvio uvicorn via Supervisor
11. **Settings priority**: `.env` > OS env (intenzionale — la piattaforma inietta MONGO_URL locale vuoto)
12. **Cedolini display**: usare `nome_dipendente` (non `dipendente_nome`) per il nome dipendente
13. **Note credito**: `tipo_documento=TD04` → importo negativo nel modal assegni
14. **Prima Nota Sospesa**: `metodo=sospesa` → aggiorna solo fattura, non crea movimento

---

*Aggiornato: Aprile 2026 — Sessione di fix incoerenze e logica*
