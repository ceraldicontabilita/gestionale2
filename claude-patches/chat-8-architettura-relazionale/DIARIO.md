# DIARIO SVILUPPO — Gestionale Ceraldi Group

---

## Chat 8 — 22 Aprile 2026

### Obiettivo
Definizione architettura relazionale completa del gestionale.

### Cosa è stato fatto
1. **Analisi stato attuale**: letto repo completo (~200 router, ~90 pagine JSX, ~90 collezioni MongoDB)
2. **Lette 10 specifiche operative** fornite da Enzo: Dipendenti, Cedolini, Fatture, Fornitori, F24, Prima Nota Banca, Prima Nota Cassa, Magazzino/Prodotti, Documenti/Inbox, Riconciliazione
3. **Decisioni architetturali approvate**:
   - Riconciliazione → collezione dedicata `riconciliazioni_match` (supporta N:M)
   - Alert → collezione unica `alerts` con codici standardizzati
   - Eventi → sincroni via `event_bus.py` (no Redis/Celery)
   - Partite aperte → materializzate in collezione `partite_aperte`
4. **Creato `PIANO_LAVORO_RELAZIONALE.md`** con:
   - Stato attuale sistema (moduli, collezioni, volumi)
   - 4 decisioni architetturali vincolanti
   - 6 nuovi servizi backend da creare
   - Piano 8 fasi (Chat 9-16)
   - Catalogo completo 40+ alert con trigger e chiusura
   - Mappa relazionale visuale dei moduli
   - Regole di sviluppo permanenti

### Cosa NON è stato fatto (rimandato a Chat 9)
- Nessun codice implementato
- Nessuna patch creata

### Prossimo passo — Chat 9
Fase 1: implementare i 6 servizi core (`event_bus.py`, `alert_engine.py`, `audit_logger.py`, `deduplica.py`, `partite_aperte_engine.py`, `riconciliazione_engine.py`) + aggiornare `db_collections.py` e `database.py` con nuove collezioni e indici.

### File di riferimento
- `PIANO_LAVORO_RELAZIONALE.md` — piano completo (salvato in outputs)
- Specifiche `.txt` — 10 documenti operativi forniti da Enzo

---
