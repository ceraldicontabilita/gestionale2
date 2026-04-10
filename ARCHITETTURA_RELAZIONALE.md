# 🏗️ ARCHITETTURA RELAZIONALE — Ceraldi ERP
## La scaletta completa: cosa succede dall'inizio alla fine, senza dimenticare nulla

---

> **Questo documento è la spina dorsale del sistema.**
> Descrive non solo cosa succede, ma COME è strutturato il codice per garantire
> che nessun agente dimentichi nulla, nessun dato si perda, nessuna relazione si spezzi.
> È scritto per essere letto da chi costruisce e da chi usa il sistema.

---

## IL PROBLEMA ATTUALE E LA SOLUZIONE

**Il problema:** Il codice attuale ha la logica giusta sparsa in 80+ file.
Ogni router fa il suo pezzo ma non sa cosa fanno gli altri.
Quando arriva una fattura, 5 file diversi potrebbero aggiornarsi — o potrebbero non farlo,
dipende da quale router è stato chiamato e da chi.

**La soluzione:** Un **Bus degli Eventi** centrale.
Ogni cosa che succede nel sistema genera un evento.
Ogni modulo che deve reagire a quell'evento è registrato e viene chiamato automaticamente.
Nessuno dimentica nulla perché non è il singolo agente a ricordarsi — è il sistema.

---

## STRUTTURA IN REPOSITORY SEPARATI

Il sistema viene diviso in 5 repository indipendenti che parlano tutti allo stesso MongoDB.
Ogni repository ha il suo ciclo di sviluppo, i suoi agenti, la sua logica.
Si parlano via eventi sul DB e via API interne.

---

### 📦 REPOSITORY 1 — `ceraldi-contabilita`
**Cosa contiene:** tutto ciò che riguarda i soldi che entrano ed escono

Moduli:
- Fatture passive (import XML, parsing, verifica)
- Prima Nota (cassa, banca, salari)
- Corrispettivi (import XML registratore telematico)
- Riconciliazione bancaria (BNL, Nexi, PayPal)
- F24 e tributi
- IVA (liquidazione mensile, controllo)
- Scadenziario fornitori
- Bilancio e contabilità avanzata

---

### 👥 REPOSITORY 2 — `ceraldi-hr`
**Cosa contiene:** tutto ciò che riguarda le persone

Moduli:
- Anagrafica dipendenti
- Cedolini (import PDF, parsing multi-formato)
- Presenze e giustificativi
- TFR (calcolo, rivalutazione, liquidazione)
- Contratti e scadenze
- Fringe benefit e welfare
- Agente HR (dimissioni, scadenze, suggerimenti normativi)

---

### 🍕 REPOSITORY 3 — `ceraldi-ingredienti`
**Cosa contiene:** tutto ciò che riguarda prodotti, ricette e magazzino

Moduli:
- Magazzino (giacenze, movimenti, inventario)
- Ingredienti (schede nutrizionali, chimiche, normative)
- Ricette (BOM — Bill of Materials)
- Prodotti finiti e margini
- Tracciabilità lotti (HACCP)
- Ordini fornitori
- Agente Ingredienti (prezzi mercato, suggerimenti, reazioni)

---

### 🏭 REPOSITORY 4 — `ceraldi-operativo`
**Cosa contiene:** tutto ciò che riguarda il lavoro quotidiano

Moduli:
- Corrispettivi e vendita banco
- Noleggio auto e verbali
- PagoPA e tributi
- Agenti AI (FiscaleSentinella, Anticipatore, RicercatoreWeb)
- Dashboard e KPI
- Notifiche e WebSocket

---

### 🧠 REPOSITORY 5 — `ceraldi-intelligenza`
**Cosa contiene:** il cervello trasversale che collega tutto

Moduli:
- Bus degli eventi (Event Bus)
- Learning Machine universale
- Agenti AI avanzati
- Ricerca web integrata (Claude API)
- Suggerimenti proattivi
- Gestione mittenti e email scanner

---

## IL BUS DEGLI EVENTI — Come funziona

Il Bus degli eventi è il cuore del sistema relazionale.
Funziona così: ogni operazione importante pubblica un evento nel DB.
Ogni modulo interessato si è pre-registrato per quel tipo di evento.
Quando l'evento arriva, tutti i moduli registrati vengono chiamati nell'ordine giusto.

**La collection MongoDB:** `eventi_sistema`

Struttura di un evento:
```
{
  "id": "uuid",
  "tipo": "fattura.importata",
  "payload": { tutti i dati dell'evento },
  "processato": false,
  "handlers_completati": [],
  "handlers_falliti": [],
  "created_at": "timestamp",
  "processed_at": null
}
```

---

## SCALETTA COMPLETA — COSA SUCCEDE PASSO PER PASSO

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📄 FLUSSO 1 — ARRIVA UNA FATTURA XML

### STEP 1 — INGRESSO
**Chi lo fa:** Router `fatture_module/import_xml.py`
**Cosa fa:**
- Legge il file XML (supporta utf-8, latin-1, iso-8859-1, cp1252)
- Lo chiama il parser `fattura_elettronica_parser.py`
- Il parser estrae: P.IVA fornitore, ragione sociale, numero fattura, data, tipo documento (TD01/TD04/TD08...), ogni riga con descrizione+quantità+prezzo+IVA, totale imponibile, totale IVA, totale documento, allegati PDF incorporati, eventuale lotto fornitore dalla descrizione riga, eventuale scadenza prodotto dalla descrizione
- Verifica anti-duplicato: stesso numero + stessa P.IVA → skip o aggiorna

### STEP 2 — FORNITORE
**Chi lo fa:** Funzione `get_or_create_fornitore()` in `fatture_module/helpers.py`
**Cosa fa:**
- Cerca il fornitore per P.IVA nella collection `fornitori`
- Se non esiste: lo crea con ragione sociale, P.IVA, indirizzo, regime fiscale dall'XML
- Se esiste: aggiorna ragione sociale se cambiata, lascia intatti metodo pagamento e IBAN
- Recupera: metodo pagamento predefinito, IBAN, flag "escludi magazzino"

**Evento pubblicato:** `fornitore.creato` oppure `fornitore.aggiornato`

### STEP 3 — SALVATAGGIO FATTURA
**Chi lo fa:** stessa funzione import_xml
**Cosa fa:**
- Salva la fattura in `fatture_passive` con stato `provvisoria`
- Salva le righe dettaglio in `dettaglio_righe_fatture` con riferimento alla fattura
- Salva allegati PDF (se presenti nell'XML) in `allegati_fatture` in base64

**Evento pubblicato:** `fattura.importata` con payload completo

### STEP 4 — IL BUS RICEVE L'EVENTO E CHIAMA I HANDLER IN ORDINE

**Handler 1 — MAGAZZINO** (se fornitore non è "escludi magazzino")
- Per ogni riga della fattura: crea un movimento di carico in `warehouse_movements`
- Aggiorna le giacenze in `magazzino_giacenze` (incrementa quantità per ogni prodotto)
- Se nella descrizione riga è presente un codice lotto → collega il carico al lotto in `lotti_fornitori`
- Se nella descrizione è presente una data di scadenza → la salva sul movimento

**Handler 2 — SCADENZIARIO**
- Legge la modalità di pagamento dall'XML (campo `pagamento.modalita` e `pagamento.data_scadenza`)
- Se data scadenza esplicita → usa quella
- Altrimenti calcola: data fattura + giorni standard per quel fornitore (da `fornitori.gg_pagamento`)
- Crea la scadenza in `scadenziario_fornitori` con: importo, data, fornitore_id, fattura_id, stato `aperta`

**Handler 3 — NOTA DI CREDITO** (solo se tipo documento = TD04 o TD08)
- Cerca la fattura originale per numero riferimento + P.IVA
- Aggiorna la fattura originale: `ha_nota_credito: true`, `importo_stornato`, `importo_residuo`
- Aggiorna la scadenza originale: riduce l'importo
- Crea movimento inverso in magazzino (scarico)

**Handler 4 — LOTTI FORNITORI** (solo se riga contiene codice lotto)
- Verifica se il lotto esiste già in `lotti_fornitori`
- Se non esiste: lo crea con: fornitore, prodotto, quantità, data ricezione, data scadenza
- Aggiorna la quantità disponibile se già esiste (FIFO per scadenza)
- Collega il lotto alla fattura per la tracciabilità

**Handler 5 — LEARNING MACHINE**
- Prende le descrizioni delle righe e le invia a `classifica_fattura_per_centro_costo()`
- Assegna la fattura al centro di costo (Rosticceria, Pasticceria, Amministrazione, Veicoli...)
- Calcola deducibilità IRES/IRAP e detraibilità IVA per quel centro di costo
- Aggiorna la fattura con i campi: `centro_costo_id`, `centro_costo_nome`, `imponibile_deducibile_ires`, `iva_detraibile`
- Aggiorna le regole in `learning_rules` se trova nuovi pattern

**Handler 6 — AGENTE INGREDIENTI** (solo se fattura da fornitore alimentare)
- Controlla se le righe corrispondono a ingredienti già noti in magazzino
- Se trova corrispondenza: aggiorna il prezzo medio pagato per quell'ingrediente
- Se il prezzo è cambiato >5% → crea segnalazione "variazione prezzo ingrediente"
- Aggiorna le ricette che usano quell'ingrediente con il nuovo costo per aggiornare i margini

**Handler 7 — PRIMA NOTA** (rimane in stato "pronto, aspetta conferma")
- Prepara il movimento contabile ma NON lo scrive ancora
- Lo marca come `prima_nota_pronta: true` sulla fattura
- Quando l'estratto conto conferma il pagamento → allora scrive

**Handler 8 — NOTIFICA**
- Invia notifica WebSocket all'interfaccia: "Nuova fattura importata: [Fornitore] [importo]"
- Se ci sono avvisi (IBAN mancante, metodo pagamento non configurato, totali incoerenti) → li aggiunge alla notifica
- Se fornitore è nuovo → alert speciale "Nuovo fornitore creato automaticamente"

### STEP 5 — CONTROLLI FINALI
- Verifica coerenza totali XML (somma righe = totale documento). Se non quadra → stato `anomala`
- Verifica IBAN se metodo pagamento è bonifico. Se mancante → avviso giallo
- Aggiorna contatori: fatture del mese, IVA a credito del mese, costi per centro di costo

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 💰 FLUSSO 2 — ARRIVA UN CEDOLINO PDF

### STEP 1 — INGRESSO
**Chi lo fa:** Upload manuale o download automatico Gmail (ogni 50 minuti)
**Cosa fa:**
- Rileva il formato: CSC Napoli (fino 2018), Zucchetti classico (2018-2022), Zucchetti nuovo (dal 2022 con separatore 's'), Teamsystem
- Chiama il parser corretto in base al formato rilevato
- Il parser estrae: nome dipendente, codice fiscale, mese, anno, tipo cedolino (mensile/tredicesima/quattordicesima/acconto), netto in busta, lordo, IRPEF trattenuta, INPS dipendente, progressivi annuali INPS e IRPEF, quota TFR del mese, ferie residue (giorni), permessi ROL residui (ore), giustificativi usati nel mese (FE=Ferie, RL=ROL, MA=Malattia, SM=Smart Working, L1=Legge 104...)

### STEP 2 — ABBINAMENTO DIPENDENTE
- Cerca in `dipendenti` per codice fiscale (più affidabile) poi per nome
- Se non trovato → segnalazione "Cedolino non abbinato — verificare manualmente"
- Se trovato → procede

**Evento pubblicato:** `cedolino.importato` con payload completo

### STEP 3 — IL BUS RICEVE L'EVENTO E CHIAMA I HANDLER

**Handler 1 — SALVATAGGIO CEDOLINO**
- Upsert in `cedolini` per dipendente_id + mese + anno (mai duplicati)
- Aggiorna paga base nel profilo dipendente SOLO se questo è il cedolino più recente

**Handler 2 — PROGRESSIVI**
- INPS e IRPEF progressivi annuali: logica MAX (prende il valore più alto per non perdere dati se i cedolini arrivano fuori ordine)
- Aggiorna i progressivi in `dipendenti.progressivi_anno`

**Handler 3 — TFR**
- Registra automaticamente l'accantonamento TFR in `tfr_accantonamenti`
- Importo: quota estratta dal PDF oppure calcola `paga_lorda / 13.5` (art. 2120 c.c.)
- Rivalutazione: 1.5% fisso + 75% indice ISTAT (se disponibile per quel periodo)
- Aggiorna `dipendenti.tfr_maturato` con il nuovo totale
- NON crea duplicati (verifica se esiste già accantonamento per quel mese)

**Handler 4 — FERIE E PERMESSI**
- Aggiorna saldi in `dipendenti.ferie_residue` e `dipendenti.permessi_rol` SOLO se questo cedolino è più recente dell'ultimo aggiornamento
- Aggiorna anche i giustificativi usati nel mese in `presenze_giustificativi`

**Handler 5 — PRIMA NOTA SALARI**
- Scrive AUTOMATICAMENTE (senza conferma) in `prima_nota_salari`:
  - tipo: uscita
  - importo: netto in busta
  - descrizione: "Stipendio [nome] [mese/anno]"
  - dipendente_id, codice_fiscale, mese, anno
  - source: "cedolino_auto"

**Handler 6 — RICONCILIAZIONE ANTICIPATA**
- Cerca nell'estratto conto importato (se già presente) un bonifico con importo = netto cedolino ±2€ e data nel mese successivo
- Se trova match → segna il cedolino come `erogato: true`, abbina il movimento bancario

**Handler 7 — AGENTE HR**
- Controlla se questo cedolino è di tipo "tredicesima" → crea promemoria per eventuale rivalutazione
- Controlla ferie accumulate: se >25 giorni → segnalazione "ferie in scadenza"
- Controlla se il dipendente ha contratto in scadenza → segnalazione

**Handler 8 — NOTIFICA**
- WebSocket: "Cedolino importato: [Nome] [Mese/Anno] — Netto: €X"

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📧 FLUSSO 3 — ARRIVA UN'EMAIL (ogni 50 minuti)

### STEP 1 — CONNESSIONE E FILTRO MITTENTI
- Connessione IMAP a Gmail (imap.gmail.com:993) in thread separato
- Per ogni email: controlla se il mittente è in `mittenti_email` con `attivo: true`
- Se NON è in whitelist → skip silenzioso, non viene nemmeno scaricata
- Se È in whitelist → legge il campo `tipo_documento` per sapere cosa aspettarsi

### STEP 2 — CLASSIFICAZIONE E DOWNLOAD
- Scarica gli allegati (PDF, XML, P7M)
- Calcola hash MD5 del contenuto → controlla duplicati in `documents_inbox`
- Se già presente → skip
- Se nuovo → salva in `documents_inbox` con: filename, hash, tipo_documento, from, subject, data, pdf in base64, stato "importato"

**Evento pubblicato:** `documento.ricevuto` con tipo_documento nel payload

### STEP 3 — ROUTING PER TIPO DOCUMENTO

**Se tipo = `fattura_xml`** (da SDI o Aruba)
- Estrae l'XML dall'allegato (o dal corpo HTML dell'email Aruba)
- → Lancia il **FLUSSO 1** completo come se fosse un import manuale
- Segna il documento come `xml_processed: true`

**Se tipo = `cedolino`** (da commercialista Marotta o Ferrantini)
- Salva il PDF in `documents_inbox` con categoria `busta_paga`
- → Lancia il **FLUSSO 2** completo
- L'agente HRGuardiano viene notificato

**Se tipo = `inps`**
- Estrae testo dal PDF (OCR con pdfplumber)
- Controlla se contiene: DURC → salva in `durc_documenti` con data scadenza
- Controlla se contiene: delibera FONSI → salva in `delibere_fonsi`, crea alert "Cassa integrazione"
- Controlla se contiene: comunicazione contributi → salva in `inps_comunicazioni`
- L'agente FiscaleSentinella viene notificato

**Se tipo = `inail`**
- Estrae testo dal PDF
- Controlla se è autoliquidazione annuale → salva in `inail_autoliquidazioni` con importo e scadenza
- Controlla se è denuncia infortuni → salva in `infortuni` collegato al dipendente (ricerca CF nel testo)
- Crea scadenza pagamento se c'è un importo da pagare

**Se tipo = `cartella_esattoriale`**
- L'agente FiscaleSentinella già esistente analizza il PDF
- Controlla se è avviso bonario (art. 36-bis, 36-ter, 54-bis) → cerca nel DB se il tributo è già pagato (confronto con F24)
- Controlla se è cartella esattoriale → crea alert URGENTE con importo e scadenza 60 giorni
- Controlla se è rottamazione → salva in `adr_rate` con scadenze delle rate
- Se l'importo è già stato pagato → risponde automaticamente "trovato F24 del [data] per €[importo]"

**Se tipo = `pagopa`**
- Estrae il codice CBILL/identificativo bolletta dal PDF o dal soggetto email
- Cerca il codice in `estratto_conto_movimenti` (campo descrizione)
- Se trovato → abbina la ricevuta al movimento bancario, segna come riconciliata
- Salva la ricevuta in `ricevute_pagopa`

**Se tipo = `paypal`**
- Estrae i movimenti dal PDF o CSV estratto conto PayPal
- Li salva in `paypal_movimenti`
- Propone il matching con fatture che hanno PayPal come metodo di pagamento

**Se tipo = `generico`** (noleggio auto, banche, ecc.)
- Per noleggio auto (leasys, ald, arval...): cerca la targa nei verbali noleggio, abbina il PDF al verbale
- Per banche (bnl, bancobpm, nexi): se è un estratto conto → avvia parsing automatico BNL o Nexi e lancia riconciliazione

**Handler trasversale — AGENTE FISCALE SENTINELLA**
Per tutti i documenti di tipo fiscale: analizza il testo estratto cercando pattern di avviso bonario, importi, scadenze, codici tributo. Crea segnalazioni prioritizzate.

### STEP 4 — FINE CICLO
- Aggiorna contatori in `email_sync_stats`
- WebSocket: notifica se ci sono nuovi documenti importanti
- Se nuove fatture → campanellina con count
- Se avvisi fiscali urgenti → popup rosso immediato

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🏦 FLUSSO 4 — ARRIVA UN ESTRATTO CONTO BANCARIO

### STEP 1 — PARSING
- Parser BNL: distingue conto corrente da carta Business
- Parser Nexi: movimenti POS e carte
- Estrae ogni movimento: data operazione, data valuta, descrizione, importo, causale ABI
- Anti-duplicato: hash del contenuto del file

**Evento pubblicato:** `estratto_conto.importato`

### STEP 2 — MATCHING AUTOMATICO (in ordine di confidenza)

**Match 1 — F24** (alta priorità)
- Cerca movimenti con descrizione contenente "F24", "TRIBUTI", codici tributo noti
- Abbina al corrispondente F24 in archivio per data e importo

**Match 2 — Stipendi**
- Cerca movimenti in uscita con "BONIFICO", importo uguale a un netto cedolino ±2€, data nel mese
- Abbina al cedolino, segna dipendente come "stipendio erogato"

**Match 3 — Fatture fornitori**
- Per ogni movimento in uscita: cerca fattura con importo ±2% e fornitore che corrisponde alla descrizione
- Se confidenza >85% → abbinamento automatico, scrive Prima Nota Banca
- Se confidenza 60-85% → propone all'utente
- Se <60% → resta "da abbinare"

**Match 4 — POS/Corrispettivi**
- Cerca accrediti con "NEXI", "POS", "PAGAMENTI ELETTRONICI"
- Abbina ai corrispettivi del giorno (±1€, ±3 giorni)

**Match 5 — Canoni noleggio**
- Cerca uscite con nomi delle società di noleggio
- Abbina alle rate dei contratti

### STEP 3 — SCRITTURA PRIMA NOTA
- Ogni movimento abbinato genera automaticamente il corrispondente in Prima Nota Banca
- Ogni abbinamento aggiorna lo stato della fattura: `pagata: true`, `data_pagamento`
- Aggiorna lo scadenziario: scadenza → `saldata`

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🍕 FLUSSO 5 — RICETTE E INGREDIENTI INTELLIGENTI

### Come si agganciala fattura alle ricette

Quando arriva una fattura con riga "Farina 00 kg 50 — €45.00":

**Step 1 — Identificazione ingrediente**
- Il sistema cerca "Farina 00" nel `dizionario_prodotti` e in `ingredienti`
- Se trova corrispondenza → collega la riga fattura all'ingrediente

**Step 2 — Aggiornamento costo ricette**
- Recupera tutte le ricette che usano quell'ingrediente (da `ricette.ingredienti`)
- Calcola il nuovo costo per ogni ricetta (somma ingredienti × quantità BOM)
- Aggiorna `ricette.costo_produzione` e `ricette.margine` con i nuovi prezzi
- Se il margine scende sotto soglia configurabile → alert "Margine ricetta [Nome] sceso sotto X%"

**Step 3 — Scheda ingrediente**
- Ogni 30 giorni l'agente `IngredienteResearcher` aggiorna la scheda dell'ingrediente
- Usa Claude API per ricercare: valori nutrizionali, allergeni, normativa, reazioni chimiche con gli altri ingredienti presenti nelle tue ricette
- Salva in `ingredienti_schede` con timestamp dell'ultimo aggiornamento

**Step 4 — Confronto prezzi mercato**
- L'agente cerca il prezzo corrente di quell'ingrediente su fonti pubbliche (ISMEA, borse merci)
- Se stai pagando >15% sopra il prezzo di mercato → alert suggerimento con prezzo di riferimento

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🧠 IL CERVELLO CENTRALE — Come non si dimentica nulla

### La tabella degli handler registrati

Questa tabella vive in `event_handlers_registry` nel MongoDB ed è la garanzia che nulla si perda.

```
Evento                  → Handler                      → Repository
──────────────────────────────────────────────────────────────────
fattura.importata       → handler_magazzino            → ceraldi-ingredienti
fattura.importata       → handler_scadenziario         → ceraldi-contabilita
fattura.importata       → handler_nota_credito         → ceraldi-contabilita
fattura.importata       → handler_lotti                → ceraldi-ingredienti
fattura.importata       → handler_learning_cdc         → ceraldi-intelligenza
fattura.importata       → handler_ingredienti_update   → ceraldi-ingredienti
fattura.importata       → handler_notifica             → ceraldi-operativo

cedolino.importato      → handler_salva_cedolino       → ceraldi-hr
cedolino.importato      → handler_progressivi          → ceraldi-hr
cedolino.importato      → handler_tfr                  → ceraldi-hr
cedolino.importato      → handler_ferie                → ceraldi-hr
cedolino.importato      → handler_prima_nota_salari    → ceraldi-contabilita
cedolino.importato      → handler_riconcilia_stipendio → ceraldi-contabilita
cedolino.importato      → handler_agente_hr            → ceraldi-intelligenza
cedolino.importato      → handler_notifica             → ceraldi-operativo

documento.ricevuto      → handler_routing_tipo         → ceraldi-intelligenza
estratto_conto.importato→ handler_matching_f24         → ceraldi-contabilita
estratto_conto.importato→ handler_matching_stipendi    → ceraldi-contabilita
estratto_conto.importato→ handler_matching_fatture     → ceraldi-contabilita
estratto_conto.importato→ handler_matching_pos         → ceraldi-contabilita
fattura.pagata          → handler_prima_nota_auto      → ceraldi-contabilita
fattura.pagata          → handler_scadenza_saldata     → ceraldi-contabilita
fornitore.creato        → handler_learning_fornitore   → ceraldi-intelligenza
ingrediente.prezzo_cambiato → handler_ricette_update   → ceraldi-ingredienti
ingrediente.prezzo_cambiato → handler_alert_margine    → ceraldi-operativo
```

### Come funziona l'Event Bus in pratica

**Ogni handler ha:**
- Nome univoco
- Tipo evento che ascolta
- Funzione da eseguire
- Priorità (i critici prima)
- Retry in caso di fallimento (max 3 tentativi)
- Log del risultato in `eventi_log`

**Se un handler fallisce:**
- L'errore va in `eventi_log` con dettaglio
- Il sistema riprova fino a 3 volte con backoff
- Se fallisce 3 volte → segnalazione urgente "Handler [nome] fallito su evento [id]"
- **Gli altri handler continuano** — il fallimento di uno non blocca gli altri

**Nessun dato va perso** perché l'evento rimane nel DB finché tutti gli handler non lo hanno processato con successo.

---

## TABELLA COLLECTION MONGODB — Chi scrive cosa

| Collection | Chi scrive | Chi legge |
|---|---|---|
| `fatture_passive` | import_xml, aruba_automation, erp_bridge | Fatture, Riconciliazione, Contabilità |
| `dettaglio_righe_fatture` | import_xml | Fattura dettaglio, Magazzino |
| `fornitori` | import_xml (crea), Fornitori (modifica) | Fatture, Magazzino, Learning |
| `scadenziario_fornitori` | handler_scadenziario | Scadenze, Riconciliazione |
| `warehouse_movements` | handler_magazzino | Magazzino, Ricette |
| `magazzino_giacenze` | handler_magazzino | Magazzino giacenze |
| `lotti_fornitori` | handler_lotti | Tracciabilità, HACCP |
| `prima_nota_banca` | handler_prima_nota, estratto_conto | Prima Nota Banca |
| `prima_nota_cassa` | handler_prima_nota, corrispettivi | Prima Nota Cassa |
| `prima_nota_salari` | handler_prima_nota_salari | Prima Nota Salari |
| `cedolini` | handler_salva_cedolino | Cedolini, HR |
| `dipendenti` | handler_progressivi, handler_ferie, handler_tfr | HR, Fascicolo dipendente |
| `tfr_accantonamenti` | handler_tfr | TFR |
| `ingredienti_schede` | agente_ingrediente_researcher | Magazzino scheda |
| `ricette` | handler_ingredienti_update | Ricette, Margini |
| `agenti_segnalazioni` | tutti gli agenti | Dashboard, Agenti |
| `eventi_sistema` | Bus eventi | Event Bus processor |
| `eventi_log` | Bus eventi | Admin, Debug |
| `learning_rules` | Learning Machine | Classificazione automatica |
| `agenti_apprendimenti` | LearningCervello | Suggerimenti |

---

## PRIORITÀ DI COSTRUZIONE — In quale ordine fare le cose

### FASE 1 — Solidificare il nucleo (senza inventare nulla di nuovo)
1. Scrivere l'Event Bus come file unico `app/core/event_bus.py`
2. Spostare ogni handler esistente (magazzino, scadenziario, prima nota...) in `app/handlers/`
3. Registrarli tutti nell'Event Bus
4. Testare che ogni flusso funzioni end-to-end senza click manuali

### FASE 2 — Completare i flussi mancanti
5. Prima Nota automatica al pagamento confermato (estratto conto → Prima Nota senza click)
6. TFR automatico da cedolino (già il parser ce l'ha, manca il handler)
7. Aggiornamento ricette al cambio prezzo ingrediente

### FASE 3 — Intelligenza interna (senza internet)
8. LearningCervello 2.0 — trend prezzi fornitori, alert margini
9. Anticipatore — previsioni liquidità 30 giorni
10. HR — costo reale per dipendente, ferie in scadenza

### FASE 4 — Intelligenza esterna (con internet)
11. RicercatoreWeb — news HR e fiscali ogni lunedì
12. IngredienteResearcher — schede complete con chimica e nutrizione
13. Confronto prezzi mercato ingredienti

### FASE 5 — Repository separati
14. Dividere il codice nei 5 repository
15. Ogni repository ha il suo deploy indipendente
16. Comunicano via API e via eventi sul DB condiviso

