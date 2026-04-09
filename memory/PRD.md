# Ceraldi ERP — PRD

## Problema Originale
Applicazione ERP full-stack (React + FastAPI + MongoDB Atlas) per Ceraldi Caffè.
Aggiornamenti richiesti tramite file CERALDI_MASTER_ZIP.zip e ISTRUZIONI_CORRETTE_V2.md.

## Regole Fondamentali
- **Design system**: solo CSS inline con le costanti di `lib/utils.js`. Vietati Shadcn e Tailwind per le pagine gestionale.
- **Lingua**: rispondere SEMPRE in italiano.
- **DB**: MongoDB Atlas (`azienda_erp_db`) via `MONGO_URL` dal backend `.env`.
- **Backend script**: NON eliminare `/app/backend/server.py` (punto di avvio Supervisor).

## Architettura
```
/app
├── app/
│   ├── main.py
│   ├── routers/
│   │   ├── cucina/                     # Ricette, FoodCost, ProdottiVendita, OrdiniFornitori
│   │   ├── invoices/corrispettivi.py   # Corrispettivi telematici
│   │   ├── prima_nota_module/          # Prima Nota (Cassa + Banca)
│   │   ├── suppliers_module/           # Anagrafica Fornitori
│   │   └── fatture_module/             # Fatture Ricevute
├── frontend/src/
│   ├── main.jsx                        # React Router routes
│   ├── lib/utils.js                    # Design system (COLORS, STYLES, button, badge, ecc.)
│   ├── pages/
│   │   ├── Dashboard.jsx               # Dashboard principale (no widget cucina)
│   │   ├── hub/FattureHub.jsx          # Hub fatture (ArchivioContent | CorrispettiviContent)
│   │   ├── Corrispettivi.jsx           # Pagina corrispettivi (stato vuoto se no dati)
│   │   ├── ArchivioFattureRicevute.jsx # Archivio fatture — singola vista pulita (no tab interni)
│   │   ├── CicloPassivoAdmin.jsx       # File rimasto ma SENZA route attiva
│   │   ├── RicettarioAdmin.jsx         # Gestione ricette cucina
│   │   ├── FoodCostAdmin.jsx           # Gestione food cost
│   │   ├── CatalogoOrdini.jsx          # Catalogo ordini cucina
│   │   └── ProdottiVendita.jsx         # Prodotti vendita
│   └── components/layout/
│       ├── TopNav.jsx                  # Navigazione principale
│       └── SecondaryTabs.jsx           # Tab secondari per sezione
```

## Cosa è stato implementato

### Sessioni precedenti (completato)
- Eliminazione 34 file stub inutili dal backend
- Creazione router cucina: ricette.py, food_cost.py, prodotti_vendita.py, ordini_fornitori.py
- Creazione UI: RicettarioAdmin, FoodCostAdmin, CatalogoOrdini, ProdottiVendita
- Integrazione tab "Bozze" in OrdiniFornitori
- Fix Prima Nota: errore 422, deduplicazione Banca, query Cassa
- Fix Anagrafica Fornitori: piva vs partita_iva, card "Senza nome", filtro fatture
- Popolamento automatico form Anagrafica da XML
- Rimozione sezione Riconciliazione Unificata, /fatture/import, /previsioni-acquisti

### Sessione corrente (completato)
- **Corrispettivi**: rimosso stub vuoto dal DB → pagina mostra correttamente stato vuoto
- **Widget Cucina Dashboard**: RIMOSSO (su richiesta — gestionale non include più tracciabilità/ricette)
- **SecondaryTabs**: rimosso tab "Import XML" dalla sezione Fatture
- **CicloPassivoHub.jsx**: rimosso redirect, route /ciclo-passivo → redirect a /fatture
- **Route /ciclo-passivo/import**: ELIMINATA da main.jsx (import XML avviene solo da Import Documenti)
- **ArchivioFattureRicevute.jsx**: eliminati tab interni (📋 Archivio, 🔄 Riconcilia, ✅ Storico)
  - Rimossi stati e funzioni non necessari: dashboard, handlePayManual, handleMatchManuale, fetchDashboard, handleSelectScadenza, isScadenzaPassata, ecc.
  - Pagina mostra direttamente: statistiche + filtri + tabella fatture con pulsanti Vedi/Cassa/Banca

## Backlog / Task futuri
- **P2**: Integrazione Email IMAP — bloccata per App Password Gmail non valida (ceraldigroupsr@gmail.com)
- **P3**: Auth backend con Cookies HTTP-Only

## Key API Endpoints
- `GET /api/corrispettivi?anno=YYYY` — lista corrispettivi
- `GET /api/fatture-ricevute/archivio` — archivio fatture ricevute (filtri: anno, mese, stato, fornitore_piva, search)
- `GET /api/fatture-ricevute/statistiche` — stats fatture
- `POST /api/fatture-ricevute/paga-manuale` — registra pagamento (cassa o banca)
- `GET /api/cucina/ricette/stats` — statistiche ricette
- `POST /api/prima-nota/cassa` / `/banca` — movimenti prima nota
