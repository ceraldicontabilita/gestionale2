# DIARIO — Ceraldi ERP
## Aggiornato: Chat 8/9 — 10 aprile 2026

---

## CHAT 8/9 — Pulizia, Event Bus, Responsive

### Pulizia e normalizzazione (branch pulizia/normalizzazione-v1 → mergato in main)

**Fix critici collection MongoDB:**
- `COL_FATTURE_RICEVUTE` ora punta a `"invoices"` (era `"indice_documenti"` — 3815 fatture invisibili)
- `Collections.DIPENDENTI` ora punta a `"dipendenti"` (era `"employees"`)
- `db["employees"]` sostituito con `db["dipendenti"]` in 28 file
- `Collections.SUPPLIERS` aggiunto (mancava — causava AttributeError silenzioso)
- `COLL_SUPPLIERS` ora punta a `"fornitori"` (era `"suppliers"`)

**File eliminati (codice morto):**
- `app/services/parser_f24_gemini.py` — usava Gemini AI non integrato
- `app/utils/normalize_fields.py` — zero import rimasti
- `app/routers/tracciabilita/migrazione_db.py` — script one-shot già eseguito
- `app/routers/f24/f24_tributi.py` — duplicato di f24_main
- `app/routers/accounting/accounting_f24.py` — duplicato, collideva con f24_main
- 33 righe di router commentati rimossi da main.py

**Fix routing:**
- Learning Machine CDC prefix `/learning-machine` → `/learning-cdc` (era in conflitto)
- `f24_gestione_avanzata` abilitato su `/api/f24-avanzato/*` (endpoint unici)

---

### Event Bus (app/core/)

**`app/core/event_bus.py`** — Bus centrale degli eventi (246 righe)
- Singleton `bus` importabile ovunque
- Retry 3 volte su errore con backoff
- Log in `eventi_sistema` su MongoDB
- Alert in `agenti_segnalazioni` se handler fallisce 3 volte

**`app/core/handlers_registry.py`** — 18 handler su 8 eventi
- Registrazione automatica all'avvio (lifespan main.py)

**Publish attivi nei router:**
- `fattura.importata` → `import_xml.py`
- `cedolino.importato` → `cedolini_manager.py`
- `corrispettivi.importati` → `corrispettivi_service.py`
- `estratto_conto.importato` → `estratto_conto.py`
- `fornitore.creato` → `fatture_module/helpers.py`

---

### Handler (app/handlers/)

| Handler | Evento | Cosa fa |
|---|---|---|
| `magazzino.py` | fattura.importata | Carica righe fattura in warehouse_movements |
| `scadenziario.py` | fattura.importata | Crea scadenza in scadenziario_fornitori |
| `learning.py` | fattura.importata | Classifica fattura per centro di costo |
| `fornitore.py` | fattura.importata / fornitore.creato | Aggiorna fornitori_keywords, check IBAN |
| `ricette.py` | fattura.importata / ingrediente.prezzo_cambiato | Ricalcola costi e margini ricette |
| `notifiche.py` | fattura.importata / cedolino.importato | Push WebSocket real-time |
| `prima_nota.py` | fattura.pagata / cedolino.importato | Scrive prima nota banca/cassa/salari |
| `tfr.py` | cedolino.importato | Aggiorna accantonamento TFR (art. 2120) |
| `estratto_conto.py` | estratto_conto.importato | Matching fatture/cedolini/F24/POS (score 0-100%) |
| `corrispettivi.py` | corrispettivi.importati | Prima nota cassa + check coerenza POS Nexi |

---

### Responsive frontend (27 file)

**`frontend/src/lib/utils.js`** — aggiunte:
- `useIsMobile(breakpoint)` — hook React auto-aggiornante
- `rg(isMobile, cols)` — helper grid responsive
- `RG` — preset col2/col3/col4/kpi/form
- `pagePad(isMobile)` — padding pagina

**Pagine aggiornate:** Dashboard, Admin, Fornitori, PrimaNota, HRDipendenti, HRCedolini, HRTFR, NoleggioAuto, Scadenze, LearningMachine, Commercialista, IntegrazioniOpenAPI, ClassificazioneDocumenti, BudgetPrevisionale, ArchivioBonifici, RiconciliazioneUnificata, DizionarioProdotti, ArchivioFattureRicevute, Riconciliazione, InserimentoRapido, GestioneCespiti, PianoDeiConti, Inventario, GestioneEmailMittenti, DocumentiDaRivedere + altri

**`frontend/src/styles.css`** — CSS globale mobile: tabelle scrollabili, padding ridotto, input full-width

**Emergent ha poi fixato** (commit 470e968): import utils.js rotti in 13 file + TracciabilitaPage ampliata

---

## TODO prossima chat

- [x] Aggiunto publish `fornitore.aggiornato` in suppliers_module/base.py
- [x] Aggiunto publish `ingrediente.prezzo_cambiato` in handlers/ricette.py (variazione > 5%)
- [ ] PIN dipendenti, Tablet Cucina, Rinomina frigo → appartengono a ceraldiapp.it
