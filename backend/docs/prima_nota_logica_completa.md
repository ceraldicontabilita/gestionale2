# Prima Nota — Logica Completa, Endpoint, Router, Collezioni
## Ceraldi ERP · Documento tecnico aggiornato al 17 Marzo 2026

---

## INDICE
1. [Architettura Generale](#1-architettura-generale)
2. [Prima Nota CASSA](#2-prima-nota-cassa)
3. [Prima Nota BANCA](#3-prima-nota-banca)
4. [Estratto Conto Movimenti (sorgente principale banca)](#4-estratto-conto-movimenti)
5. [Regole di Business e Classificazione](#5-regole-di-business)
6. [Calcolo Saldi](#6-calcolo-saldi)
7. [Import CSV Estratto Conto](#7-import-csv)
8. [Frontend — Componente PrimaNota.jsx](#8-frontend)
9. [Tabella Riepilogo API](#9-tabella-riepilogo-api)

---

## 1. ARCHITETTURA GENERALE

La pagina **Prima Nota** (`/prima-nota`) contiene due sezioni distinte:

| Sezione | Fonte dati | Cosa rappresenta |
|---|---|---|
| **CASSA** | `prima_nota_cassa` | Movimenti di denaro **contante** (corrispettivi, POS manuali, versamenti) |
| **BANCA** | `estratto_conto_movimenti` | Movimenti del **conto bancario** BPM (importati via CSV estratto conto) |

> ⚠️ **IMPORTANTE — Principio contabile:**
> I **RICAVI REALI** dell'azienda si trovano nei **Corrispettivi** (sezione Cassa).
> La sezione Banca mostra il flusso del conto corrente bancario (accrediti + addebiti),
> che NON equivale ai ricavi perché include anche finanziamenti, bonifici interni, ecc.

---

## 2. PRIMA NOTA CASSA

### 2.1 Collezione MongoDB

**Collection:** `prima_nota_cassa`
**Database:** `azienda_erp_db`

#### Schema documento
```json
{
  "id": "uuid-stringa",
  "data": "YYYY-MM-DD",
  "tipo": "entrata | uscita",
  "importo": 100.00,
  "descrizione": "Corrispettivi del giorno",
  "categoria": "Corrispettivi",
  "riferimento": "opzionale",
  "fornitore_piva": "opzionale",
  "fattura_id": "uuid fattura collegata (opzionale)",
  "note": "opzionale",
  "source": "corrispettivi_sync | csv_import | manual | sync_fatture",
  "anno": 2025,
  "created_at": "ISO datetime",
  "status": "active | deleted | archived",
  "entity_status": "active | deleted"
}
```

#### Categorie predefinite CASSA
- `Corrispettivi` — ricavi giornalieri (da chiusura registratore di cassa)
- `Pagamento fornitore` — pagamento in contanti a fornitore
- `Incasso cliente` — pagamento contante da cliente
- `Prelievo` — prelievo di cassa
- `Versamento` — versamento contante in banca
- `Spese generali` — spese varie in contanti
- `Finanziamento soci` — apporto soci in contanti
- `Altro`

#### Source dei movimenti
| source | Origine |
|---|---|
| `corrispettivi_sync` | Sincronizzato automaticamente dai corrispettivi giornalieri |
| `sync_fatture` | Inserito automaticamente da una fattura pagata in contanti |
| `csv_import` | Importato da file CSV (estratto conto — ⚠️ non dovrebbe stare in cassa) |
| `manual` / `user` / `null` | Inserito manualmente dall'utente |

#### Categorie ESCLUSE dai conteggi
```python
CATEGORIE_ESCLUSE = ["POS_DUPLICATO"]
```

---

### 2.2 Router e Prefix

**File router:** `/app/app/routers/prima_nota_module/__init__.py`
**Registrato in main.py con prefix:** `/api/prima-nota`

---

### 2.3 API Endpoints — CASSA

| Metodo | Endpoint | Descrizione |
|---|---|---|
| `GET` | `/api/prima-nota/cassa` | Lista movimenti cassa con saldi |
| `POST` | `/api/prima-nota/cassa` | Crea nuovo movimento cassa |
| `PUT` | `/api/prima-nota/cassa/{id}` | Modifica movimento cassa |
| `DELETE` | `/api/prima-nota/cassa/{id}` | Elimina movimento cassa (soft delete) |
| `DELETE` | `/api/prima-nota/cassa/delete-all` | Elimina TUTTI i movimenti cassa |
| `DELETE` | `/api/prima-nota/cassa/delete-by-source/{source}` | Elimina per source |
| `GET` | `/api/prima-nota/cassa/analisi-movimenti-bancari-errati` | Analizza movimenti bancari erroneamente in cassa |
| `DELETE` | `/api/prima-nota/cassa/elimina-movimenti-bancari-errati` | Rimuove movimenti bancari da cassa |
| `POST` | `/api/prima-nota/cassa/sync-corrispettivi` | Sincronizza corrispettivi → cassa |
| `POST` | `/api/prima-nota/cassa/sync-fatture-pagate` | Sincronizza fatture pagate → cassa |
| `GET` | `/api/prima-nota/cassa/{id}/fattura` | Recupera fattura collegata a movimento |

#### Parametri GET `/api/prima-nota/cassa`
```
anno         int     (es. 2025, 2026)
data_da      string  YYYY-MM-DD
data_a       string  YYYY-MM-DD
tipo         string  entrata | uscita
categoria    string  filtro categoria
skip         int     default 0
limit        int     default 100, max 10000
```

#### Risposta GET `/api/prima-nota/cassa`
```json
{
  "movimenti": [...],
  "saldo": 14361.17,
  "saldo_anno": 14361.17,
  "saldo_precedente": 0.0,
  "totale_entrate": 14361.17,
  "totale_uscite": 0.0,
  "count": 347,
  "anno": 2026
}
```

| Campo | Significato |
|---|---|
| `totale_entrate` | Somma entrate SOLO per l'anno selezionato |
| `totale_uscite` | Somma uscite SOLO per l'anno selezionato |
| `saldo_anno` | Entrate - Uscite dell'anno selezionato |
| `saldo_precedente` | Saldo cumulativo tutti gli anni precedenti |
| `saldo` | Saldo finale = saldo_precedente + saldo_anno |

---

### 2.4 File sorgente Cassa

```
/app/app/routers/prima_nota_module/
├── __init__.py       ← Router principale (registra tutte le routes)
├── cassa.py          ← Logica CRUD Prima Nota Cassa
├── banca.py          ← Logica CRUD Prima Nota Banca (secondaria)
├── common.py         ← Costanti, nomi collezioni, helper calcola_saldo_anni_precedenti
├── sync.py           ← Sincronizzazione corrispettivi e fatture → prima nota
└── manutenzione.py   ← Utility di pulizia dati
```

---

## 3. PRIMA NOTA BANCA

> ⚠️ **Nota tecnica importante:** Esistono DUE collezioni per i dati bancari:
> - `prima_nota_banca` → collezione storica/secondaria, usata meno
> - `estratto_conto_movimenti` → **FONTE PRINCIPALE** per la sezione Banca in Prima Nota
>
> Il frontend legge da `estratto_conto_movimenti` tramite `/api/estratto-conto-movimenti/movimenti`

### 3.1 Collezione `prima_nota_banca` (secondaria)

**Collection:** `prima_nota_banca`

#### Schema documento
```json
{
  "id": "uuid",
  "data": "YYYY-MM-DD",
  "tipo": "entrata | uscita",
  "importo": 1234.56,
  "descrizione": "Pagamento fornitore XYZ",
  "categoria": "Pagamento fornitore",
  "riferimento": "fattura-001",
  "fornitore_piva": "12345678901",
  "fattura_id": "uuid fattura",
  "iban": "IT60...",
  "conto_bancario": "IT60...",
  "note": "opzionale",
  "source": "sync_fatture | manual",
  "pos_details": {...},
  "created_at": "ISO datetime",
  "status": "active | deleted"
}
```

#### API Endpoints `prima_nota_banca`
| Metodo | Endpoint | Descrizione |
|---|---|---|
| `GET` | `/api/prima-nota/banca` | Lista movimenti banca (secondaria) con saldi |
| `POST` | `/api/prima-nota/banca` | Crea movimento banca (secondaria) |
| `PUT` | `/api/prima-nota/banca/{id}` | Modifica movimento |
| `DELETE` | `/api/prima-nota/banca/{id}` | Elimina movimento (soft delete) |
| `DELETE` | `/api/prima-nota/banca/delete-all` | Elimina tutti |
| `DELETE` | `/api/prima-nota/banca/delete-by-source/{source}` | Elimina per source |

---

## 4. ESTRATTO CONTO MOVIMENTI

### 4.1 Collezione `estratto_conto_movimenti` (PRINCIPALE)

**Collection:** `estratto_conto_movimenti`
**File router:** `/app/app/routers/bank/estratto_conto.py`
**Prefix:** `/api/estratto-conto-movimenti`

Questa è la **fonte primaria** per la sezione "BANCA" nella pagina Prima Nota.
I dati vengono importati tramite il file CSV dell'estratto conto BPM.

#### Schema documento
```json
{
  "id": "EC-YYYY-MM-DD-importo-fingerprint8",
  "data": "YYYY-MM-DD",
  "ragione_sociale": "Nome banca/azienda",
  "fornitore": "Nome fornitore estratto dalla descrizione",
  "importo": 100.00,
  "categoria": "Ricavi - Incasso tramite POS-Carte di credito",
  "descrizione_originale": "INC.POS CARTE CREDIT - NUMIA...",
  "descrizione": "testo pulito",
  "descrizione_hash": "primi 50 caratteri",
  "banca": "BPM",
  "rapporto": "numero rapporto bancario",
  "divisa": "EUR",
  "tipo": "entrata | uscita",
  "fingerprint": "md5 hash per deduplicazione",
  "riconciliato": false,
  "fattura_id": "uuid fattura riconciliata (opzionale)",
  "dettagli_riconciliazione": {...},
  "created_at": "ISO datetime"
}
```

#### Categorie principali in estratto conto
| Categoria | Tipo | Significato |
|---|---|---|
| `Ricavi - Incasso tramite POS-Carte di credito` | entrata | Pagamenti con carta dal POS |
| `Ricavi - Incasso tramite POS` | entrata | Pagamenti POS generici |
| `Ricavi - Deposito contanti` | entrata | Versamento contante in banca |
| `Ricavi - Ricavi dalle vendite` | entrata | Vendite varie |
| `Ricavi - Generico` | entrata | Entrate generiche |
| `Fornitori - Generico` | uscita | Pagamento fornitore |
| `Tasse - Imposte e contributi` | uscita | F24, I24, tasse (ex "tasse" male classificate) |
| `Operazioni Finanziarie - Commissioni` | uscita | Commissioni bancarie |
| `altro` | entrata/uscita | Non classificato (richiede revisione manuale) |

> ⚠️ **Nota sulla categoria "altro":** Contiene movimenti senza descrizione (`"Movimento estratto conto"`)
> provenienti da import vecchi. Tra questi, un bonifico in entrata da **€509.202,32** del 01/04/2025
> e altri bonifici non identificati. Richiedono revisione manuale per classificazione corretta.

---

### 4.2 API Endpoints `estratto_conto_movimenti`

| Metodo | Endpoint | Descrizione |
|---|---|---|
| `GET` | `/api/estratto-conto-movimenti/movimenti` | Lista movimenti banca con saldi per anno |
| `POST` | `/api/estratto-conto-movimenti/import` | Import CSV estratto conto BPM |
| `GET` | `/api/estratto-conto-movimenti/categorie` | Lista categorie disponibili |
| `GET` | `/api/estratto-conto-movimenti/stats` | Statistiche generali |
| `PUT` | `/api/estratto-conto-movimenti/movimenti/{id}` | Modifica movimento |
| `DELETE` | `/api/estratto-conto-movimenti/movimenti/{id}` | Elimina movimento |
| `POST` | `/api/estratto-conto-movimenti/riconcilia-automaticamente` | Riconciliazione automatica fatture |

#### Parametri GET `/api/estratto-conto-movimenti/movimenti`
```
anno         int     filtra per anno (es. 2025, 2026)
mese         int     filtra per mese (1-12)
categoria    string  filtra per categoria (regex case-insensitive)
fornitore    string  filtra per fornitore (regex)
tipo         string  entrata | uscita
limit        int     default 500, max 10000
offset       int     default 0
```

#### Risposta GET `/api/estratto-conto-movimenti/movimenti`
```json
{
  "movimenti": [...],
  "totale": 3128,
  "offset": 0,
  "limit": 500,
  "totale_entrate": 1887190.98,
  "totale_uscite": 913562.07,
  "saldo_anno": 973628.91,
  "saldo_precedente": -14650.82,
  "saldo": 958978.09,
  "anno": 2025
}
```

| Campo | Significato |
|---|---|
| `totale` | N. totale movimenti (per paginazione) |
| `totale_entrate` | Somma accrediti SOLO anno selezionato |
| `totale_uscite` | Somma addebiti SOLO anno selezionato |
| `saldo_anno` | Accrediti - Addebiti dell'anno selezionato |
| `saldo_precedente` | Saldo cumulativo tutti gli anni prima dell'anno selezionato |
| `saldo` | Saldo complessivo = saldo_precedente + saldo_anno |

---

## 5. REGOLE DI BUSINESS

### 5.1 Distinzione Cassa / Banca

| Movimento | Va in | Motivo |
|---|---|---|
| Chiusura corrispettivi (scontrino) | **CASSA** | Ricavo contante e POS |
| Versamento contante in banca | **CASSA** (uscita) | Esce dalla cassa fisica |
| POS accreditato sul conto | **BANCA** (entrata) | Entra nel c/c |
| Pagamento fornitore con bonifico | **BANCA** (uscita) | Esce dal c/c |
| Pagamento fornitore in contanti | **CASSA** (uscita) | Esce dalla cassa fisica |
| F24 / Tasse | **BANCA** (uscita) | Sempre bancari |
| Stipendi con bonifico | **BANCA** (uscita) | Sempre bancari |

### 5.2 Keywords movimenti BANCARI (NON ammessi in Cassa)
Il sistema blocca l'inserimento in Cassa di movimenti con queste keywords:
```
BONIFICO, BONIF., SEPA, SDD, RID, ADDEBITO DIRETTO,
INC.POS CARTE CREDIT, INCAS. TRAMITE P.O.S, NUMIA, NEXI,
F24, DELEGA UNICA, COMMISSIONI BANCARIE, IMPOSTA BOLLO
```

### 5.3 Classificazione tipo (entrata/uscita) nell'import
All'import CSV, la classificazione avviene così:
1. `importo < 0` → **uscita**
2. `importo > 0` → **entrata**
3. Descrizione contiene `DISPOSIZIONE`, `VS.DISP`, `ADD.TOT` → forzato **uscita**
4. Descrizione contiene `I24 AGENZIA ENTRATE`, `PAG.*TELEMATICO` → forzato **uscita** (tasse)

---

## 6. CALCOLO SALDI

### 6.1 Formula generale (uguale per Cassa e Banca)

```python
async def calcola_saldo_anni_precedenti(db, collection, anno):
    # Somma tutti i movimenti con data < anno-01-01
    # Restituisce: sum(entrate) - sum(uscite) degli anni precedenti
    pass

saldo_anno = totale_entrate_anno - totale_uscite_anno
saldo_precedente = calcola_saldo_anni_precedenti(...)
saldo_finale = saldo_precedente + saldo_anno
```

### 6.2 Esempio numerico — Anno 2026 (al 17/03/2026)

**CASSA 2026:**
- Entrate (corrispettivi): €14.361,17
- Uscite: €0,00
- Saldo 2026: €14.361,17
- Riporto anni precedenti: €0,00
- Saldo cumulativo: €14.361,17

**BANCA 2026 (estratto conto BPM):**
- Accrediti gen-17 mar 2026: €225.799,77
- Pagamenti gen-17 mar 2026: €220.976,10
- Saldo banca 2026: €4.823,67
- Riporto al 31/12/2025: €958.978,09
- Saldo cumulativo: €963.801,76

### 6.3 Esempio numerico — Anno 2025

**BANCA 2025 (estratto conto BPM):**
- Accrediti totali: €1.887.190,98
  - di cui POS carte: €482.521,34
  - di cui depositi contanti: €295.620,00
  - di cui POS generici: €87.976,88
  - di cui **"altro" non classificato**: €976.734,83 ← da rivedere manualmente
- Pagamenti totali: €913.562,07
- Saldo banca 2025: €973.628,91
- Riporto anni prec. (al 31/12/2024): €-14.650,82
- Saldo cumulativo fine 2025: €958.978,09

---

## 7. IMPORT CSV ESTRATTO CONTO

### 7.1 Formato CSV atteso (BPM)

**Separatore:** `;` (punto e virgola)
**Encoding:** UTF-8-BOM
**Quote:** doppi apici `"` intorno ai campi

**Colonne:**
```
"Ragione Sociale";"Data contabile";"Data valuta";"Banca";"Rapporto";
"Importo";"Divisa";"Descrizione";"Categoria/sottocategoria";"Hashtag"
```

**Formato data:** `DD/MM/YYYY`
**Formato importo:** italiano con `.` migliaia e `,` decimali (es. `1.234,56` o `-399,05`)

### 7.2 Logica di De-duplicazione

L'import controlla duplicati tramite:
1. **Fingerprint MD5:** `MD5("{data_iso}|{importo:.2f}|{descrizione}")`
2. **Query multi-campo:** controlla sia `descrizione` che `descrizione_originale`
   (i record storici hanno `descrizione` vuota ma `descrizione_originale` popolata)

```python
# Controllo duplicati — query MongoDB
existing = await db["estratto_conto_movimenti"].find_one({
    "$or": [
        {"fingerprint": fingerprint},
        {"id": mov_id},
        {"data": data_str, "importo": importo_abs, "descrizione_originale": desc_raw},
        {"data": data_str, "importo": importo_abs, "descrizione": desc_raw}
    ]
})
```

### 7.3 Stato DB dopo import 17/03/2026

| Anno | Record |
|---|---|
| 2026 | 470 |
| 2025 | 3.128 |
| 2024 | 881 |
| 2023 | 77 |
| 2022 | 114 |
| 2021 | 33 |
| 2020 | 1 |
| **TOTALE** | **4.704** |

**Ultimo import:** `ElencoEntrateUsciteAndamento_17-03-2026_06.35.38.csv`
- File contenente dati storici 2025-2026 esportati da BPM
- 1.255 nuovi movimenti inseriti, 2.145 duplicati saltati

### 7.4 Endpoint Import

```
POST /api/estratto-conto-movimenti/import
Content-Type: multipart/form-data
Body: file=@estratto_conto.csv
```

**Risposta:**
```json
{
  "message": "Import completato",
  "movimenti_trovati": 3400,
  "inseriti": 1255,
  "duplicati_saltati": 2145,
  "riconciliazione_automatica": {...}
}
```

---

## 8. FRONTEND — Componente PrimaNota.jsx

**File:** `/app/frontend/src/pages/PrimaNota.jsx`
**Route:** `/prima-nota`

### 8.1 Struttura componente

```
PrimaNota (pagina principale)
├── Selettore anno (dropdown)
├── Tab CASSA {anno}  ←→  Tab BANCA {anno}
│
├── SEZIONE CASSA
│   ├── MiniCard: Entrate (DARE) {anno}
│   ├── MiniCard: Uscite (AVERE) {anno}
│   ├── MiniCard: Saldo {anno}
│   ├── MiniCard: Riporto Anni Prec. (se != 0)
│   ├── MiniCard: Saldo Cumulativo (se != 0)
│   └── MovementsTable (tabella filtrata)
│
└── SEZIONE BANCA
    ├── SummaryCard: Accrediti {anno}       ← "Accrediti bancari (POS+bonifici+altro)"
    ├── SummaryCard: Pagamenti {anno}       ← "Addebiti (fornitori, tasse, stipendi)"
    ├── SummaryCard: Saldo Banca {anno}
    ├── SummaryCard: Saldo Cumulativo
    ├── SummaryCard: Riporto Anni Prec.
    ├── Nota contabile gialla (⚠️ ricavi reali = corrispettivi, non accrediti banca)
    ├── Filtri mese (Gen-Dic + Tutti)
    └── MovementsTable (tabella filtrata)
```

### 8.2 Filtri disponibili nella tabella

| Filtro | Tipo | Note |
|---|---|---|
| Descrizione | Testo libero | Case-insensitive |
| Categoria | Dropdown | Valori unici presenti nei movimenti |
| DARE + AVERE | Dropdown | Filtra per tipo (entrata/uscita) |
| Data Da | Date picker | `YYYY-MM-DD` |
| Data A | Date picker | `YYYY-MM-DD` |
| Importo Min | Numerico | € minimo assoluto |
| Importo Max | Numerico | € massimo assoluto |

Tutti i filtri sono **client-side** (dati già caricati), si combinano con AND logico.
Pulsante "Reset filtri" appare solo se almeno un filtro è attivo.

### 8.3 Chiamate API dal frontend (PrimaNota.jsx)

```javascript
// Dati CASSA
GET /api/prima-nota/cassa?anno={selectedYear}&limit=10000

// Dati BANCA (estratto conto movimenti)
GET /api/estratto-conto-movimenti/movimenti?anno={selectedYear}&limit=10000

// Anni disponibili
GET /api/prima-nota/anni-disponibili
```

---

## 9. TABELLA RIEPILOGO API

### Prima Nota — prefix `/api/prima-nota`

| Metodo | Path | Descrizione |
|---|---|---|
| GET | `/cassa` | Lista movimenti cassa + saldi anno/cumulativo |
| POST | `/cassa` | Crea movimento cassa (solo contante) |
| PUT | `/cassa/{id}` | Modifica movimento cassa |
| DELETE | `/cassa/{id}` | Elimina movimento cassa |
| DELETE | `/cassa/delete-all` | Elimina tutti i movimenti cassa |
| DELETE | `/cassa/delete-by-source/{source}` | Elimina per source |
| GET | `/cassa/analisi-movimenti-bancari-errati` | Analisi movimenti bancari erroneamente in cassa |
| DELETE | `/cassa/elimina-movimenti-bancari-errati` | Rimuove movimenti bancari da cassa |
| POST | `/cassa/sync-corrispettivi` | Sincronizza corrispettivi → cassa |
| POST | `/cassa/sync-fatture-pagate` | Sincronizza fatture pagate in contanti → cassa |
| GET | `/cassa/{id}/fattura` | Fattura collegata a un movimento cassa |
| GET | `/banca` | Lista movimenti banca secondaria + saldi |
| POST | `/banca` | Crea movimento banca secondaria |
| PUT | `/banca/{id}` | Modifica movimento banca |
| DELETE | `/banca/{id}` | Elimina movimento banca |
| GET | `/anni-disponibili` | Anni con movimenti registrati |
| GET | `/stats` | Statistiche globali prima nota |
| GET | `/saldo-finale` | Saldo finale generale |
| POST | `/sync-corrispettivi` | Sync globale corrispettivi |
| POST | `/import-batch` | Import batch movimenti |
| POST | `/sposta-movimento` | Sposta movimento da cassa a banca o viceversa |

### Estratto Conto — prefix `/api/estratto-conto-movimenti`

| Metodo | Path | Descrizione |
|---|---|---|
| GET | `/movimenti` | Lista movimenti bancari + saldi + saldo_precedente |
| POST | `/import` | Import CSV estratto conto BPM (multipart/form-data) |
| GET | `/categorie` | Lista categorie distinte |
| GET | `/stats` | Statistiche generali |
| PUT | `/movimenti/{id}` | Modifica movimento |
| DELETE | `/movimenti/{id}` | Elimina movimento |
| POST | `/riconcilia-automaticamente` | Riconciliazione automatica con fatture |

---

## NOTE FINALI

### Correzioni effettuate il 17/03/2026

1. **Fix classificazione I24:** 47 movimenti "I24 AGENZIA ENTRATE - PAG.TO TELEMATICO" erano classificati come `entrata` ma sono pagamenti fiscali → corretti a `uscita` (categoria: "Tasse - Imposte e contributi")

2. **Fix de-duplicazione import:** La logica di fingerprint ora controlla sia `descrizione` che `descrizione_originale` per gestire correttamente i record storici che hanno `descrizione` vuota

3. **Label UI rinominati:** In BANCA "Entrate" → "Accrediti", "Uscite" → "Pagamenti" per evitare confusione con i ricavi

4. **Nota contabile:** Aggiunta nota gialla nella sezione BANCA che spiega la distinzione tra accrediti bancari e ricavi reali (corrispettivi)

### Movimenti "altro" da rivedere

I 64 movimenti con categoria `altro` e descrizione `"Movimento estratto conto"` (totale ~€976K per il 2025) non hanno descrizione perché provengono da import precedenti con formato diverso. Tra questi:
- **€509.202,32 del 01/04/2025** — bonifico di grande importo non identificato
- Vari bonifici da €10K-€25K mensili

Richiedono **revisione manuale** per classificazione corretta (potrebbero essere: finanziamenti, liquidità da altra banca, incassi straordinari, ecc.)

---

*Documento generato automaticamente dal sistema ERP Ceraldi — 17 Marzo 2026*
