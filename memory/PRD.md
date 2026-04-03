# Ceraldi Group ERP — PRD
## Ultimo aggiornamento: 2026-04-03

## Obiettivo
ERP full-stack (React + FastAPI + MongoDB Atlas) per Ceraldi Group Srl.
Database: `azienda_erp_db` su MongoDB Atlas (cloud, condiviso tra ERP e Tracciabilità).

## Utenti
- Admin: ceraldigroupsrl@gmail.com
- Accesso diretto (auth temporaneamente disabilitata per deploy)

## Stack Tecnico
- Frontend: React (Vite), lazy loading per tutte le pagine
- Backend: FastAPI (Python), Motor (async MongoDB)
- Supervisor: backend su porta 8001, frontend su porta 3000
- Deploy: Kubernetes (proxy Nginx)

---

## Architettura Hub (ristrutturazione completata 2026-04-02)

Ogni hub usa:
- `const { anno } = useAnnoGlobale()` — mai hardcodare l'anno
- Lazy import per ogni tab content
- URL navigation via `useNavigate` + `useLocation`
- Tab attivo letto da `useParams()` / `useLocation().pathname`

### Hub e Tab implementati

| Hub | Route | Tab |
|-----|-------|-----|
| DashboardHub | `/` | Dashboard principale (widget cucina già implementati) |
| FattureHub | `/fatture` | Archivio, Import/PEC, Corrispettivi |
| FiscoHub | `/fisco` | IVA, F24, Ric.F24, Codici Tributari, Cespiti, Scadenze |
| RiconciliazioneUnificata | `/riconciliazione-unificata` | Dashboard, Banca, Assegni, F24, Aruba, Stipendi, Documenti, **PayPal** |
| FornitoriHub | `/fornitori` | Lista, Ordini, Previsioni Acquisti |
| PrimaNotaHub | `/prima-nota` | (esistente) |
| GestioneDipendentiUnificata | `/dipendenti` | Anagrafica, Giustificativi, Contratti, Retribuzione, Bonifici, Acconti, Presenze, Turni, Richieste, StorOre, Saldo Ferie, Paghe, Veicoli, **TFR** |
| VeicoliHub | `/noleggio` | Flotta, Verbali, Riepilogo Costi |
| ContabilitaHub | `/contabilita` | Piano Conti, Bilancio, Verifica, Controllo, Motore, Calendario, Cespiti, Finanziaria, Chiusura, Budget, Mutui, Avanzata (12 tab) |
| MagazzinoHub | `/magazzino` | Giacenze, Inventario, Ricerca, Dizionario, Coerenza POS |
| CucinaHub | `/cucina` | (esistente) |
| DocumentiHub | `/documenti` | Archivio, Import, Da Rivedere, Classificazione, Correzione AI |
| StrumentiHub | `/strumenti` | Verifica Coerenza, Commercialista, Pianificazione, Email Download, Visure |
| LearningMachine | `/learning-machine` | Dashboard, Fornitori, Assegni, Documenti, **Regole Categorizzazione** |
| AdminHub | `/admin` | (esistente) |

---

## Redirect Chiave (compatibilità URL vecchi)

| Vecchio URL | Nuovo URL |
|------------|-----------|
| /riconciliazione | /riconciliazione-unificata |
| /riconciliazione-paypal | /riconciliazione-unificata/paypal |
| /fatture-ricevute | /fatture |
| /corrispettivi | /fatture/corrispettivi |
| /f24 | /fisco/f24 |
| /iva | /fisco/iva |
| /bilancio | /contabilita/bilancio |
| /mutui | /contabilita/mutui |
| /cespiti | /contabilita/cespiti |
| /inventario | /magazzino/inventario |
| /dizionario-articoli | /magazzino/articoli |
| /ricerca-prodotti | /magazzino/ricerca |
| /ordini-fornitori | /fornitori/ordini |
| /previsioni-acquisti | /fornitori/previsioni |
| /tfr | /dipendenti/tfr |
| /noleggio-auto | /noleggio |
| /verifica-coerenza | /strumenti/verifica |
| /commercialista | /strumenti/commercialista |
| /regole-categorizzazione | /learning-machine/regole |
| /import-documenti | /documenti/import |
| /correzione-ai | /documenti/correzione-ai |

---

## CSS Design System (topnav.css)

### Variabili :root aggiornate
- `--ceraldi-primary-light: #1a40b5` (blu scuro)
- `--ceraldi-secondary: #1336a0`
- `--ceraldi-text-nav: #ffffff` (bianco su sfondo blu)

### TopNav
- `position: fixed` con `z-index: 1000`
- Sfondo blu solido `var(--ceraldi-primary)`
- Tab attivo: sfondo bianco, testo blu primario
- Tab inattivo: testo `rgba(255,255,255,0.85)`
- Badge fatture: `#ff4444` (rosso visibile)
- Dot Banca: `#ffdd00` (giallo)
- Anno selector: sfondo semitrasparente bianco

### Secondary Tabs
- `position: fixed`, `top: var(--topnav-height)`
- Page content: `padding-top: calc(var(--total-header-height) + 8px)`

---

## TopNav Menu (aggiornato)

### Navigazione principale
- Dashboard, Fatture, Prima Nota, Banca ●, Fisco, Fornitori, HR, Tracciabilità, Altro

### Dropdown "Altro"
- Contabilità, Magazzino, Cucina, Documenti, Noleggio, Learning, Strumenti, Admin

---

## Fix Critici Applicati

1. **HMR Reload loop** → Plugin keepalive WebSocket in `vite.config.js` (NON TOCCARE)
2. **WebSocket disabilitato** → `useWebSocket.js` sostituito con stub no-op
3. **window.location.href** → `useNavigate` in Scadenze.jsx e RiconciliazionePaypal.jsx
4. **Alert Prima Nota Cassa** → scompare dopo invio (endpoint `/api/commercialista/segna-inviata`)
5. **Flag esclude_magazzino** → campo aggiunto a Fornitori
6. **Immagini Tracciabilità** → fix directory in `ricezione_merce.py`
7. **SupervisoreBadge** → fix doppio endpoint + rebuild CRA

---

## Backlog (P2)

- [ ] Parser P7M per sblocco fatture PEC (il fix è già nel repo dell'utente)
- [ ] Integrazione email IMAP Gmail (bloccata: App Password non valida)
- [ ] Gestione Ciclo Passivo avanzata (richiede `ISTRUZIONI_CICLO_PASSIVO.md` dall'utente)
- [ ] Portale.jsx — verifica conformità design system (non urgente)

---

## Router Backend Cucina

Tutti registrati in `/api/cucina/` (cartella: `/app/app/routers/cucina/`):
- `/ricette` — RicettarioAdmin (`ricette.py`)
- `/food-cost/*` — FoodCostAdmin (`food_cost.py`)
- `/prodotti-vendita/*` — ProdottiVendita (`prodotti_vendita.py`)
- `/ordini-fornitori/*` — OrdiniFornitori cucina (`ordini_fornitori.py`)

## CucinaHub Tab (aggiornato 2026-04-02)

`/cucina/:tab` — 4 tab navigabili:
| Tab | ID | Componente |
|-----|----|------------|
| Ricettario | `ricettario` | RicettarioAdmin.jsx |
| Food Cost | `food-cost` | FoodCostAdmin.jsx |
| Catalogo Ordini | `catalogo-ordini` | CatalogoOrdini.jsx |
| Prodotti Vendita | `prodotti-vendita` | ProdottiVendita.jsx |


---

## Portale Dipendenti (Completato 2026-04-03)

**Route:** `/portale`
**Auth:** Google Auth tramite auth.emergentagent.com (Emergent-managed)
**File:** `frontend/src/pages/Portale.jsx`

### Funzionalità implementate:
- Login con Google (redirect a auth.emergentagent.com)
- Visualizzazione cedolini paga con download PDF
- Visualizzazione contratti (da firmare / firmati)
- **Firma Elettronica Semplice (FES) art.3 eIDAS:**
  - Step 1: Lettura contratto (scroll tracking)
  - Step 2: Canvas firma touchscreen (funziona su tablet/cellulare con touch events)
  - Digitazione nome completo (validazione fuzzy con thefuzz)
  - 2 checkbox obbligatorie (ho letto, accetto)
  - Timer lettura (minimo 5 secondi)
  - Hash firma univoco (SHA-256) + timestamp + IP
  - Salvataggio in `documenti_firmati` e aggiornamento `employee_contracts`
  - Notifica admin in `agenti_segnalazioni`

### Backend (`app/routers/portal.py`):
- `POST /api/portal/portale/firma/{documento_id}` — firma con canvas
- `GET /api/portal/portale/cedolini` — cedolini dipendente autenticato
- `GET /api/portal/portale/cedolini/{id}/pdf` — download PDF
- `GET /api/portal/portale/contratti` — contratti dipendente
- `POST /api/portal/collega-google` — collega account Google
- `POST /api/portal/genera-invito/{dipendente_id}` — genera codice invito

### Pulizia effettuata (2026-04-03):
- Rimossi 5 endpoint stub inutilizzati da portal.py (login-password, forgot, reset-password, register-from-invite, send-invites)

---

## Task Pendenti (Backlog)

### P0
- Pulizia chirurgica router inutilizzati in main.py (richiede analisi profonda per evitare regressioni)
- Verifica globale bottoni azione (Cestino) — test approfondito

### P1
- Passo 7: Widget Cucina in DashboardHub (StatCard: Ordini in attesa, Ricette da approvare)
- Gestione Ciclo Passivo (da ISTRUZIONI_CICLO_PASSIVO.md)

### P2
- Sicurezza auth backend (Cookies HTTP-Only)
- Email integration fix (credenziali Gmail App Password scadute)


---

## Fix 2026-04-03 (sessione corrente)

### Bug risolti
1. **Dashboard Prossime Scadenze — Icona Vedi (404)**: `view-assoinvoice` cerca ora anche in `invoices` oltre a `indice_documenti`
2. **Dashboard Prossime Scadenze — Pagamento non sparisce**: `setScadenzeData` era undefined in `ScadenzeWidget` (fuori scope); ora usa `paidIds` state locale — la scadenza sparisce immediatamente

### Nuove funzionalità
- **Scanner PagoPA Quietanze** (`/app/app/services/pagopa_scanner.py`):
  - 3 mittenti: partenopay@ext.comune.napoli.it, noreply-checkout@ricevute.pagopa.it, notifica.pl.napoli@pec.it
  - Cerca numero verbale nel CORPO dell'email (pattern B/A + 10-12 cifre)
  - PDF allegato salvato o generato dal corpo con reportlab
  - Endpoint: `POST /api/verbali-riconciliazione/scan-pagopa?days_back=N`
  - Endpoint: `GET /api/verbali-riconciliazione/quietanze-verbale/{numero_verbale}`
  - Endpoint: `GET /api/verbali-riconciliazione/quietanze-verbale/{numero_verbale}/pdf`
- **Riconciliazione verbali migliorata**: cerca in body, note, oggetto, subject, items (non solo descrizione)

### Task aggiornati
- P0 Bottoni azione: risolto (ScadenzeWidget paidIds)
- Passo 7 Widget Cucina: BACKLOG
- Ciclo Passivo: BACKLOG
- Email integration Gmail: OPERATIVA (credenziali valide in .env)
- Sicurezza backend HTTP-Only: da fare
