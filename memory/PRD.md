# Ceraldi ERP — PRD

Prodotto: gestionale contabile / amministrativo interno.
Cliente: Ceraldi Group S.R.L. (P.IVA 04523831214) — bar / pasticceria, Napoli.
Ultima revisione: Apr 2026.

Documentazione viva completa in `/app/memoria/` (PRD.md · INDEX.md · LOGICA_OPERATIVA.md).
Questo file è il riepilogo per i tool interni Emergent.

## Obiettivo

Un unico gestionale che copra:
- Ciclo passivo (fatture SDI via PEC)
- Corrispettivi giornalieri (registratore)
- Prima nota cassa/banca + Provvisori
- Riconciliazione bancaria
- HR (dipendenti, cedolini, presenze, TFR)
- Noleggio auto + verbali stradali
- Magazzino prodotti
- Assegni per carnet
- Contabilità (piano conti, bilancio, IVA, cespiti, mutui, budget)
- Strumenti commercialista + verifica coerenza
- Alert scadenze F24

## Stack

- React 18 + Vite (frontend, porta 3000)
- FastAPI + Motor async (backend, porta 8001)
- MongoDB Atlas (DB: `Gestionale`)
- Design: inline styles da `src/lib/utils.js` — no Tailwind, no Shadcn

## Stato corrente

Funzionante in produzione: tutte le aree core (fatture, prima nota, fornitori, HR,
noleggio, magazzino, assegni, riconciliazione, contabilità, strumenti, email).

Attività recenti (Apr 2026):
- **[FEAT P1 auto-matcher Assegni – Apr 2026]** Implementato l'auto-matcher
  Assegni↔Fatture a 4 livelli (L1 1↔1, L2 N uguali→1, L3 N diversi→1, L4 1→N)
  con tolleranza rigida ±0,005€ e vincolo P.IVA fornitore.
  Orchestratore in `app/routers/bank/assegni_auto_match.py`, endpoint
  `POST /api/assegni/auto-match?dry_run=true|false`.
  Include arricchimento automatico P.IVA (dai nomi in `beneficiario` usando
  tabella `fornitori`) e dedup intelligente delle fatture duplicate nel DB.
  Genera movimenti `prima_nota_banca` con source=`assegno_auto_match` (idempotente).
  Aggiorna `invoices.importo_pagato`, `payment_status`, `assegni_collegati[]`.
  Frontend: 2 nuovi bottoni su `/riconciliazione/assegni`:
  `[data-testid=auto-match-btn]` (🤖 Auto-collega) + `[data-testid=auto-match-preview-btn]` (👁 Anteprima).
  Risultato su produzione: 220 assegni reali → 185 arricchiti P.IVA automaticamente,
  **44 match L1 eseguiti** + 44 movimenti banca + 44 fatture aggiornate, 9 ambigui genuini,
  idempotenza verificata. Test 100% (backend + frontend).
- **[FIX P0 corrispettivi – Apr 2026]** Riscritta l'ingestion dei Corrispettivi
  XML con anti-duplicato rigoroso a 3 livelli (corrispettivo_key, data+matricola,
  data+totale±0.01) e propagazione automatica in Prima Nota:
  quota contanti → `prima_nota_cassa` (source `corrispettivo_import`),
  quota POS → `prima_nota_banca` (source `corrispettivo_pos`).
  Helper centralizzato in `app/routers/invoices/corrispettivi_helpers.py`,
  usato da `/api/documenti/upload-auto`, `/api/corrispettivi/upload-xml`,
  `upload-xml-bulk`, `upload-zip`. Nuovi endpoint di manutenzione:
  `POST /api/corrispettivi/rebuild-prima-nota?anno=YYYY` e
  `POST /api/corrispettivi/cleanup-duplicati-forte?anno=YYYY`.
  Eseguito rebuild 2026: 50 corrispettivi → 50 mov. cassa + 50 mov. banca POS,
  quadratura contabile verificata (€50.222,60 cassa + €83.383,82 POS = €133.606,42).
  Test backend 7/7 passati.
- Refactoring grafico completo: design system unificato, palette navy + oro,
  layout full-frame, tabs uniformate, mobile-responsive (no scroll orizzontale).
- Rimosso Tailwind dalla build (PostCSS senza plugin).
- Fix backend: installati `lxml` + `primp` mancanti.
- Documentazione viva riscritta da zero in `/app/memoria/`.

## Backlog

P1:
- Tab contabili vuoti: Mutui, Budget, Chiusura Esercizio, Finanziaria, Cespiti
- Associazione automatica documenti Gmail (F24, cedolini, verbali)
- Risoluzione ambigui auto-match: UI per confermare manualmente gli assegni con più candidati (9 casi attualmente)
- Prima Nota automatica senza conferma per match E/C ≥90% confidenza
- Endpoint `/scarica-posta` per verbali via PEC (ancora stub)

P2:
- Controllo Mensile UI: aggiungere colonne POS banca + differenza esplicite
- Scheda fornitore completa (storico + scadenze + pattern)
- Fascicolo dipendente (cedolini + TFR + presenze + bonifici)
- Merge `suppliers` (15 legacy) in `fornitori` (245)
- Split `/app/app/routers/invoices/corrispettivi.py` (>1400 righe) per famiglie

P3:
- Pulsante auto-conferma fatture in pagina Fornitori
- Indicatore fornitori attivi in Magazzino
- PWA (manifest + service worker)
- TFR automatico da cedolino
- Controllo IVA mensile automatico + F24 suggerito
- Notifiche WhatsApp (Meta token già configurato)

## Regole invariabili

- DB: `Gestionale` (non `azienda_erp_db`)
- `fornitori` (non `suppliers`), `dipendenti` (non `employees`), `warehouse_stocks` (non `warehouse_inventory`)
- Ricavi SOLO da `corrispettivi`; le `invoices` sono costi
- Metodo pagamento fattura preso dal fornitore, mai dall'XML
- Note credito TD04 = importo negativo + badge rosso
- IMAP sempre in `asyncio.to_thread()`

Per dettagli operativi vedi `/app/memoria/LOGICA_OPERATIVA.md`.
