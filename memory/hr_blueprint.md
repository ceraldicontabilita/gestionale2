# Blueprint HR — Ceraldi ERP
> Aggiornato: Aprile 2026 | Redesign completo completato

---

## STRUTTURA ATTUALE (post-redesign Apr 2026)

La vecchia `GestioneDipendentiUnificata.jsx` (2183 righe) è stata **eliminata**.
Al suo posto: 4 pagine separate nella cartella `pages/hr/`.

### Route HR
```
/dipendenti          → HRDipendenti.jsx      (anagrafica + dettaglio dipendente)
/dipendenti/cedolini → HRCedolini.jsx        (buste paga + import Gmail)
/dipendenti/presenze → HRPresenze.jsx        (calendario presenze)
/dipendenti/tfr      → HRTFR.jsx             (gestione TFR e acconti)
```

### SecondaryTabs (componente di navigazione)
```
"Dipendenti"  → /dipendenti
"Cedolini"    → /dipendenti/cedolini
"Presenze"    → /dipendenti/presenze
"TFR"         → /dipendenti/tfr
```

---

## API BACKEND USATE (tutte funzionanti ✓)

```
GET  /api/dipendenti                              → lista 34 dipendenti
GET  /api/dipendenti/{id}                         → singolo dipendente
PUT  /api/dipendenti/{id}                         → salva anagrafica
GET  /api/cedolini?anno=2026                      → cedolini per anno (tutte le fonti)
GET  /api/cedolini/dipendente/{id}?anno=          → cedolini per dipendente
POST /api/cedolini/import-gmail?since_days=180    → importa da Gmail (non bloccante)
GET  /api/paghe/buste-paga?anno=                  → buste paga libro unico
GET  /api/paghe/distinte-f24?anno=                → distinte F24
GET  /api/tfr/acconti/{id}                        → acconti TFR dipendente
POST /api/tfr/acconti                             → nuovo acconto TFR
PUT  /api/tfr/acconti/{id}                        → modifica acconto TFR
DELETE /api/tfr/acconti/{id}                      → cancella acconto TFR
GET  /api/attendance/ore-lavorate/{id}?mese=&anno= → ore lavorate
GET  /api/attendance/richieste-pending            → richieste assenza
PUT  /api/attendance/richiesta-assenza/{id}/approva
GET  /api/giustificativi/dipendente/{id}/saldo-ferie
GET  /api/archivio-bonifici/transfers?beneficiario=
```

---

## SCHEMA COLLECTION `dipendenti`

```json
{
  "id": "uuid",
  "nome": "Mario",
  "cognome": "Rossi",
  "codice_fiscale": "RSSMRA80A01F839Y",
  "email": "mario.rossi@example.com",
  "telefono": "333...",
  "mansione": "Pasticciere",
  "livello": "3",
  "tipo_contratto": "tempo_indeterminato",
  "data_assunzione": "2019-01-15",
  "iban": "IT60X0542811101000000123456",
  "banca": "BPM",
  "importo_mensile": 1800.00,
  "importo_netto": 1406.00,
  "in_carico": true
}
```

**Collection corretta**: `dipendenti` (34 record). NON `employees` (31 record, è una copia per le presenze batch).

---

## SCHEMA CEDOLINO

```json
{
  "id": "uuid",
  "dipendente_id": "uuid (→ dipendenti.id)",
  "dipendente_nome": "Mario Rossi",
  "anno": 2026,
  "mese": 1,
  "lordo": 1800.00,
  "netto": 1406.00,
  "inps_azienda": 420.00,
  "tfr": 135.00,
  "costo_azienda": 2355.00,
  "source": "gmail | cedolino_v2 | document_ai | pdf_upload",
  "file_hash": "md5 (solo source=gmail)",
  "filename": "Busta paga - Mario Rossi - Gennaio 2026.pdf",
  "pagato": true
}
```

---

## IMPORT CEDOLINI DA GMAIL

- **Endpoint**: `POST /api/cedolini/import-gmail?since_days=180`
- **Funzione sincrona**: `_fetch_cedolini_gmail_sync()` in `routers/cedolini.py`
- **Esecuzione**: `await asyncio.to_thread(...)` — NON blocca il server
- **Deduplicazione**: `file_hash` (MD5 del file PDF)
- **Parsing filename**: `_parse_filename_periodo("Busta paga - Nome - Aprile 2026.pdf")` → `mese=4, anno=2026`
- **Stato**: 271 cedolini Gmail già importati e aggiornati con mese/anno (Apr 2026)

---

## REGOLE CRITICHE PER SVILUPPO HR

1. Collection corretta: `dipendenti` (NON `employees`)
2. Design: SOLO CSS inline da `lib/utils.js` — NO Tailwind, NO Shadcn
3. Icone: lucide-react ONLY — NO emoji nel codice
4. NO tab che duplicano le SecondaryTabs (Cedolini, Presenze, TFR hanno già i propri hub)
5. Il selettore anno nella Retribuzione è necessario (anni cedolini: 2019-2026)
6. Nessun early return che viola Rules of Hooks React — usare render condizionale
7. IMAP sempre in `asyncio.to_thread()`
