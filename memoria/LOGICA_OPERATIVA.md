# CERALDI ERP — Riepilogo Funzionale Completo
> Come funziona il gestionale pagina per pagina, dato per dato
> Ceraldi Group S.R.L. | Aprile 2026

---

## 1. IL CICLO DEI DATI — Come Entrano e Dove Vanno

### 1.1 Fonti dei dati in ingresso

Il gestionale riceve dati da 3 fonti automatiche:

| Fonte | Cosa arriva | Frequenza | Dove finisce |
|-------|-------------|-----------|-------------|
| **PEC Aruba** (`fatturazioneceraldi@pec.it`) | Fatture XML dal Sistema di Interscambio (SDI) | Ogni ora (scheduler) | `invoices` → pagina Fatture |
| **Gmail** (`ceraldigroupsrl@gmail.com`) | Cedolini, F24, verbali, quietanze, cartelle | Ogni 10 min (scheduler) | `documents_inbox` → smistati per tipo |
| **Import manuale** | Corrispettivi XML, estratto conto CSV, PDF | Quando l'utente carica | Varie collection |

### 1.2 Mittenti autorizzati (14 configurati)

| Mittente | Tipo documento | Dove va |
|----------|---------------|---------|
| `grazia.studioferrantini@email.it` | Cedolino/F24 | → `cedolini` |
| `rosaria.marotta@email.it` | F24 | → `cedolini` |
| `f.ferrantini@email.it` | Cedolino/F24 | → `cedolini` |
| `ricevuta.pagaonline@agenziariscossione.gov.it` | Cartella esattoriale | → `documenti_non_associati` |
| `notifica.acc.campania@pec.agenziariscossione.gov.it` | Cartella esattoriale | → `documenti_non_associati` |
| `no_reply@agenziariscossione.gov.it` | Cartella esattoriale | → `documenti_non_associati` |
| `inpscomunica@postacert.inps.gov.it` | INPS | → `documenti_non_associati` |
| `auto_napoli@massivo.pec.inail.it` | INAIL | → `documenti_non_associati` |
| `partenopay@ext.comune.napoli.it` | PagoPA | → `verbali` |
| `noreply-checkout@ricevute.pagopa.it` | PagoPA | → `documenti_non_associati` |
| `tari.avvisibonari@pec.comune.napoli.it` | TARI | → `documenti_non_associati` |
| `entrate.tari-tares-tarsu@pec.comune.napoli.it` | TARI | → `documenti_non_associati` |
| `assistenza@paypal.it` | PayPal | → `documenti_non_associati` |
| `@pec.fatturapa.it` (PEC) | Fattura XML SDI | → `invoices` (parser XML) |

---

## 2. PAGINA PER PAGINA

### 📊 DASHBOARD (`/`)

**Cosa mostra:** Riepilogo istantaneo dell'azienda per l'anno selezionato.

**Dati che legge:**
- `corrispettivi` → Ricavi (volume d'affari)
- `invoices` → Costi (fatture passive)
- `scadenziario_fornitori` → Prossime scadenze
- `f24_unificato` → Scadenze fiscali

**Cosa calcola:**
- Bilancio istantaneo: Ricavi - Costi = Utile lordo
- Saldo IVA: IVA debito (corrispettivi) - IVA credito (fatture)
- Prossime scadenze con giorni mancanti

**Alert che genera:**
- ⚠️ F24 in scadenza (rosso se < 5 giorni)
- ⚠️ Fatture da pagare (con importo e fornitore)
- Banner commercialista se ci sono dati da inviare

**Relazioni:** Legge da TUTTE le collection principali. Non scrive nulla.

---

### 📄 FATTURE (`/fatture`)

**Cosa mostra:** Tutte le fatture passive ricevute dai fornitori (1.405 record).

**Come arrivano i dati:**
1. PEC Aruba scarica email con allegati XML/P7M
2. Il parser XML estrae: fornitore, P.IVA, numero, data, imponibile, IVA, totale, righe dettaglio
3. Estrae anche: `DatiFattureCollegate` (per note credito), `causali`, `tipo_documento` (TD01/TD04)
4. Cerca il fornitore in `fornitori` per P.IVA
5. **Prende il metodo pagamento DAL FORNITORE** (mai dall'XML)
6. Se metodo = contanti → auto-registra in `prima_nota_cassa` + stato "pagata"
7. Se metodo = bonifico → auto-registra in `prima_nota_banca` + stato "pagata"
8. Se metodo = sospesa/misto/nuovo → resta "provvisoria" da confermare

**Bottoni per ogni fattura:**
- `Vedi` → apre dettaglio XML
- `✓ Cassa` (verde) → confermata pagata in contanti (visibile solo se il fornitore paga contanti)
- `✓ Banca` (verde) → confermata pagata con bonifico
- `Cassa` / `Banca` (grigio) → da confermare

**Cosa popola:**
- `invoices` → la fattura stessa
- `fornitori` → crea il fornitore se non esiste (auto da P.IVA)
- `prima_nota_cassa` o `prima_nota_banca` → movimento di pagamento
- `warehouse_stocks` → aggiorna giacenze magazzino (se abilitato)

**Note Credito (TD04):**
- Importo mostrato con segno negativo
- Badge rosso "Nota Credito"
- Nel modal Assegni si scala dall'importo fattura

---

### 📒 PRIMA NOTA (`/prima-nota`)

**2 sezioni: CASSA e BANCA**

#### CASSA
**Cosa contiene:**
- **ENTRATE**: Corrispettivi giornalieri (totale incassato = contanti + POS)
- **USCITE POS → Banca**: La parte elettronica del corrispettivo che va in banca
- **USCITE Fatture**: Fatture pagate in contanti
- **USCITE Versamenti**: Contanti portati fisicamente in banca

**Come si popola:**
1. Corrispettivi importati da XML registratore → crea ENTRATA (totale) + USCITA (POS)
2. Fatture con fornitore metodo=contanti → crea USCITA
3. Versamenti contanti trovati nell'estratto conto ("VERS. CONTANTI") → crea USCITA

**Saldo Cassa = Entrate - Uscite POS - Fatture contanti - Versamenti banca**

#### BANCA
**Cosa contiene:**
- Movimenti dall'estratto conto bancario (8.839 record)
- Pagamenti fatture bonifico
- Stipendi dipendenti
- F24 Agenzia Entrate
- Accrediti POS (dall'incasso giorno precedente)
- Rate mutuo, SDD, commissioni

**Come si popola:**
1. Import CSV estratto conto BPM → `estratto_conto_movimenti`
2. Fatture con fornitore metodo=bonifico → auto-registra qui

#### PROVVISORI
**Cosa sono:** Fatture importate ma non ancora confermate.
- Se il fornitore ha metodo definito → auto-confermate (non appaiono qui)
- Se il fornitore NON ha metodo → appaiono qui con bottoni Cassa/Banca/Sospesa

**Bottone Sospesa:** La fattura resta nei provvisori, non crea movimento. Si può confermare dopo.

---

### 🏢 FORNITORI (`/fornitori`)

**Cosa mostra:** Anagrafica di tutti i fornitori (245 record).

**Ogni card fornitore mostra:**
- Nome, P.IVA, indirizzo
- Numero fatture anno corrente
- Metodo pagamento (Contanti/Bonifico/Assegno/Misto)
- Giorni medi pagamento

**Il metodo pagamento è FONDAMENTALE:**
- Determina dove va la fattura (cassa o banca)
- NON viene mai dall'XML della fattura
- Se cambi metodo, salva la data del cambio (storico)

**Bottoni:**
- `Fatture` → apre estratto fatture del fornitore
- `Modifica` → modifica anagrafica + metodo pagamento
- `Cerca P.IVA` → cerca dati Camera di Commercio (OpenAPI)
- `Schede` → schede tecniche prodotti

**Relazioni:**
- `invoices` → fatture del fornitore (per P.IVA)
- `prima_nota_cassa` / `prima_nota_banca` → movimenti collegati
- `assegni` → assegni emessi a favore del fornitore

---

### 👥 HR — DIPENDENTI (`/dipendenti`)

**Cosa mostra:** 30 dipendenti con dettaglio per ognuno.

**Tab per ogni dipendente:**
- **Anagrafica**: nome, cognome, CF, IBAN, mansione, livello, data assunzione
- **Contratti**: tipo contratto, scadenza
- **Cedolini**: buste paga del dipendente
- **Verbali**: verbali noleggio associati (se driver)
- **Movimenti**: bonifici stipendio trovati in banca
- **Giustificativi**: ferie, permessi, malattia

---

### 💰 CEDOLINI (`/cedolini`)

**Cosa mostra:** 301 buste paga, vista "Per Mese" o "Per Dipendente".

**Come arrivano:**
1. Il consulente del lavoro invia il PDF "Libro Unico" via Gmail
2. Il parser Zucchetti estrae per ogni dipendente: nome, CF, netto, TFR, ore

**Campi chiave:** `nome_dipendente`, `codice_fiscale`, `netto`, `netto_mese`, `tfr_mese`

**Bottone "Importa da Gmail":** Scarica nuovi cedolini dall'email del consulente.

**Bottone "Importa PDF Libro Unico":** Upload manuale del PDF presenze.

---

### 📅 PRESENZE (`/presenze`)

**Cosa mostra:** Calendario presenze giornaliero per dipendente (290 record).

**Dati per ogni giorno:** ore ordinarie, giustificativi (FE=ferie, AI=assenza, RL=ROL, MA=malattia)

**Legenda colorata:** Ogni codice ha un colore diverso.

**Come si popola:**
- Generati dai dati cedolini (totali mensili)
- Import PDF Libro Unico per dettaglio giornaliero

---

### 🚗 NOLEGGIO AUTO (`/noleggio`)

**3 tab: Flotta Auto, Verbali Noleggio, Riepilogo Costi**

#### Flotta (4 veicoli)
| Targa | Veicolo | Fornitore | Driver |
|-------|---------|-----------|--------|
| HB411GV | BMW X3 | Leasys | Vincenzo Ceraldi |
| GW980EP | Mazda | ARVAL | Antonietta Ceraldi |
| GX037HJ | BMW X1 | ALD | Valerio Ceraldi |
| GG782PN | Alfa Romeo Stelvio | Leasys | Vincenzo Ceraldi |

#### Verbali (49 attivi)
- Scaricati automaticamente dalla PEC (notifiche sanzioni CdS)
- Targa estratta dal PDF con PyMuPDF
- Solo targhe aziendali (non aziendali archiviate)
- Driver associato tramite targa → veicolo → driver

**Bottoni:**
- `Scan Fatture Noleggiatori` → cerca verbali nelle fatture
- `Associa Driver` → collega driver ai verbali per targa
- `Riconcilia` → riconcilia con pagamenti bancari

---

### 📦 MAGAZZINO (`/magazzino`)

**Cosa mostra:** 496 prodotti con giacenze, prezzi, fornitori.

**Legge da:** `warehouse_stocks` (NON warehouse_inventory che è vuota)

**Tab:** Giacenze, Inventario, Ricerca Prodotti, Dizionario Articoli, Coerenza POS

---

### 🏦 RICONCILIAZIONE (`/riconciliazione`)

**Cosa fa:** Confronta movimenti bancari con fatture, stipendi, F24 per trovare corrispondenze.

**Tab:** Banca, Assegni, F24, Fatture Aruba, Stipendi, Documenti, PayPal

---

### ✏️ ASSEGNI (`/riconciliazione/assegni`)

**Cosa mostra:** 220 assegni raggruppati per carnet.

**Modal "Collega Fatture":**
- Fatture ordinate per FORNITORE (header sticky)
- Note credito con importo NEGATIVO (badge rosso)
- Massimo 4 fatture per assegno
- Solo fatture dello stesso fornitore

**Regola:** L'auto-associazione collega assegni SOLO a fatture di fornitori con metodo "assegno".

---

### 📈 CONTABILITÀ (`/contabilita`)

**Tab:** Piano dei Conti, Bilancio, Verifica Bilancio, Controllo Mensile, Calendario Fiscale, Cespiti, Finanziaria, Chiusura Esercizio, Budget, Mutui, Contab. Avanzata

---

### 🔍 STRUMENTI (`/strumenti`)

**Tab:** Verifica Coerenza, Commercialista, Pianificazione, Visure

#### Verifica Coerenza
Confronta automaticamente:
- IVA mensile (debito vs credito)
- Versamenti cassa vs banca
- Prima Nota vs Estratto Conto
- Bonifici vs movimenti bancari

#### Commercialista
Genera PDF per il commercialista:
- **Prima Nota Cassa**: 2 colonne (Entrate verde / Uscite rosso), POS in uscite, "SALDO CASSA AL dd/mm/yyyy"
- **Fatture Cassa**: elenco fatture pagate contanti
- **Carnet Assegni**: PDF con assegni selezionati

---

### 📥 DOCUMENTI (`/documenti`)

**Tab:** Archivio, Import Documenti

#### Archivio
Documenti raggruppati per mittente: Consulente Lavoro (61), Comune di Napoli (43), Commercialista (40), INPS (40), Agenzia Entrate (8), Assicurazione (7)

#### Import Documenti
Upload manuale di: XML fatture, CSV estratto conto, PDF cedolini, XML corrispettivi

---

### ⚙️ ADMIN (`/admin`)

**Tab:** Email, Parole Chiave, Fatture, Sistema

#### Email
- Account Gmail configurato con parole chiave per filtro
- PEC Aruba configurata per fatture SDI
- Test connessione e salvataggio credenziali

#### Parole Chiave
Parole usate per categorizzare documenti email: F24, cedolino, busta paga, pagamento, bonifico, ricevuta, etc.

---

## 3. FLUSSO COMPLETO: DA EMAIL A PRIMA NOTA

```
1. Email arriva (PEC o Gmail)
   ↓
2. Scheduler la scarica (ogni ora PEC, ogni 10 min Gmail)
   ↓
3. Controlla mittente nella lista autorizzati (14 mittenti)
   ↓
4. Se mittente SDI (@pec.fatturapa.it):
   → Parser XML fattura
   → Cerca fornitore per P.IVA
   → Prende metodo pagamento DAL FORNITORE
   → Se contanti: crea movimento in prima_nota_cassa + stato=pagata
   → Se bonifico: crea movimento in prima_nota_banca + stato=pagata
   → Se sospesa/nuovo: resta provvisoria
   → Aggiorna contatore fatture fornitore
   → Aggiorna giacenze magazzino (se abilitato)
   ↓
5. Se mittente cedolino (Ferrantini/Marotta):
   → Salva PDF in documents_inbox
   → Disponibile per import manuale
   ↓
6. Se mittente cartella/INPS/INAIL:
   → Salva in documenti_non_associati
   → Crea alert se urgente
   ↓
7. Dashboard si aggiorna automaticamente
   → Nuova scadenza se fattura ha data_scadenza
   → Bilancio ricalcolato
   → Volume affari aggiornato (solo corrispettivi)
```

---

## 4. RELAZIONI TRA DATI

```
fornitori.partita_iva ←→ invoices.supplier_vat
fornitori.metodo_pagamento → determina prima_nota_cassa o prima_nota_banca
invoices.id → prima_nota_cassa.fattura_id o prima_nota_banca.fattura_id
invoices.tipo_documento=TD04 → nota credito (importo negativo)
corrispettivi.data → prima_nota_cassa (entrata=totale, uscita=POS)
estratto_conto_movimenti (VERS.CONTANTI) → prima_nota_cassa (uscita versamento)
dipendenti.codice_fiscale ←→ cedolini.codice_fiscale ←→ presenze.codice_fiscale
veicoli_noleggio.targa ←→ verbali_noleggio.targa → veicoli_noleggio.driver
assegni.fornitore_piva ←→ invoices.supplier_vat (solo metodo=assegno)
```

---

*Generato: Aprile 2026*
