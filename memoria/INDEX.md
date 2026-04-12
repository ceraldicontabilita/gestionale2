# Ceraldi ERP — Scheda Rapida
> DB: `Gestionale` (MongoDB Atlas) | P.IVA: 04523831214 | Aprile 2026

---

## Stack
| | Tecnologia |
|---|---|
| Backend | FastAPI + Motor (async) → porta 8001 |
| Frontend | React 18 + Vite → porta 3000 |
| Database | MongoDB Atlas (`Gestionale`) |
| Design | CSS inline da `lib/utils.js` — NO Tailwind, NO Shadcn |

## Collections Canoniche
```
dipendenti (30)                  ← HR (NON employees)
cedolini (301)                   ← Buste paga Zucchetti v2
presenze (290)                   ← Presenze giornaliere
invoices (1.405)                 ← Fatture SDI (TD01+TD04)
fornitori (245)                  ← Fornitori (NON suppliers)
prima_nota_cassa (136)           ← Cassa
prima_nota_banca (4.365)         ← Banca
corrispettivi (54)               ← UNICA fonte ricavi
estratto_conto_movimenti (8.839) ← Movimenti bancari
assegni (220)                    ← Assegni con fatture
warehouse_stocks (496)           ← Magazzino (NON warehouse_inventory)
verbali_noleggio (165)           ← Verbali auto
```

## Route Principali
```
/               → Dashboard
/fatture        → Fatture Ricevute (1.405)
/prima-nota     → Prima Nota (Cassa + Banca + Provvisori con Sospesa)
/fornitori      → Fornitori (245)
/dipendenti     → HR Dipendenti (30)
/cedolini       → Buste Paga (Per Mese / Per Dipendente)
/presenze       → Presenze Calendario + Import PDF
/noleggio       → Flotta Auto + Verbali (165)
/magazzino      → Giacenze (496 prodotti)
/riconciliazione → Banca + Assegni
/contabilita    → Piano Conti + Bilancio + IVA
/strumenti      → Verifica Coerenza + Commercialista
```

## Regole Critiche
1. **DB**: `Gestionale` (NON `azienda_erp_db`)
2. **Fornitori**: `fornitori` (NON `suppliers`)
3. **Magazzino**: `warehouse_stocks` (NON `warehouse_inventory`)
4. **Dipendenti**: `dipendenti` (NON `employees`)
5. **Cedolini display**: campo `nome_dipendente` (NON `dipendente_nome`)
6. **Note credito**: TD04 → importo negativo + badge rosso
7. **Ricavi**: SOLO da `corrispettivi` — `invoices` sono COSTI
8. **IMAP**: sempre in `asyncio.to_thread()`
9. **Settings**: `.env` ha priorità su OS env (intenzionale)
10. **server.py**: NON cancellare — avvio Supervisor

---
*Per dettagli: LOGICA_OPERATIVA.md | Per stato progetto: PRD.md*
