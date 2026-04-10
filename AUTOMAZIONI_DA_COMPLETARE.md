# 🚀 Automazioni da Completare — Ceraldi ERP
## Cosa manca, come funzionano i parser già scritti, e cosa deve fare ogni automazione

---

> Questo documento descrive **in dettaglio operativo** le automazioni ancora da implementare.
> Per ogni funzionalità: cosa già esiste nel codice, cosa estrae il parser, dove vanno i dati,
> e cosa deve succedere passo per passo.

---

## 1. 📒 PRIMA NOTA AUTOMATICA SENZA CONFERMA MANUALE

### Problema attuale
Quando una fattura viene importata, la Prima Nota viene "preparata" ma non scritta.
L'utente deve andare nella fattura, cliccare "conferma pagamento", e solo allora il movimento appare.
Questo è un collo di bottiglia: se ci sono 30 fatture, devi fare 30 click.

### Come funziona già il codice
Il file `app/routers/prima_nota_module/sync.py` ha già la funzione `registra_pagamento_fattura()` che:
- Determina se la fattura è un'uscita (fornitore) o entrata (nota credito, fattura attiva)
- Decide se scrivere in `prima_nota_cassa` (metodo: cassa/contanti) o `prima_nota_banca` (metodo: bonifico/assegno/SEPA)
- Costruisce il movimento con tutti i campi già pronti

Il file `app/routers/sync_relazionale.py` ha `sync_fattura_to_prima_nota()` che fa lo stesso in modo alternativo.

### Cosa va implementato
**Trigger automatico al pagamento confermato**, non all'import.

**Flusso corretto:**
1. Fattura importata → stato `provvisoria`, nessuna scrittura contabile
2. Estratto conto importato → matching automatico trova la fattura
3. Match confermato (automaticamente se confidenza >90%, altrimenti proposto) → **in quel momento** si scrive in Prima Nota
4. Fattura aggiornata: `pagato: true`, `data_pagamento: data_addebito_banca`, `riconciliato: true`

**Scrittura in Prima Nota Banca:**
```
tipo: "uscita"
importo: fattura.importo_totale
descrizione: "Pagamento fattura {numero} - {fornitore}"
categoria: "Fornitori"
riferimento: fattura.id
fornitore_piva: fattura.fornitore_partita_iva
data: data_addebito_estratto_conto
```

**Scrittura in Prima Nota Cassa (se pagamento contanti):**
Stessa struttura ma in `prima_nota_cassa`.

**Dove lo vedi dopo:**
- Fatture → colonna "Pagata" = ✅ con data
- Prima Nota → movimento visibile immediatamente
- Riconciliazione → abbinamento chiuso
- Scadenze → scadenza segnata come saldata

---

## 2. 🔍 PIANO DEI CONTI CLICCABILE — PARTITARIO PER CONTO

### Problema attuale
Il Piano dei Conti (`/contabilita/piano-conti`) mostra la lista dei conti ma cliccandoci non succede nulla. È una lista morta.

### Cosa già esiste
- `app/routers/chart_of_accounts.py` → CRUD conti, lista per tipo (attivo/passivo/costi/ricavi)
- `app/repositories/chart_repository.py` → accesso MongoDB
- `app/services/chart_service.py` → logica business

### Cosa va aggiunto — backend
Nuovo endpoint: `GET /api/piano-conti/{account_id}/partitario`

Deve restituire:
```json
{
  "conto": { "codice": "6.01.01", "nome": "Merci e materie prime", "tipo": "costi" },
  "movimenti": [
    {
      "data": "2025-03-15",
      "tipo": "uscita",
      "importo": 1240.00,
      "descrizione": "Fattura 123 - Fornitore XYZ",
      "documento_id": "...",
      "documento_tipo": "fattura",
      "saldo_progressivo": 8450.00
    }
  ],
  "totale_dare": 12000.00,
  "totale_avere": 3550.00,
  "saldo": 8450.00,
  "per_mese": { "2025-01": 1200, "2025-02": 2300, ... }
}
```

La query va su `prima_nota_banca`, `prima_nota_cassa`, `prima_nota_salari`, `invoices` filtrate per `centro_costo_id` o `categoria_bilancio` che corrisponde al conto.

### Cosa va aggiunto — frontend
In `PianoDeiConti.jsx`: ogni riga conto diventa cliccabile. Al click si apre un pannello laterale (drawer) o una pagina `/contabilita/piano-conti/{id}` con:
- Intestazione conto (codice, nome, tipo)
- Tabella movimenti con colonne: Data, Documento, Descrizione, Dare, Avere, Saldo progressivo
- Totali in fondo
- Grafico mensile (barre)
- Link a ogni documento nella riga (fattura, cedolino, ecc.)

---

## 3. 🏢 FORNITORI CLICCABILI — SCHEDA COMPLETA

### Problema attuale
La lista fornitori mostra nome, P.IVA, metodo pagamento. Cliccando non si vede nulla di aggregato.

### Cosa già esiste
- `app/routers/fornitori_learning.py` → keywords, pattern pagamento fornitore
- `app/routers/scadenzario_fornitori.py` → scadenze per fornitore
- `app/routers/fatture_module/crud.py` → fatture filtrate per fornitore_id

### Cosa va aggiunto — backend
Endpoint: `GET /api/fornitori/{fornitore_id}/scheda`

Aggrega in un'unica chiamata:
```json
{
  "anagrafica": { "ragione_sociale", "piva", "iban", "metodo_pagamento", ... },
  "fatture": [ lista fatture ordinate per data ],
  "totale_fatturato": 45200.00,
  "totale_pagato": 38000.00,
  "totale_da_pagare": 7200.00,
  "scadenze_aperte": [ lista scadenze ],
  "pattern_pagamento": { "tipo": "mensile", "avg_days": 30, "confidence": 0.9 },
  "ultima_fattura": "2025-03-10",
  "categorie_acquisto": ["Alimentari", "Packaging"],
  "centro_costo_prevalente": "Rosticceria"
}
```

### Cosa va aggiunto — frontend
In `Fornitori.jsx`: click sul nome fornitore apre scheda con:
- Dati anagrafici + IBAN + metodo pagamento
- KPI: totale fatturato anno, pagato, da pagare
- Tabella fatture (cliccabili → aprono la fattura)
- Scadenze aperte
- Pattern pagamento imparato dalla Learning Machine
- Grafico acquisti mensili

---

## 4. 🧾 FATTURE CLICCABILI — DETTAGLIO COMPLETO

### Problema attuale
La lista fatture mostra i dati principali ma non ha un dettaglio con righe, PDF, movimenti collegati.

### Cosa va aggiunto — backend
Endpoint: `GET /api/fatture/{fattura_id}/dettaglio`

```json
{
  "fattura": { tutti i campi },
  "righe": [ { "descrizione", "quantita", "prezzo_unitario", "iva", "importo" } ],
  "allegato_pdf": "disponibile",
  "movimenti_prima_nota": [ { "data", "tipo", "importo", "collection" } ],
  "movimento_bancario": { "data_addebito", "iban_destinatario", "descrizione_banca" },
  "scadenza": { "data", "importo", "pagata" },
  "carico_magazzino": [ righe caricate in giacenza ],
  "nota_credito": { "id", "importo" } // se presente
}
```

### Cosa va aggiunto — frontend
Click sulla fattura apre pagina `/fatture/{id}` con:
- Header: fornitore, numero, data, importo, stato
- Tab "Righe": tabella con ogni riga della fattura
- Tab "Contabilità": prima nota collegata, movimento bancario abbinato
- Tab "Magazzino": carichi generati
- Tab "PDF": visualizzatore PDF in-page (già esiste in MongoDB)
- Bottone "Segna come pagata" se non ancora riconciliata

---

## 5. 👤 DIPENDENTI CLICCABILI — FASCICOLO DIPENDENTE

### Problema attuale
La lista dipendenti mostra dati anagrafici. Non c'è una scheda con lo storico completo.

### Cosa già esiste
I parser hanno già estratto e salvato tutto:
- `payslip_parser_v2.py` → netto, lordo, IRPEF, INPS, ferie, TFR, periodo
- `payslip_giustificativi_parser.py` → giustificativi: FE=Ferie, RL=ROL, MA=Malattia, AI=Assenza, PE=Permesso, CP=Congedo parentale, L1=Legge 104, SM=Smart Working, IN=Infortunio
- `busta_paga_multi_template.py` → 4 formati diversi (CSC Napoli fino 2018, Zucchetti classico 2018-2022, Zucchetti nuovo dal 2022, Teamsystem)
- `tfr.py` → calcolo quota annuale (retribuzione/13.5), rivalutazione 1.5%+75% ISTAT, storico accantonamenti e liquidazioni

### Cosa va aggiunto — backend
Endpoint: `GET /api/dipendenti/{dipendente_id}/fascicolo`

```json
{
  "anagrafica": { "nome", "cf", "iban_cedolino", "data_assunzione", "contratto", "paga_base" },
  "cedolini": [
    {
      "mese": 3, "anno": 2025,
      "netto": 1450.00, "lordo": 2100.00,
      "irpef": 380.00, "inps_dipendente": 189.00,
      "ferie_residue": 12, "permessi_rol": 8,
      "tipo": "mensile" // o "tredicesima", "quattordicesima", "acconto"
    }
  ],
  "presenze_mese_corrente": { "giorni_presenti": 20, "ferie": 2, "malattia": 0 },
  "giustificativi_anno": { "FER": 18, "ROL": 8, "MAL": 0, "CP": 0 },
  "tfr": {
    "accantonato_totale": 8240.00,
    "per_anno": { "2023": 1800, "2024": 1950, "2025": 487 },
    "liquidazioni": []
  },
  "progressivi_anno_corrente": {
    "irpef_progressivo": 1140.00,
    "inps_progressivo": 567.00
  },
  "stipendi_erogati": [ { "mese", "importo", "data_bonifico", "riconciliato" } ],
  "bonifici_abbinati": [ { "data", "importo", "descrizione_banca" } ]
}
```

### Cosa va aggiunto — frontend
In `HRDipendenti.jsx`: click su dipendente apre fascicolo con:
- Dati anagrafici + contratto
- Timeline cedolini (barre mensili con netto)
- Saldi correnti ferie/ROL/malattia
- Stato TFR maturato
- Storico stipendi erogati con abbinamento bancario
- Giustificativi usati nell'anno corrente

---

## 6. ❓ RISPOSTA AUTOMATICA "AVVISO BONARIO GIÀ PAGATO?"

### Problema attuale
Arriva un avviso bonario dall'Agenzia delle Entrate. L'utente non sa se è già stato pagato.
Bisogna andare a cercare a mano nell'archivio F24.

### Cosa già esiste — parser F24
Il `f24_parser.py` estrae da ogni F24:
- `scadenza`: data pagamento (formato DD/MM/YYYY)
- `codice_fiscale`: del contribuente
- `contribuente`: ragione sociale (cerca "CERALDI GROUP S.R.L.")
- `banca`: banca di addebito (BANCO BPM, UNICREDIT, ecc.)
- `tributi_erario[]`: lista tributi con campi:
  - `codice_tributo` (es. 1001=IRPEF, 1030=Addiz.Comunale, 6001=IVA gen., 4001=IRAP)
  - `mese_riferimento` (MMYYYY o MM/YYYY)
  - `anno_riferimento`
  - `importo_debito`
  - `importo_credito`
- `tributi_inps[]`: contributi INPS per periodo
- `tributi_regioni[]`: addizionali regionali
- `totale_debito`, `totale_credito`, `saldo_finale`

### Cosa va implementato

**Endpoint backend:** `GET /api/f24/verifica-tributo`
```
?codice_tributo=1001&anno=2024&mese=06
```
Risposta:
```json
{
  "trovato": true,
  "f24_id": "...",
  "data_pagamento": "16/07/2024",
  "importo": 1240.00,
  "banca": "BANCO BPM",
  "movimento_bancario": {
    "data": "2024-07-16",
    "importo": 1240.00,
    "descrizione": "F24 TRIBUTI",
    "riconciliato": true
  }
}
```

**Endpoint "avviso bonario":** `POST /api/f24/verifica-avviso`
Riceve: tipo tributo, anno, periodo, importo indicato nell'avviso
Risponde: se trovato nel DB, mostra data pagamento e movimento bancario abbinato. Se non trovato, propone di creare la scadenza.

**Frontend:** In Strumenti o in una sezione F24, un campo di ricerca: "Inserisci il codice tributo e l'anno" → risposta immediata se pagato o no.

---

## 7. 🔄 TFR AUTOMATICO DA CEDOLINO

### Problema attuale
Il TFR viene aggiornato solo se si chiama esplicitamente l'endpoint `/api/tfr/accantonamento`.
L'import del cedolino non lo aggiorna automaticamente.

### Cosa già esiste
Il `payslip_parser_v2.py` e `busta_paga_multi_template.py` estraggono:
- Quota TFR del mese (campo `tfr_quota_mese`)
- TFR maturato totale al mese di riferimento
- Rivalutazione applicata

Il router `tfr.py` ha:
- `registra_accantonamento_tfr()` → calcola quota annuale (retribuzione/13.5), rivalutazione (1.5% fisso + 75% ISTAT), aggiorna il totale TFR del dipendente, registra movimento contabile

### Cosa va implementato
Nel flusso di import cedolino, dopo il salvataggio, aggiungere la chiamata automatica a `registra_accantonamento_tfr()` con i dati estratti dal PDF:
- dipendente_id
- anno e mese di riferimento
- importo quota TFR del mese (se estratto dal PDF)
- altrimenti calcola: `paga_base / 13.5` come da codice civile

Il sistema verifica se esiste già un accantonamento per quell'anno/mese prima di crearne uno nuovo.

---

## 8. 📊 CONTROLLO IVA MENSILE AUTOMATICO

### Problema attuale
Non c'è nessun controllo automatico che verifica se la liquidazione IVA mensile è corretta e se il versamento è stato fatto.

### Cosa già esiste
- `app/routers/gestione_iva_speciale.py` → liquidazione IVA
- `app/routers/f24_tributi.py` → tributi F24 per codice (6001 = IVA gen., 6099 = saldo IVA annuale)
- `app/routers/verifica_coerenza.py` → confronto IVA già parzialmente implementato
- Il parser F24 estrae `tributi_erario` con codice 6001 e importo versato

### Cosa va implementato

**Calcolo automatico mensile:**
1. Somma IVA su fatture passive del mese (IVA a credito)
2. Somma IVA su corrispettivi del mese (IVA a debito)
3. Calcola saldo: `IVA debito - IVA credito = da versare`
4. Cerca nell'archivio F24 del mese il codice 6001 con importo compatibile
5. Se trovato → ✅ versamento OK, mostra data e importo
6. Se non trovato → ⚠️ alert "Liquidazione IVA {mese} non trovata"
7. Se importo F24 ≠ saldo calcolato → 🔴 "Differenza: €{X}"

**Alert automatico:** 
Se siamo dopo il 16 del mese e non si trova il versamento IVA → l'Agente AI crea un alert urgente visibile nella campanellina.

**Frontend:**
In Contabilità → Controllo Mensile: nuova sezione "IVA" con:
- Tabella mese per mese: IVA debito, IVA credito, da versare, versato (con data F24), differenza
- Badge verde/rosso per ogni mese
- Link diretto all'F24 corrispondente

---

## 9. 🔔 NOTIFICHE PUSH IN TEMPO REALE — COMPLETAMENTO

### Cosa già esiste
- `app/routers/websocket_realtime.py` → WebSocket attivo
- `app/services/websocket_manager.py` → `notify_data_change()` già chiamato dallo scheduler PEC
- Frontend: `useWebSocket.js` hook già presente

### Cosa manca
Estendere le notifiche a tutti gli eventi, non solo alla PEC:
- Nuova fattura importata → notifica con numero e fornitore
- Cedolino importato → notifica con nome dipendente e mese
- Scadenza in arrivo (3 giorni prima) → notifica con importo e tipo
- F24 da pagare entro 2 giorni → alert rosso
- Avviso bonario ricevuto via email → notifica immediata
- Riconciliazione completata → notifica con numero fatture abbinate

---

## 10. 📋 ESTRATTO CONTO NEXI — PARSER COMPLETAMENTO

### Cosa già esiste
`app/parsers/estratto_conto_nexi_parser.py` esiste ma potrebbe essere incompleto.
`app/parsers/estratto_conto_bnl_parser.py` è completo e distingue:
- Conto corrente BNL: estrae IBAN, numero conto, periodo, saldo iniziale/finale, ogni movimento con data, causale, importo, tipo (entrata/uscita)
- Carta di credito BNL Business: stesso formato, movimenti carta

### Cosa va verificato e completato
1. Il parser BNL estrae già `intestatario` cercando "CERALDI GROUP" → OK
2. Ogni transazione ha: data operazione, data valuta, causale ABI, descrizione, importo
3. Manca il collegamento automatico: appena il parser finisce → propone il matching con fatture

**Flusso da completare:**
1. Upload estratto conto (PDF BNL o CSV)
2. Parser estrae tutti i movimenti
3. Per ogni movimento: cerca in `fatture_passive` una fattura con importo ±2% e data ±30gg
4. Se trovata con confidenza >85% → abbinamento automatico
5. Se confidenza 60-85% → propone all'utente
6. Se <60% → movimento resta "da abbinare"
7. Tutto finisce in `prima_nota_banca` con riferimento al documento abbinato

---

## RIEPILOGO PRIORITÀ

| # | Automazione | Impatto | Complessità | Priorità |
|---|---|---|---|---|
| 1 | Prima Nota automatica al pagamento confermato | 🔴 Alta | Media | P1 |
| 6 | Risposta "avviso bonario già pagato" | 🔴 Alta | Bassa | P1 |
| 2 | Piano dei Conti cliccabile + partitario | 🟠 Media | Media | P2 |
| 3 | Scheda fornitore completa | 🟠 Media | Bassa | P2 |
| 4 | Dettaglio fattura completo | 🟠 Media | Bassa | P2 |
| 5 | Fascicolo dipendente | 🟠 Media | Media | P2 |
| 7 | TFR automatico da cedolino | 🟡 Media | Bassa | P3 |
| 8 | Controllo IVA mensile automatico | 🟡 Media | Media | P3 |
| 9 | Notifiche push su tutti gli eventi | 🟡 Media | Bassa | P3 |
| 10 | Estratto conto → matching automatico | 🟡 Media | Alta | P3 |

