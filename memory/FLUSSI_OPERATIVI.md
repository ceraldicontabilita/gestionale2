# Flussi Operativi — Ceraldi ERP
> Aggiornato: Aprile 2026

---

## PRIMA NOTA CASSA

**Dati in ingresso:**
1. File XML corrispettivi dal Registratore Telematico → incassi giornalieri (contanti + carta)
2. Inserimenti manuali (piccole spese di cassa)

**Logica:**
- DARE = Ricavi Lordi (PagatoContanti + PagatoElettronico) — IVA inclusa
- AVERE = PagatoElettronico (POS) → denaro che uscirà verso banca
- **SALDO CASSA = DARE − AVERE = solo contante fisico in cassa**

**Popola:** Bilancio (Ricavi), Conto Economico, Coerenza POS/Corrispettivi

**Chiusura:** Riconciliazione con estratto conto → accredito POS in banca coincide con POS XML

**API:**
```
GET  /api/prima-nota/cassa?anno=2026
POST /api/prima-nota/cassa/sync-corrispettivi?anno=2026
POST /api/prima-nota/cassa/sync-fatture-pagate?anno=2026
```

---

## PRIMA NOTA BANCA

**Dati in ingresso:**
1. Import CSV estratto conto BPM (separatore `;`, UTF-8-BOM)
2. Riconciliazione automatica con fatture/F24/stipendi
3. Inserimenti manuali

**Logica:**
- Ogni riga = movimento bancario con data, causale, importo, segno
- Saldo progressivo giornaliero
- Commissioni bancarie incluse (non scartate)

**Popola:** Bilancio (Disponibilità Liquide), Riconciliazione Fornitori, Dashboard saldo banca

**Chiusura:** Tutti i movimenti bancari riconciliati con documenti → mese "chiuso contabilmente"

**API:**
```
GET  /api/prima-nota/banca?anno=2026
GET  /api/estratto-conto-movimenti/movimenti?anno=2026
POST /api/bank/import-estratto-conto
```

**Saldi 2026 (aggiornati Mar 2026):**
- Entrate 2026: €225.799,77
- Uscite 2026: €220.976,10
- Saldo 2026: €4.823,67
- Riporto anni prec.: €1.206.190,67

---

## CORRISPETTIVI RT (Cassa)

**Dati in ingresso:** File XML dal Registratore Telematico (trasmesso all'AdE ogni giorno)

**Logica:**
- Dettaglio giornaliero per aliquota IVA
- Estrae PagatoContanti e PagatoElettronico
- Calcola IVA a debito trimestrale

**Popola:** Prima Nota Cassa, Fisco/IVA, Bilancio (Volume d'Affari)

**REGOLA:** I corrispettivi sono l'UNICA fonte di ricavi. NON usare le fatture ricevute per calcolare il fatturato.

```
Volume d'Affari = SUM(corrispettivi.totale_giornata) per anno
```

---

## FATTURE RICEVUTE (Ciclo Passivo SDI)

**Dati in ingresso:**
- File XML FatturaPA (SDI) da Aruba PEC (`fatturazioneceraldi@pec.it`)
- Allegati `.xml` o `.p7m`

**Logica:**
1. Parsing XML → fornitore (P.IVA), data, imponibile, IVA, totale, scadenza
2. Abbinamento fornitore in `suppliers` o creazione nuovo
3. Classificazione automatica categoria spesa (vedi REGOLE_CONTABILI.md)
4. Se metodo pagamento SEPA/Bonifico → movimento atteso in prima_nota_banca

**Popola:** Fornitori (storico), Scadenzario, Prima Nota Banca (uscita attesa), Cespiti, IVA a credito

**Chiusura:** Fattura = "Da pagare" → uscita bancaria riconciliata → "Pagata"

**API:**
```
GET  /api/fatture-ricevute/archivio?anno=2026
POST /api/fatture-ricevute/import-xml
```

---

## PRIMA NOTA SALARI

**Dati in ingresso:** PDF Cedolini (libro unico Zucchetti) + import Gmail

**Logica:**
- Registra COSTO TOTALE del personale mensile
- Separa: netto da pagare, contributi INPS/INAIL, quota TFR

**Popola:** Bilancio (Costo Lavoro), F24 Contributi, Prima Nota Banca (bonifici stipendi)

**Chiusura:** Estratto conto conferma bonifici stipendi + F24 contributi versato entro il 16

---

## CEDOLINI E PAGHE

**Import da Gmail (Apr 2026):**
```
POST /api/cedolini/import-gmail?since_days=180
```
- Cerca "cedolino", "busta paga", "libro unico" in Gmail
- Scarica PDF in asyncio.to_thread() — NON blocca il server
- 271 cedolini Gmail già presenti (storico completo)
- Parsing filename: "Busta paga - Nome - Aprile 2026.pdf" → mese=4, anno=2026

**Collections:**
- `cedolini` (1658): principale — tutte le fonti
- `cedolini_importati` (2363): sistema Zucchetti cloud

---

## FISCO & IVA

**Liquidazione IVA:**
```
IVA a debito  = SUM(corrispettivi.totale_iva)
IVA a credito = SUM(invoices.iva_detraibile)
Liquidazione  = IVA debito − IVA credito   [trimestrale]
```

**Calendario F24 (16 di ogni mese):**
- IRPEF ritenute dipendenti
- Contributi INPS/INAIL
- Addizionali regionali/comunali

**Collections:** `f24_unificato` (68 record), `scadenze` (15 record)

---

## FORNITORI

**API principali:**
```
GET  /api/suppliers?page=1&limit=50     → lista fornitori
GET  /api/suppliers/{id}                → dettaglio
GET  /api/fatture-ricevute/archivio     → storico fatture
GET  /api/scadenziario/fornitori        → scadenze aperte
```

---

## RICONCILIAZIONE BANCARIA

**Tipi di riconciliazione:**
| Tipo | Criteri Match |
|---|---|
| Stipendi | IBAN + importo esatto + data ±5gg |
| F24 | Importo totale + data 16 ±3gg + "F24"/"ERARIO" nella descrizione |
| Rate Mutuo | Importo ±€1 + data ±7gg |
| POS | Importo ±€5 + data attesa accredito (+1/+3gg lavorativi) |
| Fatture | Importo + fornitore |

**Algoritmo POS:**
- Lunedì-Giovedì → accredito il giorno lavorativo successivo
- Venerdì-Domenica → accredito il lunedì successivo

---

## CESPITI & AMMORTAMENTI

**Collection:** `cespiti` (21 record)

**API scan:** `POST /api/cespiti/scan-fatture` — legge righe fatture XML e identifica beni strumentali

**Popolato da:** fatture acquisto beni strumentali (valore > soglia ammortamento)

---

## SCADENZARIO

**Scadenze automatiche create da:**
- Fatture ricevute non pagate
- Modelli F24 caricati
- Rate mutui
- Stipendi mensili

**Alert:**
- Entro 7 giorni → ROSSO (critico)
- 8-30 giorni → GIALLO (attenzione)
- Oltre 30 giorni → VERDE (pianificazione)

---

## MAGAZZINO

**Flusso Carico (da Fattura XML):**
1. Import Fattura → legge righe fattura
2. Classificazione → pattern matching su descrizione/fornitore
3. Aggiornamento stock con prezzo medio ponderato
4. Tracciabilità movimento

**Flusso Scarico (Distinta Base):**
1. Selezione Ricetta + Porzioni da produrre
2. Calcolo ingredienti proporzionale
3. Verifica disponibilità giacenze
4. Scarico con LOTTO-YYYYMMDDHHMMSS

**API:** `/api/magazzino/giacenze`, `/api/magazzino/carico-da-fattura/{id}`

---

## CUCINA / FOOD COST (Apr 2026)

**Flusso Ricetta → Costo:**
1. Ricetta con ingredienti e grammature (`ricette`, 207 record)
2. Food Cost = Σ(prezzo_ingrediente × grammatura) / porzioni
3. Margine = Prezzo_vendita - Food_Cost
4. Prodotti vendita (`prodotti_vendita`, 565 record)

**API:** `/api/cucina/ricette`, `/api/cucina/food-cost/*`

---

## IMPORT DOCUMENTI (Gateway Ingresso Dati)

| Tipo File | Destinazione | Parser |
|---|---|---|
| XML corrispettivi | prima_nota_cassa | corrispettivi_parser |
| XML FatturaPA SDI | invoices | xml_invoice_processor |
| CSV BPM | estratto_conto_movimenti | bank_statement_parser |
| PDF Libro Unico | cedolini + presenze_mensili | libro_unico_parser |
| PDF F24 | f24_unificato | f24_parser |
| PDF Piano Ammortamento | mutui | mutui_parser |

---

*Aggiornato: Aprile 2026*
