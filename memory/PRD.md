# Ceraldi Group ERP - PRD

## Original Problem Statement
Sistema ERP full-stack (React Vite + FastAPI + MongoDB) per la gestione aziendale Ceraldi Group SRL. Il sistema include:
- Gestione fatture fornitori (ciclo passivo)
- Magazzino e prodotti
- Tracciabilità HACCP (mini-sito integrato via iframe)
- Contabilità / Prima Nota
- Commercialista (invio documenti)
- Fornitori / Anagrafica

## Architecture
- **Frontend**: React + Vite (su port 3000)
- **Backend**: FastAPI (su port 8001, esposto come /api)
- **Database**: MongoDB Atlas (azienda_erp_db)
- **Mini-sito**: CRA build servito staticamente da FastAPI su /api/tracciabilita

## Cosa è stato implementato (CHANGELOG)

### 2026-04-02 - Sessione corrente
- ✅ HMR disabilitato (vite.config.js: `hmr: false`) → stop ricaricamento 30s
- ✅ Endpoint `POST /api/commercialista/segna-inviata` → segna prima nota come inviata manualmente
- ✅ App.jsx: link "Vai a Commercialista" ora passa ?mese=&anno= → pre-seleziona il mese corretto
- ✅ Commercialista.jsx: useSearchParams per pre-selezionare mese/anno da URL + bottone "Segna come inviata"
- ✅ Supplier flag `escludi_da_tracciabilita` → aggiunto a form, card, e create_supplier
- ✅ Supplier card: badge "Escluso Magazzino" e "Escluso Tracciabilità" visibili
- ✅ Upload immagini tracciabilità: fixed dir a `/app/app/static/tracciabilita/uploads/`
- ✅ Router audit tracciabilità: import `from routers.xxx` → `from app.routers.tracciabilita.xxx`
- ✅ Fallback DB `'test_database'` → `'azienda_erp_db'` in tutti i router tracciabilità
- ✅ 4 nuovi router registrati: fatture, supervisor_operativo, utils, codici_cun
- ✅ CRA mini-site ricompilata: fix URL doppio `/api/` in SupervisoreBadge, RegistroAllergeniView
- ✅ Vecchi file build rimossi

### Sessioni precedenti
- Integrazione mini-sito Tracciabilità (CRA build → FastAPI StaticFiles → iframe)
- Rimozione moduli cucina (ricettario, food cost, catalogo, prodotti vendita)
- Migrazione 33 router tracciabilità sotto /api/tr/
- SMTP Commercialista configurato (smtp.gmail.com)
- Fix banner alert Commercialista (dismiss localStorage)
- Fix endpoint food_cost bug parsing

## Pending Issues
### P1 - Da verificare
- Email SMTP: testare invio effettivo prima nota cassa (SMTP_PASSWORD presente ma non testato)
- Immagini tracciabilità: i prodotti non hanno foto caricate (solo fix del path upload)

### P2 - Future Tasks
- Parser P7M per sblocco ulteriori fatture PEC
- `Portale.jsx` - verificare se usa Tailwind/Shadcn (da risolvere se riscontrato)
- Integrazione email IMAP Gmail (App Password da aggiornare per ceraldigroupsrl@gmail.com)

## Key API Endpoints
- GET /api/health → health check
- /api/suppliers → CRUD fornitori
- /api/commercialista/* → Prima nota, alert, invio email
- /api/tr/* → Tutti gli endpoint tracciabilità HACCP (85 fatture, 207 ricette, 11 lotti)
- /api/tracciabilita/ → Mini-sito CRA servito staticamente

## DB Collections
- suppliers, invoices, warehouse_products, commercialista_log, prima_nota_cassa
- Tracciabilità: lotti, ricette, produzioni, temperature_*, sanificazione, fornitori, fatture, ecc.
