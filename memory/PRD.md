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
- Auto-matcher Assegni (`POST /api/assegni/auto-match` + UI "🤖 Auto-collega",
  logica 4 livelli già documentata in `/app/memoria/LOGICA_OPERATIVA.md`)
- Tab contabili vuoti: Mutui, Budget, Chiusura Esercizio, Finanziaria, Cespiti
- Associazione automatica documenti Gmail (F24, cedolini, verbali)
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
