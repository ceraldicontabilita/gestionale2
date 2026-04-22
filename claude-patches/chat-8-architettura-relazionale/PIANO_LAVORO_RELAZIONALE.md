# PIANO DI LAVORO — Gestionale Relazionale Ceraldi Group
## Chat 8 — Versione definitiva — Aprile 2026

---

## 1. STATO ATTUALE DEL SISTEMA

### 1.1 Infrastruttura esistente
- **Backend**: FastAPI + Motor + MongoDB Atlas (db: `Gestionale`, cluster: `cluster0.vofh7iz`)
- **Frontend**: React 18 + Vite (porta :3000)
- **Deploy**: Emergent.sh (agente E-2)
- **Repo**: `github.com/ceraldicontabilita/gestionale2` (branch `main`)
- **File collections**: `app/db_collections.py` — fonte di verità per i nomi delle collezioni

### 1.2 Moduli già costruiti (router + pagine)
Il sistema ha già ~200 router Python e ~90 pagine JSX. I moduli principali:

| Modulo | Router backend | Pagina frontend | Stato |
|--------|---------------|-----------------|-------|
| Fatture ricevute | `fatture_module/` (6 file) | `ArchivioFattureRicevute.jsx` | Funzionante, parser XML/P7M |
| Fornitori | `suppliers_module/` (6 file) | `Fornitori.jsx` | Funzionante, learning machine |
| Prima Nota Cassa | `prima_nota_module/cassa.py` | `PrimaNota.jsx` | Funzionante |
| Prima Nota Banca | `prima_nota_module/banca.py` | `PrimaNota.jsx` | Funzionante |
| Estratto Conto | `bank/estratto_conto.py` + import/parser | — | Import funzionante |
| F24 | `f24/` (6 file) | `CalendarioFiscale.jsx` | Funzionante, parser email |
| Cedolini | `cedolini.py` + `cedolini_riconciliazione.py` | `hr/HRCedolini.jsx` | Parser Zucchetti in sviluppo |
| Dipendenti | `employees/` (7 file) | `hr/HRDipendenti.jsx` | Funzionante |
| Presenze | `attendance_module/` (4 file) | `hr/HRPresenze.jsx` | Funzionante |
| Corrispettivi | `invoices/corrispettivi.py` | `Corrispettivi.jsx` | Funzionante |
| Magazzino | `warehouse/` (6 file) | `Magazzino.jsx` | Dizionario prodotti attivo |
| Riconciliazione | `accounting/riconciliazione_automatica.py` | `Riconciliazione.jsx` | Match base funzionante |
| Assegni | `bank/assegni.py` + learning | `GestioneAssegni.jsx` | Funzionante |
| Documenti/Inbox | `documenti_module/` + inbox classify | `Documenti.jsx` | Classificazione base |
| Alert | `alerts.py` | (sidebar/dashboard) | Collezione `alerts` esiste |
| Sync relazionale | `sync_relazionale.py` | — | Fattura↔Prima nota base |
| Scadenziario | `scadenzario_fornitori.py` | `Scadenze.jsx` | 903 docs |

### 1.3 Collezioni MongoDB già attive (con volumi indicativi)
```
invoices                    ~3856 docs   (fatture passive)
fornitori                   ~268 docs    (anagrafica fornitori canonica)
dipendenti                  ~N docs      (anagrafica dipendenti)
cedolini                    ~916 docs    (cedolini strutturati)
prima_nota_cassa            ~1428 docs
prima_nota_banca            ~1138 docs
estratto_conto_movimenti    ~4261 docs
f24_unificato               ~83 docs
corrispettivi               ~1051 docs
assegni                     ~210 docs
scadenziario_fornitori      ~903 docs
warehouse_inventory         ~5372 docs
acquisti_prodotti            ~15065 docs
dizionario_prodotti          ~112 docs
documents_inbox             ~803 docs
documenti_classificati      ~1967 docs
documenti_non_associati     ~285 docs
alerts                      ~N docs
riconciliazioni             ~N docs
operazioni_da_confermare    ~277 docs
bonifici_stipendi           ~736 docs
prima_nota_salari           ~696 docs
quietanze_f24               ~303 docs
```

### 1.4 Cosa MANCA per la relazionalità piena

Il sistema ha i singoli moduli ma **mancano i collegamenti strutturali** tra di essi:

1. **Niente collezione `partite_aperte`** — lo scadenziario è implicito
2. **Niente `audit_log` unificato** — ogni modulo logga a modo suo
3. **Alert non relazionali** — la collezione `alerts` esiste ma non ha trigger automatici né condizioni di chiusura codificate
4. **`sync_relazionale.py` limitato** — copre solo fattura↔prima nota, non F24, cedolini, POS, trasferimenti
5. **Riconciliazione isolata** — il motore di scoring è base (importo±0.05 + fuzzy nome), non propaga gli aggiornamenti ai moduli collegati
6. **Nessuna gerarchia fonti** — i dati vengono sovrascritti senza sapere se il valore precedente era confermato manualmente
7. **Deduplica non centralizzata** — ogni modulo ha la sua logica, non c'è una funzione comune

---

## 2. DECISIONI ARCHITETTURALI CONFERMATE

Queste decisioni sono state approvate da Enzo in Chat 8 e sono **vincolanti per tutte le chat successive**.

### 2.1 Riconciliazione → Collezione dedicata `riconciliazioni_match`
Ogni match tra un movimento reale e una partita attesa viene salvato come documento separato in `riconciliazioni_match` con:
```json
{
  "id": "rm_uuid",
  "movimento_id": "...",
  "movimento_collection": "estratto_conto_movimenti | prima_nota_cassa",
  "partita_id": "...",
  "partita_collection": "partite_aperte",
  "tipo_match": "fattura | f24 | stipendio | pos | trasferimento | commissione | altro",
  "importo_riconciliato": 500.00,
  "residuo_pre": 500.00,
  "residuo_post": 0.00,
  "confidenza": 0.95,
  "origine": "auto | proposta | manuale",
  "stato": "candidato | confermato | respinto",
  "created_at": "...",
  "confirmed_at": "...",
  "confirmed_by": "sistema | utente"
}
```
Supporta nativamente molti-a-uno e uno-a-molti.

### 2.2 Alert → Collezione unica `alerts`
Tutti gli alert del gestionale vivono in un'unica collezione `alerts` con:
```json
{
  "id": "alert_uuid",
  "codice": "FORN_MP_MANCANTE | FAT_DUPLICATA | CED_DIP_NON_TROVATO | ...",
  "modulo": "fornitori | fatture | cedolini | f24 | banca | cassa | ...",
  "severita": "info | warning | critical",
  "entita_id": "id dell'entità coinvolta",
  "entita_collection": "nome collezione",
  "titolo": "Metodo pagamento mancante",
  "dettaglio": "Il fornitore XYZ non ha metodo pagamento definito",
  "stato": "aperto | risolto | ignorato",
  "condizione_chiusura": "fornitori.metodo_pagamento != null",
  "created_at": "...",
  "resolved_at": null,
  "resolved_by": null
}
```

### 2.3 Eventi → Sincroni (chiamate dirette)
Per il volume attuale (migliaia di docs, non milioni), gli aggiornamenti cross-modulo avvengono in modo sincrono nella stessa request FastAPI. Niente Redis/Celery.

Il meccanismo è una funzione `propagate_event(event_type, payload, db)` centralizzata in `app/services/event_bus.py` che viene chiamata dopo ogni operazione CRUD significativa.

### 2.4 Partite aperte → Materializzate in collezione dedicata `partite_aperte`
Ogni debito/credito atteso è un record reale:
```json
{
  "id": "pa_uuid",
  "tipo": "fattura_fornitore | f24 | stipendio | pos_atteso | trasferimento",
  "controparte_id": "id fornitore / dipendente / ...",
  "controparte_nome": "...",
  "documento_id": "id fattura / f24 / cedolino",
  "documento_collection": "invoices | f24_unificato | cedolini",
  "importo_originale": 1000.00,
  "residuo": 1000.00,
  "data_scadenza": "2026-04-30",
  "data_documento": "2026-04-01",
  "stato": "aperta | parziale | chiusa | compensata",
  "priorita": 1,
  "match_ids": [],
  "created_at": "...",
  "updated_at": "..."
}
```

---

## 3. NUOVE COLLEZIONI DA CREARE

| Collezione | Scopo | Creata in |
|-----------|-------|-----------|
| `partite_aperte` | Scadenziario materializzato unificato | Fase 1 |
| `riconciliazioni_match` | Match riconciliazione N:M | Fase 1 |
| `audit_log` | Log unificato di ogni cambio stato | Fase 1 |
| `alert_definitions` | Catalogo codici alert con trigger e chiusura | Fase 1 |

Le collezioni `alerts`, `riconciliazioni`, `scadenziario_fornitori` **esistono già** e verranno migrate/estese, non ricreate.

---

## 4. NUOVI FILE BACKEND DA CREARE

### 4.1 `app/services/event_bus.py`
Motore eventi sincrono. Espone:
- `async def propagate_event(event_type: str, payload: dict, db) -> list[dict]`
- Tipi evento: `fattura.created`, `fattura.pagata`, `f24.acquisito`, `f24.pagato`, `cedolino.importato`, `cedolino.pagato`, `movimento_banca.importato`, `movimento_cassa.creato`, `fornitore.creato`, `fornitore.aggiornato`, `corrispettivo.registrato`, `trasferimento.creato`
- Per ogni evento, chiama le funzioni handler registrate
- Ogni handler può: creare/aggiornare `partite_aperte`, tentare match in `riconciliazioni_match`, creare/risolvere `alerts`, aggiornare entità collegate, scrivere `audit_log`

### 4.2 `app/services/partite_aperte_engine.py`
Motore partite aperte. Espone:
- `async def crea_partita(tipo, documento_id, ...)` — crea partita da fattura/F24/cedolino
- `async def chiudi_partita(partita_id, match_id, importo)` — chiude totale o parziale
- `async def cerca_partite_compatibili(importo, controparte, data, finestra_gg)` — per il match
- `async def ricalcola_residui(controparte_id)` — riallinea residui da match confermati

### 4.3 `app/services/riconciliazione_engine.py`
Motore di scoring riconciliazione potenziato. Espone:
- `async def cerca_match(movimento, db) -> list[CandidatoMatch]`
- Scoring a 4 livelli: esatto → pattern noto → approssimato → nessuno
- `async def conferma_match(match_id, db)` — propaga aggiornamenti a tutti i moduli
- `async def respingi_match(match_id, db)` — logga per apprendimento futuro

### 4.4 `app/services/alert_engine.py`
Motore alert centralizzato. Espone:
- `async def genera_alert(codice, entita_id, entita_collection, dettaglio, db)`
- `async def risolvi_alert(codice, entita_id, db)` — chiude alert se condizione soddisfatta
- `async def verifica_alert_aperti(entita_id, db)` — controlla se gli alert vanno chiusi
- Catalogo alert in `alert_definitions` con ~40 codici predefiniti

### 4.5 `app/services/audit_logger.py`
Logger audit unificato. Espone:
- `async def log_evento(modulo, azione, entita_id, vecchio_stato, nuovo_stato, fonte, utente, db)`
- Ogni operazione CRUD nei router chiama questo logger

### 4.6 `app/services/deduplica.py`
Funzioni di deduplica centralizzate:
- `async def cerca_duplicato_fattura(piva, numero, data, totale, hash_file, db)`
- `async def cerca_duplicato_fornitore(piva, cf, denominazione, db)`
- `async def cerca_duplicato_cedolino(dipendente_id, mese, anno, tipo, db)`
- `async def cerca_duplicato_f24(codice_tributo, periodo, importo, db)`
- `async def cerca_duplicato_movimento(conto, data, importo, descrizione, db)`

---

## 5. PIANO DI IMPLEMENTAZIONE PER FASI

### FASE 1 — Infrastruttura relazionale (Chat 8-9)
**Obiettivo**: creare i servizi core che tutti i moduli useranno.

| Task | File | Priorità |
|------|------|----------|
| Creare `app/services/event_bus.py` con dispatcher eventi | Nuovo | P0 |
| Creare `app/services/alert_engine.py` con catalogo 40 codici | Nuovo | P0 |
| Creare `app/services/audit_logger.py` | Nuovo | P0 |
| Creare `app/services/deduplica.py` | Nuovo | P0 |
| Creare `app/services/partite_aperte_engine.py` | Nuovo | P0 |
| Creare `app/services/riconciliazione_engine.py` (v2 scoring) | Nuovo | P0 |
| Aggiungere collezioni in `db_collections.py` | Modifica | P0 |
| Creare indici MongoDB per le nuove collezioni | Modifica `database.py` | P0 |
| Seed `alert_definitions` con i 40 codici dalle specifiche | Script | P1 |

### FASE 2 — Collegamento Fatture ↔ Fornitori ↔ Prima Nota (Chat 10)
**Obiettivo**: quando arriva una fattura XML, tutto il ciclo si attiva automaticamente.

| Task | File | Priorità |
|------|------|----------|
| Hook `fattura.created` → crea partita aperta | `event_bus.py` handler | P0 |
| Hook `fattura.created` → verifica/crea fornitore | `event_bus.py` handler | P0 |
| Hook `fattura.created` → genera alert se MP mancante | `event_bus.py` handler | P0 |
| Hook `fattura.created` → instrada cassa/banca | `event_bus.py` handler | P0 |
| Hook `fornitore.aggiornato` (MP impostato) → risolvi alert | `event_bus.py` handler | P1 |
| Hook `fattura.created` + righe merce → aggiorna magazzino | `event_bus.py` handler | P1 |
| Aggiungere `fonte` e `confermato_utente` ai campi critici fornitori | Modifica suppliers | P1 |

### FASE 3 — Collegamento Banca ↔ Riconciliazione (Chat 11)
**Obiettivo**: quando arriva un movimento bancario, il sistema tenta il match.

| Task | File | Priorità |
|------|------|----------|
| Hook `movimento_banca.importato` → cerca match partite | `event_bus.py` handler | P0 |
| Scoring 4 livelli: esatto, pattern, approssimato, nessuno | `riconciliazione_engine.py` | P0 |
| Conferma match → aggiorna fattura + partita + scadenziario | `riconciliazione_engine.py` | P0 |
| Classificazione commissioni POS | `riconciliazione_engine.py` | P1 |
| Gestione match cumulativo (1 bonifico → N fatture) | `riconciliazione_engine.py` | P1 |

### FASE 4 — Collegamento F24 ↔ Banca (Chat 12)
**Obiettivo**: F24 acquisito → partita aperta → match con addebito banca → chiusura.

| Task | File | Priorità |
|------|------|----------|
| Hook `f24.acquisito` → crea partita aperta tipo F24 | `event_bus.py` handler | P0 |
| Pattern match F24 in estratto conto (causale+importo+data 16) | `riconciliazione_engine.py` | P0 |
| Hook `f24.riconciliato` → aggiorna stato fiscale | `event_bus.py` handler | P0 |
| Alert F24 scaduto non pagato | `alert_engine.py` | P1 |

### FASE 5 — Collegamento Cedolini ↔ Dipendenti ↔ Banca (Chat 13)
**Obiettivo**: cedolino importato → partita stipendio → match con bonifico → chiusura.

| Task | File | Priorità |
|------|------|----------|
| Hook `cedolino.importato` → crea partita stipendio | `event_bus.py` handler | P0 |
| Hook `cedolino.importato` → aggiorna fascicolo dipendente | `event_bus.py` handler | P0 |
| Hook `cedolino.importato` → genera prima_nota_salari | `event_bus.py` handler | P0 |
| Hook `cedolino.importato` → aggiorna TFR | `event_bus.py` handler | P0 |
| Match stipendi in estratto conto (IBAN+importo netto) | `riconciliazione_engine.py` | P1 |

### FASE 6 — Collegamento Corrispettivi ↔ POS ↔ Cassa ↔ Banca (Chat 14)
**Obiettivo**: corrispettivo → quota contanti in cassa + quota POS attesa in banca.

| Task | File | Priorità |
|------|------|----------|
| Hook `corrispettivo.registrato` → crea entrata cassa (solo contanti) | `event_bus.py` handler | P0 |
| Hook `corrispettivo.registrato` → crea partita POS attesa | `event_bus.py` handler | P0 |
| Match accrediti POS in estratto conto | `riconciliazione_engine.py` | P1 |
| Gestione commissioni POS e accrediti cumulativi | `riconciliazione_engine.py` | P1 |

### FASE 7 — Trasferimenti interni + Documenti/Inbox (Chat 15)
**Obiettivo**: versamenti cassa↔banca collegati + inbox documentale smista automaticamente.

| Task | File | Priorità |
|------|------|----------|
| Hook `trasferimento.creato` → crea lato opposto | `event_bus.py` handler | P0 |
| Classificazione automatica inbox → modulo target | `documents_inbox_classify.py` migliorato | P0 |
| Reprocessing idempotente documenti | `batch_reprocessing.py` migliorato | P1 |

### FASE 8 — Dashboard relazionale + UI alert (Chat 16)
**Obiettivo**: vista unificata con tutti gli alert, partite aperte, riconciliazione.

| Task | File | Priorità |
|------|------|----------|
| Nuova pagina `DashboardRelazionale.jsx` | Frontend | P0 |
| Widget alert per modulo con contatori | Frontend | P0 |
| Widget partite aperte per tipo | Frontend | P0 |
| Widget riconciliazione: non riconciliati + proposte | Frontend | P0 |
| Fascicolo dipendente unificato | Frontend | P1 |
| Scheda fornitore unificata | Frontend | P1 |

---

## 6. CATALOGO ALERT COMPLETO

### 6.1 Fornitori (FORN_*)
| Codice | Severità | Trigger | Chiusura |
|--------|----------|---------|----------|
| FORN_MP_MANCANTE | warning | Fornitore senza `metodo_pagamento` | `metodo_pagamento` valorizzato |
| FORN_NUOVO_INCOMPLETO | info | Fornitore creato auto con dati minimi | Campi minimi completati |
| FORN_IBAN_MANCANTE | warning | MP=bonifico ma IBAN assente | IBAN valorizzato |
| FORN_DUPLICATO | warning | P.IVA o CF uguale a altro fornitore | Utente conferma o merge |
| FORN_DATI_INCOERENTI | warning | P.IVA/CF/denominazione incongruenti | Dati corretti |
| FORN_INATTIVO_USATO | info | Nuovi documenti per fornitore inattivo | Fornitore riattivato o docs spostati |

### 6.2 Fatture (FAT_*)
| Codice | Severità | Trigger | Chiusura |
|--------|----------|---------|----------|
| FAT_DUPLICATA | warning | Hash/invoice_key già presente | Utente conferma |
| FAT_FORN_NON_TROVATO | critical | P.IVA non trovata e match ambiguo | Fornitore collegato |
| FAT_MP_NON_DEFINITO | warning | Fornitore senza MP → fattura sospesa | MP impostato |
| FAT_TIPO_AMBIGUO | warning | Parser incerto (fattura vs NC vs allegato) | Tipo confermato |
| FAT_RIGHE_MERCE_NON_RISOLTE | info | Righe prodotto senza match magazzino | Match confermato |
| FAT_DATI_INCOMPLETI | warning | Mancano scadenza/totale/numero/PIVA | Dati completati |
| FAT_DA_PAGARE_SCADUTA | critical | Scadenza superata senza pagamento | Pagamento registrato |

### 6.3 F24 (F24_*)
| Codice | Severità | Trigger | Chiusura |
|--------|----------|---------|----------|
| F24_ATTESO_NON_ACQUISITO | warning | Scadenza fiscale senza documento | Documento acquisito |
| F24_NON_PAGATO | warning | Documento esiste ma no pagamento | Pagamento confermato |
| F24_SCADUTO | critical | Scadenza superata senza pagamento | Pagamento avvenuto |
| F24_NON_RICONCILIATO | info | Pagato ma no match bancario | Match confermato |
| F24_DUPLICATO | warning | Stesso tributo+periodo+importo | Utente conferma |
| F24_PARSER_INCOMPLETO | info | Dati estratti incompleti | Dati completati |

### 6.4 Cedolini (CED_*)
| Codice | Severità | Trigger | Chiusura |
|--------|----------|---------|----------|
| CED_TIPO_NON_RICONOSCIUTO | warning | Parser non classifica il PDF | Tipo confermato |
| CED_DIP_NON_TROVATO | critical | Nessun match dipendente | Dipendente collegato |
| CED_DUPLICATO | warning | Stesso dip+mese+anno+tipo | Utente conferma |
| CED_DATI_ECONOMICI_INCOMPLETI | warning | Mancano netto/lordo/TFR | Dati completati |
| CED_PRIMA_NOTA_NON_GENERATA | info | Cedolino valido senza movimento | Movimento generato |
| CED_TFR_NON_AGGIORNATO | info | Cedolino importato senza TFR | TFR aggiornato |
| CED_NON_PAGATO | warning | Cedolino esiste ma no pagamento | Pagamento confermato |
| CED_MATCH_BANCA_AMBIGUO | info | Possibile match banca non certo | Match confermato/respinto |
| CED_INCOERENZA_PRESENZE | info | Ore/giorni non coerenti con presenze | Differenza spiegata |

### 6.5 Dipendenti (DIP_*)
| Codice | Severità | Trigger | Chiusura |
|--------|----------|---------|----------|
| DIP_INCOMPLETO | warning | Anagrafica creata con dati minimi | Campi completati |
| DIP_IBAN_MANCANTE | warning | Nessun IBAN per stipendio | IBAN valorizzato |
| DIP_DUPLICATO | warning | CF o nome+cognome+nascita uguali | Utente conferma/merge |
| DIP_CESSATO_FLUSSI_ATTIVI | warning | Nuovi movimenti per cessato | Utente verifica |
| DIP_CONTRATTO_MANCANTE | info | Nessun contratto collegato | Contratto inserito |

### 6.6 Banca (BNK_*)
| Codice | Severità | Trigger | Chiusura |
|--------|----------|---------|----------|
| BNK_NON_CLASSIFICATO | info | Movimento senza categoria | Classificato |
| BNK_DUPLICATO | warning | Movimento già importato | Confermato |
| BNK_FAT_SENZA_RISCONTRO | warning | Fattura bancaria aperta oltre soglia | Pagamento trovato |
| BNK_POS_NON_RICONCILIATO | warning | Accredito POS atteso non trovato | Match confermato |
| BNK_F24_NON_RICONCILIATO | warning | F24 atteso non trovato in EC | Match confermato |
| BNK_TRASFERIMENTO_INCOMPLETO | info | Solo 1 lato del trasferimento | Lato opposto collegato |
| BNK_DIFFERENZA_IMPORTO | info | Match quasi certo ma importo diverso | Differenza spiegata |

### 6.7 Cassa (CAS_*)
| Codice | Severità | Trigger | Chiusura |
|--------|----------|---------|----------|
| CAS_DUPLICATO | warning | Movimento cassa già presente | Confermato |
| CAS_SENZA_CAUSALE | info | Movimento senza descrizione utile | Causale inserita |
| CAS_FAT_CONTANTI_NON_REGOLATA | warning | Fattura contanti non pagata | Pagamento confermato |
| CAS_DIFFERENZA_SALDO | critical | Saldo teorico ≠ reale | Rettifica registrata |
| CAS_CORRISPETTIVI_INCOERENTI | warning | Quota contanti ≠ movimenti generati | Corretto |

### 6.8 Magazzino (MAG_*)
| Codice | Severità | Trigger | Chiusura |
|--------|----------|---------|----------|
| MAG_PRODOTTO_INCOMPLETO | info | Prodotto nuovo senza giacenza minima | Giacenza min impostata |
| MAG_SOTTO_SCORTA | warning | Giacenza ≤ giacenza minima | Giacenza ripristinata |
| MAG_MATCH_DUBBIO | info | Riga fattura con match incerto | Match confermato |
| MAG_UNITA_INCOERENTE | warning | Stessa voce con unità diverse | Conversione definita |
| MAG_DUPLICATO_PRODOTTO | info | Due prodotti sembrano lo stesso | Merge o conferma |

### 6.9 Documenti/Inbox (DOC_*)
| Codice | Severità | Trigger | Chiusura |
|--------|----------|---------|----------|
| DOC_NON_CLASSIFICATO | info | Tipo documento non riconosciuto | Classificato |
| DOC_PARSER_FALLITO | warning | Parser non estrae dati | Parser corretto/rilanciato |
| DOC_DUPLICATO | info | Documento già presente (hash) | Confermato |
| DOC_ENTITA_NON_TROVATA | warning | Fornitore/dipendente target assente | Entità trovata/creata |
| DOC_REPROCESSING_NECESSARIO | info | Nuove regole disponibili | Rielaborato |

### 6.10 Riconciliazione (RIC_*)
| Codice | Severità | Trigger | Chiusura |
|--------|----------|---------|----------|
| RIC_NON_RICONCILIATO | info | Movimento senza match | Match trovato |
| RIC_MATCH_AMBIGUO | warning | Più candidati plausibili | Utente sceglie |
| RIC_DIFFERENZA_IMPORTO | info | Match quasi certo, importo diverso | Differenza spiegata |
| RIC_PARTITA_VECCHIA | warning | Partita aperta oltre soglia giorni | Chiusa o giustificata |
| RIC_POS_NON_QUADRATO | warning | Totale POS atteso ≠ accrediti reali | Quadratura completata |
| RIC_PAGAMENTO_MULTIPLO | info | Combinazione M:1 non chiudibile | Utente risolve |

---

## 7. MAPPA RELAZIONALE COMPLETA

```
                          ┌─────────────────────┐
                          │   DOCUMENTI/INBOX    │
                          │   (classificazione)  │
                          └────────┬─────────────┘
                                   │ instrada
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
             ┌──────────┐  ┌──────────┐  ┌──────────┐
             │ FATTURE  │  │   F24    │  │ CEDOLINI │
             │ RICEVUTE │  │          │  │          │
             └────┬─────┘  └────┬─────┘  └────┬─────┘
                  │             │              │
       ┌──────┬──┘             │         ┌────┴────┐
       ▼      ▼                │         ▼         ▼
  ┌────────┐ ┌───────────┐    │   ┌──────────┐ ┌──────┐
  │FORNIT. │ │MAGAZZINO  │    │   │DIPENDENTI│ │ TFR  │
  │        │ │PRODOTTI   │    │   │          │ │      │
  └───┬────┘ └───────────┘    │   └──────────┘ └──────┘
      │ metodo pag.           │
      ▼                       │
  ┌──────────────┐            │
  │ PARTITE      │◄───────────┘  ◄── tutte le entità pagabili
  │ APERTE       │                    creano partite qui
  └──────┬───────┘
         │ match
         ▼
  ┌──────────────┐     ┌──────────────┐
  │RICONCILIAZ.  │◄────│ESTRATTO CONTO│
  │  MATCH       │     │  (banca)     │
  └──────┬───────┘     └──────────────┘
         │                     ▲
         ▼                     │
  ┌──────────────┐     ┌──────────────┐
  │ PRIMA NOTA   │     │ PRIMA NOTA   │
  │   CASSA      │◄───►│   BANCA      │
  └──────────────┘     └──────────────┘
    trasferimenti interni

  ┌──────────────┐
  │CORRISPETTIVI │──► quota contanti → CASSA
  │              │──► quota POS → PARTITA APERTA → BANCA
  └──────────────┘

         ┌──────────────┐
         │   ALERTS     │  ◄── tutti i moduli generano alert
         └──────────────┘      qui con codici standardizzati

         ┌──────────────┐
         │  AUDIT LOG   │  ◄── ogni cambio stato viene loggato
         └──────────────┘

         ┌──────────────┐
         │  EVENT BUS   │  ◄── orchestra tutti i collegamenti
         └──────────────┘
```

---

## 8. REGOLE DI SVILUPPO PER TUTTE LE CHAT SUCCESSIVE

### 8.1 Regole di sviluppo (confermate)
1. Claude **NON pusha mai su main** — crea sempre patch in `/claude-patches/chat-N-descrizione/` con `ISTRUZIONI.md`
2. Ogni servizio nuovo va in `app/services/` — mai inline nei router
3. I nomi collezioni vanno SEMPRE importati da `app/db_collections.py` — mai stringhe hardcoded
4. Ogni operazione CRUD significativa chiama `propagate_event()` dopo il salvataggio
5. Ogni alert segue il catalogo codificato — mai alert "liberi" senza codice
6. Frontend: stile da `frontend/src/lib/utils.js`, font Plus Jakarta Sans, colori design system — MAI Tailwind/Shadcn
7. Ad ogni nuova chat: leggere questo documento + ultimi commit + aggiornare DIARIO.md a fine chat

### 8.2 Ordine di lettura per ogni nuova chat
1. Questo file (`PIANO_LAVORO_RELAZIONALE.md`)
2. `DIARIO.md` dal repo
3. Ultimi 10 commit
4. Le specifiche operative `.txt` rilevanti per la fase in corso

### 8.3 Regola di idempotenza
Ogni operazione automatica (import, reprocessing, propagazione eventi) deve essere idempotente:
- Se la partita esiste già → aggiorna, non duplica
- Se l'alert esiste già aperto → non ricrea
- Se il match è già confermato → non ri-propone
- Se il movimento è già importato → salta

### 8.4 Regola gerarchia fonti
Per i campi critici (IBAN, metodo_pagamento, codice_fiscale, denominazione):
```
confermato_utente: true  →  priorità massima, non sovrascrivere
fonte: "import_xml"      →  può essere aggiornato da fonte migliore
fonte: "stima"           →  può essere aggiornato da qualsiasi fonte
```

---

## 9. SEQUENZA CHAT OPERATIVE

| Chat | Contenuto | Deliverable |
|------|-----------|-------------|
| **8** (questa) | Architettura + Piano di lavoro | Questo documento + DIARIO.md |
| **9** | Fase 1: servizi core | `event_bus.py`, `alert_engine.py`, `audit_logger.py`, `deduplica.py`, `partite_aperte_engine.py`, `riconciliazione_engine.py` + nuove collections in `db_collections.py` + indici |
| **10** | Fase 2: Fatture↔Fornitori↔Prima Nota | Handler eventi per ciclo passivo completo |
| **11** | Fase 3: Banca↔Riconciliazione | Scoring 4 livelli + propagazione match |
| **12** | Fase 4: F24↔Banca | Partite F24 + match estratto conto |
| **13** | Fase 5: Cedolini↔Dipendenti↔Banca | Partite stipendi + fascicolo dipendente |
| **14** | Fase 6: Corrispettivi↔POS↔Cassa↔Banca | Split contanti/POS + match accrediti |
| **15** | Fase 7: Trasferimenti + Inbox | Collegamento cassa↔banca + classificazione |
| **16** | Fase 8: Dashboard + UI alert | Frontend relazionale unificato |

---

## 10. COME USARE QUESTO DOCUMENTO

Questo file va salvato nella memoria di Claude e usato come **istruzione operativa** per ogni chat futura sul gestionale Ceraldi.

Ad ogni nuova chat, Claude deve:
1. Leggere questo documento per capire a che fase siamo
2. Leggere DIARIO.md per le ultime modifiche
3. Implementare la fase corrente seguendo le specifiche
4. Aggiornare DIARIO.md a fine chat
5. Creare la patch in `/claude-patches/chat-N-descrizione/`

Le decisioni architetturali (sezione 2) sono **vincolanti** e non vanno ridiscusse.
Il catalogo alert (sezione 6) è **la fonte di verità** per tutti i codici alert.
La mappa relazionale (sezione 7) è il **blueprint** di come i moduli si parlano.
