# PRD — Ceraldi ERP
<!-- Ultimo aggiornamento: 2026-04-09 -->
<!-- FIX APPLICATI: Fatture (invoices+fatture_passive unificati), Estratto Conto (data_contabile_obj) -->
> P.IVA: 04523831214 | Azienda: Ceraldi Group SRL | Aprile 2026

---

## PROBLEMA ORIGINALE
Costruire un gestionale ERP completo per un'azienda di ristorazione/pasticceria che gestisca:
contabilità, dipendenti, buste paga, magazzino, cucina/food cost, fatturazione elettronica,
estratto conto bancario, prima nota, HACCP e dashboard direzionale.

**Vincoli tecnici assoluti:**
- CSS inline ONLY da `lib/utils.js` — NO Tailwind, NO Shadcn per le pagine gestionali
- Rispondi sempre in ITALIANO
- Un blocco/passo alla volta, con save GitHub dopo ogni blocco
- IMAP (`imaplib`) SEMPRE in `asyncio.to_thread()` — mai bloccare l'event loop

---

## STACK TECNICO
- **Frontend**: React 18, Vite, lucide-react (icone), CSS inline (`lib/utils.js`)
- **Backend**: FastAPI, Motor (MongoDB asincrono), Python 3.11
- **Database**: MongoDB Atlas (`azienda_erp_db`)
- **Infrastruttura**: Supervisor (frontend :3000, backend :8001)
- **Email**: Gmail IMAP (App Password) + Aruba PEC (fatture SDI)

---

## FUNZIONALITÀ IMPLEMENTATE

### Contabilità
- [x] Prima Nota Cassa e Banca con filtri avanzati e saldi cumulativi
- [x] Sincronizzazione corrispettivi → cassa
- [x] Import estratto conto BPM (CSV)
- [x] F24 unificato con tab Tributi e Riconciliazione
- [x] Liquidazione IVA
- [x] Bilancio di verifica, Partitario, Budget previsionale
- [x] Conto economico dettagliato (Art. 2425 c.c.)

### Fatturazione / SDI
- [x] Import fatture XML da Aruba PEC
- [x] Parsing FatturaPA (SDI)
- [x] Classificazione automatica fornitori
- [x] Archivio fatture ricevute

### HR / Dipendenti
- [x] Anagrafica dipendenti (34 record, collection `dipendenti`)
- [x] Cedolini import da PDF (libro unico Zucchetti)
- [x] **Import cedolini da Gmail IMAP** — `POST /api/cedolini/import-gmail` (Apr 2026)
- [x] Presenze mensili e calendario
- [x] Gestione TFR e acconti
- [x] Pagine HR separate: HRDipendenti, HRCedolini, HRPresenze, HRTFR

### Cucina / Food Cost
- [x] Router backend `/api/cucina/` (ricette, food-cost, prodotti-vendita, ordini-fornitori)
- [x] Pagine admin: RicettarioAdmin, FoodCostAdmin, CatalogoOrdini, ProdottiVendita
- [x] Tab "Bozze da Tracciabilità" in OrdiniFornitori

### Magazzino
- [x] Warehouse inventory (6885 articoli)
- [x] Tracciabilità lotti con immagini prodotti
- [x] Carico da fattura XML

### Email / IMAP
- [x] Monitor email automatico (ogni ora)
- [x] Download allegati da mittenti autorizzati
- [x] De-duplicazione via Message-ID e hash file
- [x] Import cedolini da Gmail (sicuro, non bloccante)

---

## BACKLOG / PROSSIMI TASK

### P1 — Alta priorità
- [ ] **Passo 7**: Widget Cucina in `DashboardHub.jsx` — 2 StatCard: "Ordini in attesa" + "Ricette da approvare"
- [ ] Riabilitare scheduler email per fatture XML (Aruba PEC) con `asyncio.to_thread()`
- [ ] Parsing nome dipendente da filename cedolino Gmail → collegamento automatico a `dipendenti`

### P2 — Media priorità
- [ ] Gestione Ciclo Passivo (`ISTRUZIONI_CICLO_PASSIVO.md`)
- [ ] Verifica `Portale.jsx` — rimuovere Shadcn/Tailwind residui
- [ ] Match automatico cedolini Gmail ↔ dipendenti per nome/cognome

### P3 — Bassa priorità / Future
- [ ] Auth backend con cookies HTTP-Only (ora disabilitata: `AUTH_DISABLED=true`)
- [ ] Google Auth Portale
- [ ] Export PDF report direzionale
- [ ] Notifiche push scadenze F24/stipendi

---

## ROUTE FRONTEND

```
/                       → DashboardHub
/contabilita-hub        → ContabilitaHub
/dipendenti             → HRDipendenti
/dipendenti/cedolini    → HRCedolini (+ import Gmail)
/dipendenti/presenze    → HRPresenze
/dipendenti/tfr         → HRTFR
/cucina                 → CucinaHub
/cucina/ricettario      → RicettarioAdmin
/cucina/food-cost       → FoodCostAdmin
/cucina/catalogo        → CatalogoOrdini
/cucina/prodotti-vendita → ProdottiVendita
/fatture-ricevute       → ArchivioFattureRicevute
/prima-nota             → Prima Nota (cassa/banca)
/estratto-conto         → EstrattoConto
/cespiti                → Cespiti
/magazzino              → Magazzino
```

---

## REGOLE ASSOLUTE PER LO SVILUPPO

1. **Design**: `lib/utils.js` → `COLORS`, `STYLES`, `SPACING`. Solo CSS inline.
2. **IMAP**: sempre `asyncio.to_thread()`. Mai bloccare l'event loop.
3. **MongoDB**: escludere `_id` con `{"_id": 0}` o modelli Pydantic.
4. **Lingue**: rispondere SEMPRE in Italiano.
5. **server.py**: NON cancellare mai (`backend/server.py`).
6. **Collection**: dipendenti = `dipendenti` (non `employees`).
7. **Icone**: lucide-react ONLY (no emoji nel codice).
