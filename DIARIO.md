# DIARIO — Ceraldi ERP
## Aggiornato: Chat 8 — 10 aprile 2026

---

## CHAT 8 — Fix reload continuo + router duplicati

### BUG CRITICO risolto: reload continuo app

**Causa:** `LearningMachine` usata nelle route di `main.jsx` (righe 191-192) ma mai importata con `lazy()`.
Questo causava un `ReferenceError` a runtime → crash router React → loop infinito di reload.
Tutta l'app era inutilizzabile: pagine non si caricavano, dati persi durante il caricamento.

**Fix:** Aggiunta in `frontend/src/main.jsx`:
```js
const LearningMachine = lazy(() => import("./pages/LearningMachine.jsx"));
```

### BUG MEDIO risolto: router duplicati in main.py

**settings_router** registrato due volte:
- Rimossa: `app.include_router(settings_router.router, prefix="/api", ...)`
- Mantenuta: `app.include_router(settings_router.router, prefix="/api/settings", ...)`

**Router Tracciabilità** registrati due volte:
- Rimosso: primo blocco `# --- Tracciabilita HACCP ---` (22 router, ~riga 351)
- Mantenuto: secondo blocco `_TR_ROUTERS` (43 router, più completo)

### Patch depositata
`claude-patches/chat-8-fix-reload-e-duplicati/`
- `main.jsx` → `frontend/src/main.jsx`
- `main.py` → `app/main.py`
- `ISTRUZIONI.md`

---

## CHAT 8/9 — (storico precedente)

### Pulizia e normalizzazione
- `COL_FATTURE_RICEVUTE` → `"invoices"`
- `Collections.DIPENDENTI` → `"dipendenti"`
- `COLL_SUPPLIERS` → `"fornitori"`
- File morti eliminati: parser_f24_gemini.py, normalize_fields.py, migrazione_db.py, f24_tributi.py, accounting_f24.py

### Event Bus (app/core/)
- `event_bus.py` + `handlers_registry.py` con 18 handler su 8 eventi
- Publish attivi: fattura.importata, cedolino.importato, corrispettivi.importati, estratto_conto.importato, fornitore.creato/aggiornato, ingrediente.prezzo_cambiato

### Responsive frontend
- `useIsMobile`, `rg`, `RG`, `pagePad` aggiunti a `lib/utils.js`
- 27 pagine aggiornate
- CSS globale mobile in `styles.css`

---

## TODO prossima chat (Chat 9)
- [ ] Verificare che Emergent applichi la patch e il reload scompaia
- [ ] Test caricamento fatture e cedolini post-fix
- [ ] PIN dipendenti, Tablet Cucina, Rinomina frigo → appartengono a ceraldiapp.it

