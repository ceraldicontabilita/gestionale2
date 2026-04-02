# MAPPA STRUTTURALE COMPLETA — Sistema HACCP Ceraldi Group

> Generata il 28/03/2026 — Analisi automatica del codice sorgente

---

## INDICE
1. [Architettura Generale](#1-architettura-generale)
2. [Backend — Router e Endpoint](#2-backend--router-e-endpoint)
3. [Frontend — Pagine JSX e Connessioni](#3-frontend--pagine-jsx-e-connessioni)
4. [BUG NOTI E POSIZIONE ESATTA](#4-bug-noti-e-posizione-esatta)
5. [Endpoint Rotti / Disallineati](#5-endpoint-rotti--disallineati)
6. [Mappa Visuale Connessioni](#6-mappa-visuale-connessioni)

---

## 1. ARCHITETTURA GENERALE

```
Browser
  └── React App (porta 3000)
        └── App.js (routing via hash #tab-name)
              ├── Ogni tab → componente JSX dedicato
              └── Ogni componente → axios.get/post → ${API}/api/...

Backend FastAPI (porta 8001)
  └── server.py → api_router (prefix="/api")
        ├── 37 router montati su api_router
        └── 4 route dirette su api_router (haccp auto-update, ecc.)

Database MongoDB (localhost:27017)
  └── DB: test_database
        └── 34 collection
```

**Variabili ambiente:**
- Frontend: `REACT_APP_BACKEND_URL` = `https://food-cost-calc-14.preview.emergentagent.com`
- Backend: `MONGO_URL` = `mongodb://localhost:27017`, `DB_NAME` = `test_database`

---

## 2. BACKEND — ROUTER E ENDPOINT

### Legenda
- ✅ Funzionante (verificato curl 200)
- ⚠️ Parzialmente rotto (risposta anomala)
- ❌ Rotto / 404 / 500

---

### 2.1 `/api/attrezzature` — `routers/attrezzature.py`
Gestisce l'elenco dinamico di frigoriferi e congelatori (fonte unica di verità).

| Metodo | Endpoint | Descrizione | Stato |
|--------|----------|-------------|-------|
| GET | `/api/attrezzature/` | Lista completa frigo+congelatori | ✅ |
| GET | `/api/attrezzature/frigo` | Solo frigoriferi | ✅ |
| GET | `/api/attrezzature/congelatori` | Solo congelatori | ✅ |
| POST | `/api/attrezzature/frigo` | Aggiunge frigorifero | ✅ |
| POST | `/api/attrezzature/congelatore` | Aggiunge congelatore | ✅ |
| PUT | `/api/attrezzature/frigo/{numero}/rinomina` | Rinomina frigo | ✅ |
| PUT | `/api/attrezzature/congelatore/{numero}/rinomina` | Rinomina congelatore | ✅ |
| DELETE | `/api/attrezzature/frigo/{numero}` | Elimina frigo | ✅ |
| DELETE | `/api/attrezzature/congelatore/{numero}` | Elimina congelatore | ✅ |

**Collection MongoDB:** `attrezzature_config`

---

### 2.2 `/api/ricette` — `routers/ricette.py` (prefix: nessuno, montato su root)
Gestione completa delle ricette di produzione.

| Metodo | Endpoint | Descrizione | Stato |
|--------|----------|-------------|-------|
| GET | `/api/ricette` | Lista tutte le ricette | ✅ |
| GET | `/api/ricette-prezzi` | Ricette con prezzi di vendita | ✅ |
| GET | `/api/ricette/{id}` | Singola ricetta | ✅ |
| POST | `/api/ricette` | Crea ricetta | ✅ |
| PUT | `/api/ricette/{id}` | Aggiorna ricetta | ✅ |
| PATCH | `/api/ricette/{id}` | Aggiornamento parziale | ✅ |
| DELETE | `/api/ricette/{id}` | Elimina ricetta | ✅ |
| PUT | `/api/ricette/{id}/prezzo-vendita` | Imposta prezzo vendita | ✅ |
| PUT | `/api/ricette/{id}/reparto` | Assegna reparto | ✅ |
| PUT | `/api/ricette/{id}/foto` | Aggiorna URL foto | ✅ |
| POST | `/api/ricette/{id}/upload-foto` | Carica foto | ✅ |
| PUT | `/api/ricette/{id}/ingredienti-dettaglio` | Aggiorna ingredienti | ✅ |
| GET | `/api/ricette/export/pdf` | Esporta PDF ricette | ✅ |
| GET | `/api/ricette/export/csv` | Esporta CSV | ✅ |
| GET | `/api/ricette/export/json` | Esporta JSON | ✅ |
| GET | `/api/ricette-libro` | Libro ricette (per RicettarioView) | ✅ |
| GET | `/api/ricette-libro/{id}` | Dettaglio ricetta libro | ✅ |
| GET | `/api/tablet/{reparto}` | Ricette per tablet reparto | ✅ |
| POST | `/api/ricette/auto-assegna-reparti` | Auto-assegna reparti | ✅ |
| POST | `/api/ricette/pulisci-ingredienti` | Pulizia ingredienti | ✅ |
| POST | `/api/ricette/popola-quantita-esempio` | Popola dati esempio | ✅ |

**Collection MongoDB:** `ricette`

---

### 2.3 `/api/food-cost` — `routers/food_cost.py`
Calcolo costi, dizionario prodotti, mappatura ingredienti.

| Metodo | Endpoint | Descrizione | Stato |
|--------|----------|-------------|-------|
| GET | `/api/food-cost/dizionario` | Dizionario prodotti da fatture | ✅ |
| GET | `/api/food-cost/dizionario/search` | Ricerca nel dizionario | ✅ |
| GET | `/api/food-cost/semilavorati-acquaviva` | Semilavorati Acquaviva | ✅ |
| POST | `/api/food-cost/dizionario/manuale` | Aggiunge prodotto manuale | ✅ |
| GET | `/api/food-cost/dizionario/manuali` | Lista prodotti manuali | ✅ |
| DELETE | `/api/food-cost/dizionario/manuale/{nome}` | Elimina prodotto manuale | ✅ |
| POST | `/api/food-cost/dizionario` | Aggiunge al dizionario | ✅ |
| PUT | `/api/food-cost/dizionario/{id}` | Aggiorna prodotto dizionario | ✅ |
| DELETE | `/api/food-cost/dizionario/{id}` | Elimina da dizionario | ✅ |
| POST | `/api/food-cost/sincronizza-fatture` | Sincronizza prezzi da fatture | ✅ |
| GET | `/api/food-cost/calcola/{ricetta_id}` | Calcola food cost ricetta | ✅ |
| POST | `/api/food-cost/ricalcola-costi-tutte-ricette` | Ricalcola tutti i costi | ✅ |
| POST | `/api/food-cost/auto-mappa-ingredienti` | Mappatura automatica | ✅ |
| POST | `/api/food-cost/aggiorna-ingredienti-ricetta` | Aggiorna ingredienti | ✅ |
| POST | `/api/food-cost/rinomina-ingrediente` | Rinomina ingrediente | ✅ |
| POST | `/api/food-cost/salva-porzioni-ricetta` | Salva pezzi base ricetta | ✅ |
| POST | `/api/food-cost/usa-ricetta` | Usa ricetta (scala inventario) | ✅ |
| GET | `/api/food-cost/ricette-riepilogo` | Riepilogo costi tutte le ricette | ✅ |
| GET | `/api/food-cost/stampa-ricetta/{id}` | Stampa ricetta HTML | ✅ |

**Collection MongoDB:** `dizionario_prodotti`, `ricette`

---

### 2.4 `/api/fatture` — `routers/fatture.py`
Gestione fatture XML importate.

| Metodo | Endpoint | Descrizione | Stato |
|--------|----------|-------------|-------|
| GET | `/api/fatture` | Lista fatture | ✅ |
| DELETE | `/api/fatture/{id}` | Elimina fattura | ✅ |
| POST | `/api/fatture/backfill-lotto-quantita` | Aggiorna quantità lotti | ✅ |
| GET | `/api/fatture/{id}/visualizza` | Visualizza fattura HTML | ✅ |
| POST | `/api/fatture/importa-xml` | Importa file XML | ✅ |

> ⚠️ **BUG**: `ImportaFattureView.jsx` chiama `/api/importa-xml` (senza `/fatture/`).
> Endpoint corretto: `/api/fatture/importa-xml`

**Collection MongoDB:** `fatture`

---

### 2.5 `/api/lotti` — `routers/lotti_produzione.py` (prefix: nessuno)
Tracciabilità lotti di produzione.

| Metodo | Endpoint | Descrizione | Stato |
|--------|----------|-------------|-------|
| GET | `/api/lotti` | Lista lotti | ✅ |
| GET | `/api/lotti/recall/cerca` | Ricerca recall (richiede param `ingrediente`) | ⚠️ 422 se manca param |
| GET | `/api/lotti/{id}` | Singolo lotto | ✅ |
| DELETE | `/api/lotti/{id}` | Elimina lotto | ✅ |
| PATCH | `/api/lotti/{id}/consuma` | Consuma lotto | ✅ |
| GET | `/api/anteprima-codice-lotto/{prodotto}` | Anteprima codice | ✅ |
| GET | `/api/unita-misura/{prodotto}` | Unità misura prodotto | ✅ |
| GET | `/api/prodotti-in-kg` | Prodotti in kg | ✅ |
| POST | `/api/registra-produzione-lotto` | Registra produzione | ✅ |
| POST | `/api/genera-lotto/{ricetta}` | Genera lotto da ricetta | ✅ |
| GET | `/api/registro-lotti/{anno}/{mese}` | Registro HTML mensile | ✅ |
| GET | `/api/registro-lotti/{anno}/{mese}/csv` | Registro CSV | ✅ |
| GET | `/api/registro-lotti/{anno}` | Registro HTML annuale | ✅ |
| POST | `/api/lotti/ricalcola-scadenze` | Ricalcola scadenze | ✅ |

**Collection MongoDB:** `lotti`

---

### 2.6 `/api/lotti-fornitori` — `routers/lotti_fornitori.py`
Lotti delle materie prime (da fatture fornitori).

| Metodo | Endpoint | Descrizione | Stato |
|--------|----------|-------------|-------|
| GET | `/api/lotti-fornitori` | Lista lotti fornitori | ✅ |
| GET | `/api/lotti-fornitori/summary` | Riepilogo | ✅ |
| GET | `/api/lotti-fornitori/per-ingrediente/{nome}` | Lotti per ingrediente | ✅ |
| POST | `/api/lotti-fornitori/scala-scorta` | Scala scorta | ✅ |
| POST | `/api/lotti-fornitori/importa-da-fatture` | Importa da fatture | ✅ |
| POST | `/api/lotti-fornitori/aggiungi-manuale` | Aggiunge manuale | ✅ |
| DELETE | `/api/lotti-fornitori/pulizia-scaduti` | Elimina scaduti | ✅ |
| DELETE | `/api/lotti-fornitori/{id}` | Elimina singolo | ✅ |
| POST | `/api/lotti-fornitori/reimporta-da-fatture` | Reimporta tutto | ✅ |

**Collection MongoDB:** `lotti_fornitori`

---

### 2.7 `/api/fornitori` — `routers/fornitori.py`
Gestione fornitori: approvazione, esclusione, anagrafiche.

| Metodo | Endpoint | Descrizione | Stato |
|--------|----------|-------------|-------|
| GET | `/api/fornitori` | Lista fornitori | ✅ |
| GET | `/api/fornitori/in-attesa/count` | Conteggio in attesa | ✅ |
| GET | `/api/fornitori/in-attesa` | Fornitori in attesa | ✅ |
| POST | `/api/fornitori/approva` | Approva fornitore | ✅ |
| POST | `/api/fornitori/escludi` | Esclude fornitore | ✅ |
| GET | `/api/fornitori/esclusi` | Lista esclusi | ✅ |
| GET | `/api/fornitori/{nome}/anagrafica` | Anagrafica fornitore | ✅ |
| PUT | `/api/fornitori/{nome}/anagrafica` | Aggiorna anagrafica | ✅ |
| POST | `/api/fornitori/note` | Aggiunge nota | ✅ |

---

### 2.8 `/api/prodotti-vendita` — `routers/prodotti_vendita.py`
Catalogo prodotti in vendita con prezzi e margini.

| Metodo | Endpoint | Descrizione | Stato |
|--------|----------|-------------|-------|
| GET | `/api/prodotti-vendita/` | Lista prodotti | ✅ |
| GET | `/api/prodotti-vendita/categorie` | Categorie | ✅ |
| GET | `/api/prodotti-vendita/anteprima-prezzi-margine` | Anteprima margini | ✅ |
| GET | `/api/prodotti-vendita/{id}` | Singolo prodotto | ✅ |
| POST | `/api/prodotti-vendita/` | Crea prodotto | ✅ |
| PUT | `/api/prodotti-vendita/{id}` | Aggiorna prodotto | ✅ |
| PUT | `/api/prodotti-vendita/{id}/prezzo` | Imposta prezzo | ✅ |
| GET | `/api/prodotti-vendita/{id}/presenza` | Verifica presenza | ✅ |
| DELETE | `/api/prodotti-vendita/{id}/cascade` | Elimina con cascade | ✅ |
| DELETE | `/api/prodotti-vendita/{id}` | Elimina prodotto | ✅ |
| POST | `/api/prodotti-vendita/sync-acquaviva` | Sync da Acquaviva | ✅ |
| POST | `/api/prodotti-vendita/ricalcola-costi-acquaviva` | Ricalcola costi | ✅ |
| POST | `/api/prodotti-vendita/sync-da-ricette` | Sync da ricette | ✅ |
| POST | `/api/prodotti-vendita/imposta-prezzi-da-margine` | Prezzi da margine | ✅ |
| POST | `/api/prodotti-vendita/auto-categorie` | Auto-assegna categorie | ✅ |
| GET | `/api/prodotti-vendita/stats/margini` | Statistiche margini | ✅ |

> ⚠️ **BUG**: `ProdottiVenditaView.jsx` chiama `/api/prodotti-vendita/sync` (inesistente).
> Endpoint corretto: `/api/prodotti-vendita/sync-da-ricette`

**Collection MongoDB:** `prodotti_vendita`

---

### 2.9 `/api/produzioni` — `routers/produzioni.py`
Storico produzioni (ricette prodotte con date e quantità).

| Metodo | Endpoint | Descrizione | Stato |
|--------|----------|-------------|-------|
| POST | `/api/produzioni/` | Registra produzione | ✅ |
| GET | `/api/produzioni/` | Lista produzioni | ✅ |
| GET | `/api/produzioni/stats` | Statistiche | ✅ |
| GET | `/api/produzioni/trend` | Trend produzioni | ✅ |
| GET | `/api/produzioni/per-giorno` | Per giorno | ✅ |
| GET | `/api/produzioni/riepilogo` | Riepilogo | ✅ |
| DELETE | `/api/produzioni/{id}` | Elimina produzione | ✅ |

**Collection MongoDB:** `produzioni`

---

### 2.10 `/api/temperature-positive` — `routers/temperature_positive.py`
Registro temperature frigoriferi positivi.

| Metodo | Endpoint | Descrizione | Stato |
|--------|----------|-------------|-------|
| GET | `/api/temperature-positive/scheda/{anno}/{frigo}` | Scheda anno/frigo | ✅ |
| GET | `/api/temperature-positive/schede/{anno}` | Tutte schede anno | ✅ |
| POST | `/api/temperature-positive/scheda/{anno}/{frigo}/registra` | Registra temperatura | ✅ |
| PUT | `/api/temperature-positive/scheda/{anno}/{frigo}` | Aggiorna scheda | ✅ |
| PUT | `/api/temperature-positive/scheda/{anno}/{frigo}/config` | Config range temp | ✅ |
| GET | `/api/temperature-positive/mesi` | Mesi con dati | ✅ |
| GET | `/api/temperature-positive/allarmi/{anno}` | Allarmi temperatura | ✅ |
| GET | `/api/temperature-positive/operatori` | Lista operatori | ✅ |
| POST | `/api/temperature-positive/operatori` | Aggiunge operatore | ✅ |
| GET | `/api/temperature-positive/riferimenti-normativi` | Riferimenti legge | ✅ |
| POST | `/api/temperature-positive/popola-con-chiusure/{anno}` | Backfill storico | ✅ |

**Collection MongoDB:** `temperature_positive`
**Struttura doc:** `{anno: int, frigorifero_numero: int, frigorifero_nome: str, temperature: {str(mese): {str(giorno): float}}}`

---

### 2.11 `/api/temperature-negative` — `routers/temperature_negative.py`
Registro temperature congelatori (negativo). Struttura identica a temperature-positive.

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET/POST/PUT | `/api/temperature-negative/scheda/{anno}/{cong}` | Scheda congelatore |
| GET | `/api/temperature-negative/allarmi/{anno}` | Allarmi |
| POST | `/api/temperature-negative/popola-con-chiusure/{anno}` | Backfill storico |

**Collection MongoDB:** `temperature_negative`

---

### 2.12 `/api/sanificazione` — `routers/sanificazione.py`
Registro sanificazioni attrezzature.

| Metodo | Endpoint | Descrizione | Stato |
|--------|----------|-------------|-------|
| GET | `/api/sanificazione/scheda/{anno}/{mese}` | Scheda mensile | ✅ |
| POST | `/api/sanificazione/scheda/{anno}/{mese}/registra` | Registra intervento | ✅ |
| PUT | `/api/sanificazione/scheda/{anno}/{mese}` | Aggiorna scheda | ✅ |
| POST | `/api/sanificazione/scheda/{anno}/{mese}/giorno-completo` | Giorno completo | ✅ |
| GET | `/api/sanificazione/attrezzature` | Lista attrezzature | ✅ |
| POST | `/api/sanificazione/attrezzature` | Aggiunge attrezzatura | ✅ |
| GET | `/api/sanificazione/storico` | Storico sanificazioni | ✅ |
| POST | `/api/sanificazione/popola-attrezzature` | Popola attrezzature | ✅ |
| GET | `/api/sanificazione/apparecchi/{anno}` | Apparecchi per anno | ✅ |
| POST | `/api/sanificazione/apparecchi/{anno}/registra` | Registra apparecchio | ✅ |
| POST | `/api/sanificazione/apparecchi/{anno}/rigenera` | Rigenera storico | ✅ |
| GET | `/api/sanificazione/statistiche/{anno}` | Statistiche | ✅ |
| GET | `/api/sanificazione/export-pdf/{anno}/{mese}` | Export PDF | ✅ |

**Collection MongoDB:** `sanificazione`
**Struttura doc (flat):** `{data: "YYYY-MM-DD", area: str, eseguita: bool, prodotto_utilizzato: str, operatore: str}`

---

### 2.13 `/api/disinfestazione` — `routers/disinfestazione.py`
Registro interventi di disinfestazione.

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | `/api/disinfestazione/scheda-annuale/{anno}` | Scheda anno |
| GET | `/api/disinfestazione/interventi/{anno}` | Interventi |
| GET | `/api/disinfestazione/monitoraggio/{anno}` | Monitoraggio |
| POST | `/api/disinfestazione/registra-intervento/{anno}/{mese}` | Registra |
| POST | `/api/disinfestazione/rigenera/{anno}` | Rigenera storico |
| GET | `/api/disinfestazione/export-pdf/{anno}` | Export PDF |

**Collection MongoDB:** `disinfestazione`

---

### 2.14 `/api/anomalie` — `routers/anomalie.py`
Gestione anomalie e non conformità.

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | `/api/anomalie/lista` | Lista anomalie |
| GET | `/api/anomalie/{id}` | Singola anomalia |
| POST | `/api/anomalie/registra` | Registra anomalia |
| PUT | `/api/anomalie/{id}` | Aggiorna |
| DELETE | `/api/anomalie/{id}` | Elimina |
| GET | `/api/anomalie/statistiche` | Statistiche |
| POST | `/api/anomalie/genera-storico` | Genera storico |
| GET | `/api/anomalie/report-pdf/{anno}` | Report PDF anno |
| GET | `/api/anomalie/report-pdf-range` | Report PDF range date |

**Collection MongoDB:** `anomalie`

---

### 2.15 `/api/vendita-banco` — `routers/vendita_banco.py`
Registro vendite al banco (tablet).

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/api/vendita-banco/registra` | Registra vendita |
| PUT | `/api/vendita-banco/{id}/invenduto` | Segna invenduto |
| GET | `/api/vendita-banco/oggi` | Vendite oggi |
| GET | `/api/vendita-banco/giorno/{data}` | Vendite giorno specifico |
| GET | `/api/vendita-banco/statistiche` | Statistiche |
| GET | `/api/vendita-banco/trend-giornaliero` | Trend giornaliero |
| PUT | `/api/vendita-banco/{id}/riapri` | Riapri vendita |
| DELETE | `/api/vendita-banco/{id}` | Elimina vendita |

**Collection MongoDB:** `vendite_banco`

---

### 2.16 `/api/acquaviva` — `routers/acquaviva.py`
Integrazione con listino Acquaviva (semilavorati).

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | `/api/acquaviva/prodotti` | Lista prodotti |
| GET | `/api/acquaviva/prodotti/senza-glutine` | Solo senza glutine |
| POST | `/api/acquaviva/import-listino` | Importa listino |
| PUT | `/api/acquaviva/prodotti/{id}/prezzo` | Aggiorna prezzo |
| POST | `/api/acquaviva/registra-vendita` | Registra vendita |
| GET | `/api/acquaviva/storico-vendite` | Storico |
| GET | `/api/acquaviva/categorie` | Categorie |
| POST | `/api/acquaviva/sync-prezzi` | Sync prezzi |

**Collection MongoDB:** `acquaviva_prodotti`

---

### 2.17 `/api/saima` e `/api/saima/ricettari` — `routers/saima.py` + `saima_ricettari.py`
Integrazione SAIMA S.p.A. (catalogo prodotti e ricettari PDF).

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | `/api/saima/categorie` | Categorie SAIMA |
| GET | `/api/saima/prodotti` | Prodotti SAIMA |
| POST | `/api/saima/scraping/avvia` | Avvia scraping |
| GET | `/api/saima/scraping/stato` | Stato scraping |
| GET | `/api/saima/ricettari` | Lista ricettari PDF |
| GET | `/api/saima/ricettari/pdf-proxy` | Proxy PDF (evita CORS) |
| POST | `/api/saima/ricettari/aggiorna` | Aggiorna lista |
| POST | `/api/saima/ricettari/aggiungi` | Aggiunge ricettario |
| DELETE | `/api/saima/ricettari/{id}` | Elimina ricettario |

---

### 2.18 `/api/mepa` — `routers/mepa.py`
Integrazione MePa (Mercato Elettronico PA).

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | `/api/mepa/categorie` | Categorie MePa |
| GET | `/api/mepa/prodotti` | Prodotti MePa |
| POST | `/api/mepa/scraping/avvia` | Avvia scraping |
| GET | `/api/mepa/scraping/stato` | Stato scraping |
| GET | `/api/mepa/dettaglio-prodotto` | Dettaglio prodotto |

---

### 2.19 `/api/pec` — `routers/pec_import.py`
Import automatico fatture XML da casella PEC Aruba.

| Metodo | Endpoint | Descrizione | Stato |
|--------|----------|-------------|-------|
| GET | `/api/pec/status` | Stato connessione PEC | ✅ |
| POST | `/api/pec/import` | Importa fatture da PEC | ✅ |
| POST | `/api/pec/ricalcola-costi-da-fatture` | Ricalcola costi | ✅ |

> ⚠️ `PECImportView.jsx` chiama anche `/api/pec/preview` che **non esiste** nel router.

---

### 2.20 `/api/scheduler` — `routers/scheduler.py`
Job schedulati (APScheduler): import PEC (ore 3) e HACCP (ore 2).

| Metodo | Endpoint | Descrizione | Stato |
|--------|----------|-------------|-------|
| GET | `/api/scheduler/status` | Stato scheduler | ✅ |
| POST | `/api/scheduler/start` | Avvia scheduler | ✅ |
| POST | `/api/scheduler/stop` | Ferma scheduler | ✅ |
| POST | `/api/scheduler/run-pec-now` | Esegui import PEC ora | ✅ |
| POST | `/api/scheduler/run-haccp-now` | Esegui HACCP ora | ✅ |
| GET | `/api/scheduler/logs` | Log esecuzioni | ✅ |

---

### 2.21 `/api/sconti-merce` — `routers/sconti_merce.py`
Sconti merce ricevuti dai fornitori.

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | `/api/sconti-merce/` | Lista sconti |
| POST | `/api/sconti-merce/` | Aggiunge sconto |
| PUT | `/api/sconti-merce/{id}` | Aggiorna |
| DELETE | `/api/sconti-merce/{id}` | Elimina |
| POST | `/api/sconti-merce/importa-da-fatture` | Importa da fatture |
| GET | `/api/sconti-merce/prodotti-fornitore` | Prodotti per fornitore |
| GET | `/api/sconti-merce/riepilogo/mensile` | Riepilogo mensile |
| GET | `/api/sconti-merce/riepilogo/fornitori` | Riepilogo per fornitore |

---

### 2.22 `/api/materie-prime` — `routers/materie_prime.py`
Registro materie prime con allergeni.

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | `/api/materie-prime/storico` | Storico materie prime |
| GET | `/api/materie-prime/` | Lista |
| POST | `/api/materie-prime/` | Aggiunge |
| PUT | `/api/materie-prime/{id}/allergeni` | Aggiorna allergeni |
| POST | `/api/materie-prime/auto-rileva-allergeni` | Auto-rileva allergeni |
| DELETE | `/api/materie-prime/{id}` | Elimina |

---

### 2.23 `/api/report-haccp` — `routers/report_haccp.py`
Generazione report HACCP mensile HTML.

| Metodo | Endpoint | Descrizione | Stato |
|--------|----------|-------------|-------|
| GET | `/api/report-haccp/mensile?mese=&anno=` | Report HTML mensile | ✅ (riparato) |
| GET | `/api/report-haccp/ingredienti-non-mappati` | Ingredienti senza costo | ❌ 500 |

---

### 2.24 `/api/normalizzazione` — `routers/normalizzazione.py`
Normalizzazione nomi prodotti e correzione pesi.

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/api/normalizzazione/processa-nuovi-prodotti` | Processa nuovi |
| GET | `/api/normalizzazione/mapping` | Mappa nomi |
| GET | `/api/normalizzazione/prodotti-senza-peso` | Senza peso |
| POST | `/api/normalizzazione/correggi-peso/{nome}` | Correggi peso |
| POST | `/api/normalizzazione/aggiungi-fornitore-speciale` | Fornitore speciale |
| GET | `/api/normalizzazione/fornitori-config` | Config fornitori |
| DELETE | `/api/normalizzazione/fornitori-config/{fornitore}` | Rimuovi config |

---

### 2.25 Endpoint diretti su `api_router` — `server.py`
Route non in router dedicato (da refactoring).

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/api/rileva-allergeni` | Rileva allergeni da testo |
| GET | `/api/` | Health check |
| POST | `/api/haccp/auto-update` | Auto update HACCP |
| POST | `/api/haccp/popola-sanificazione` | Popola sanificazione |
| POST | `/api/haccp/popola-temperature` | Popola temperature storiche |
| POST | `/api/haccp/popola-anni-storici` | Popola anni storici |

---

### 2.26 Utility — `routers/utils.py` (prefix: nessuno, montato su `/api`)

| Metodo | Endpoint | Descrizione | Stato |
|--------|----------|-------------|-------|
| POST | `/api/aggiorna-materie-da-fatture` | Aggiorna materie prime | ✅ |
| GET | `/api/registro-lotti-asl` | Registro ASL HTML | ✅ |
| POST | `/api/pulizia-dati-spazzatura` | Pulizia dati | ✅ |

---

### 2.27 Pipeline — `routers/pipeline.py`
Pipeline completa di import e sincronizzazione.

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/api/pipeline/esegui` | Esegui pipeline |
| GET | `/api/pipeline/status` | Stato esecuzione |
| GET | `/api/pipeline/storia` | Storico esecuzioni |

---

## 3. FRONTEND — PAGINE JSX E CONNESSIONI

### Navigazione (hash-based routing in `App.js`)

```
# (vuoto)                 → DashboardView
#ricette                  → RicetteCostiTabs (Ricettario + FoodCost + Prezzi)
#lotti                    → LottiList
#fornitori                → FornitoriList
#fatture                  → ImportaFattureView
#materie-prime            → MateriePrimeList
#prodotti-vendita         → ProdottiVenditaView
#temperatura-positiva     → TemperaturePositiveView
#temperatura-negativa     → TemperatureNegativeView
#sanificazione            → SanificazioneView
#disinfestazione          → DisinfestazioneView
#anomalie                 → AnomalieView
#sconti-merce             → ScontiMerceView
#pec-import               → PECImportView
#scheduler                → SchedulerView
#manuale-haccp            → ManualeHACCPView
#saima                    → SaimaRicettariView + CatalogoFornitoreView
#acquaviva                → (parte di TabletView/CatalogoFornitoreView)
#vendita-banco            → VenditaBancoView
#tablet/rosticceria       → TabletView (reparto=rosticceria)
#tablet/pasticceria       → TabletView (reparto=pasticceria)
#tablet/vendita           → VenditaBancoView
#storico-produzioni       → StoricoProduzioniView
#scheda-prodotto/{id}     → SchedaProdottoView
```

---

### 3.1 `DashboardView.jsx`
**Cosa fa:** Riepilogo operativo giornaliero. Mostra vendite odierne, lotti attivi, produzioni recenti.
**API chiamate:**
- `GET /api/lotti?limit=300` — lista lotti attivi
- `GET /api/produzioni/?limit=200` — produzioni recenti
- `GET /api/vendita-banco/oggi` — vendite oggi
- `PATCH /api/lotti/{id}/consuma` — tasto "Consuma"
**Bug noti:** Nessuno critico.

---

### 3.2 `RicetteView.jsx`
**Cosa fa:** Gestione completa ricette. Lista, crea, modifica, elimina, gestisce ingredienti con costi, mappa ingredienti al dizionario prodotti, mostra lotti fornitori per ingrediente, calcola food cost.
**Sub-tabs:** Ricettario | Food Cost | Prezzi
**API chiamate:** (17 endpoint differenti, vedi sezione 2.3 e 2.2)
**Bottoni principali:**
- "Nuova Ricetta" → POST `/api/ricette`
- "Calcola Costo" → GET `/api/food-cost/calcola/{id}`
- "Salva Pezzi Base" → POST `/api/food-cost/salva-porzioni-ricetta`
- "Usa Ricetta" → POST `/api/food-cost/usa-ricetta`
- "Auto-Mappa" → POST `/api/food-cost/auto-mappa-ingredienti`
- "Sincronizza Fatture" → POST `/api/food-cost/sincronizza-fatture`
**Bug noti:** Nessuno critico (fix applicato in sessione precedente).

---

### 3.3 `FoodCostView.jsx`
**Cosa fa:** Vista food cost con riepilogo costi di tutte le ricette, dizionario prodotti, search.
**API chiamate:**
- `GET /api/food-cost/ricette-riepilogo`
- `GET /api/food-cost/dizionario`
- `GET /api/food-cost/dizionario/search`
- `POST /api/food-cost/sincronizza-fatture`
- `POST /api/food-cost/usa-ricetta`
**Bug noti:** Nessuno critico.

---

### 3.4 `PrezziProdottiView.jsx`
**Cosa fa:** Imposta prezzi di vendita per ogni ricetta. Mostra margine %.
**API chiamate:**
- `GET /api/ricette-prezzi`
- `PUT /api/ricette/{id}/prezzo-vendita`
**Bug noti:** Nessuno.

---

### 3.5 `LottiList.jsx`
**Cosa fa:** Lista lotti produzione + sistema Recall + Registro ASL.
**Sub-funzioni:** Ricerca recall per ingrediente, download registro lotti, report mensile.
**API chiamate:**
- `GET /api/lotti?limit=300`
- `GET /api/lotti/recall/cerca?ingrediente=X` ← **richiede param `ingrediente` obbligatorio**
- `GET /api/registro-lotti-asl?data_inizio=&data_fine=`
- `GET /api/report-haccp/mensile?anno=&mese=` (apre in nuova tab — ❌ bloccato da browser)
**Bug noti:**
- Il link "Report mensile" apre `window.open(url)` → bloccato dal browser. Usare fetch+srcdoc come nel `HACCPPdfButton`.
- La recall cerca con param `q` ma il backend si aspetta `ingrediente`.

---

### 3.6 `FornitoriList.jsx`
**Cosa fa:** Lista fornitori, approva/escludi, mostra anagrafica.
**API chiamate:**
- `GET /api/fornitori`
- `GET /api/fornitori/{nome}/anagrafica`
- `POST /api/fornitori/approva`
**Bug noti:** Nessuno critico.

---

### 3.7 `ImportaFattureView.jsx`
**Cosa fa:** Upload file XML fatture, lista fatture importate, visualizzazione HTML, eliminazione, pulizia dati.
**API chiamate:**
- `GET /api/fatture` — lista
- `POST /api/importa-xml` ← ❌ **WRONG PATH** (dovrebbe essere `/api/fatture/importa-xml`)
- `GET /api/fattura/{id}/visualizza` ← ❌ **WRONG PATH** (dovrebbe essere `/api/fatture/{id}/visualizza`)
- `DELETE /api/fatture/{id}`
- `POST /api/aggiorna-materie-da-fatture` ✅
- `POST /api/pulizia-dati-spazzatura` ✅
**Bug noti:** ⚠️ 2 path errati — import XML e visualizzazione fattura non funzionano.

---

### 3.8 `MateriePrimeList.jsx`
**Cosa fa:** Lista materie prime con allergeni.
**API chiamate:**
- `GET /api/materie-prime/da-fatture` ← ⚠️ **endpoint non verificato**
**Bug noti:** Endpoint `/api/materie-prime/da-fatture` non trovato nel router (il router ha solo `/api/materie-prime/storico` e `/api/materie-prime/`).

---

### 3.9 `ProdottiVenditaView.jsx`
**Cosa fa:** Catalogo prodotti in vendita. Sync da ricette, gestione prezzi, normalizzazione pesi.
**API chiamate:**
- `GET /api/prodotti-vendita/?solo_attivi=false`
- `POST /api/prodotti-vendita/sync` ← ❌ **WRONG PATH** (dovrebbe essere `/sync-da-ricette`)
- `POST /api/prodotti-vendita/sync-da-ricette` ✅
- `PUT /api/prodotti-vendita/{id}/prezzo`
- `DELETE /api/prodotti-vendita/{id}/cascade`
- `GET /api/normalizzazione/prodotti-senza-peso`
- `POST /api/normalizzazione/correggi-peso/{nome}`
**Bug noti:** Chiamata duplicata con path errato (`/sync` non esiste).

---

### 3.10 `TemperaturePositiveView.jsx`
**Cosa fa:** Registro temperature frigoriferi. Griglia mensile per ogni frigo. Aggiunge/modifica frigoriferi.
**API chiamate:**
- `GET /api/attrezzature/` — lista dinamica frigo ✅
- `GET /api/attrezzature/frigo`
- `POST /api/attrezzature/frigo/{n}/rinomina`
- `GET /api/temperature-positive/scheda/{anno}/{i}`
- `GET /api/chiusure/anno/{anno}`
**Bug noti:** Nessuno — usa già `/api/attrezzature/` correttamente.

---

### 3.11 `TemperatureNegativeView.jsx`
**Cosa fa:** Identico a TemperaturePositiveView ma per congelatori.
**API chiamate:** Identiche con `/api/temperature-negative/` e `/api/attrezzature/congelatori`
**Bug noti:** Nessuno.

---

### 3.12 `SanificazioneView.jsx`
**Cosa fa:** Registro sanificazioni mensili per attrezzatura. Griglia giorno×apparecchio.
**API chiamate:**
- `GET /api/sanificazione/scheda/{anno}/{mese}`
- `GET /api/sanificazione/attrezzature`
- `GET /api/sanificazione/apparecchi/{anno}`
- `POST /api/sanificazione/apparecchi/{anno}/registra`
- `GET /api/sanificazione/export-pdf/{anno}/{mese}`
- `POST /api/haccp/popola-sanificazione` (via server.py direttamente)
**Bug noti:** Nessuno critico.

---

### 3.13 `DisinfestazioneView.jsx`
**Cosa fa:** Registro interventi disinfestazione annuale.
**API chiamate:**
- `GET /api/disinfestazione/scheda-annuale/{anno}`
- `POST /api/disinfestazione/registra-intervento/{anno}/{mese}`
- `POST /api/disinfestazione/registra-monitoraggio/{anno}/{mese}`
- `GET /api/disinfestazione/export-pdf/{anno}`
**Bug noti:** Nessuno.

---

### 3.14 `AnomalieView.jsx`
**Cosa fa:** Registro anomalie e non conformità HACCP. CRUD completo con report PDF.
**API chiamate:**
- `GET /api/anomalie/lista`
- `POST /api/anomalie/registra`
- `PUT /api/anomalie/{id}`
- `DELETE /api/anomalie/{id}`
- `GET /api/anomalie/report-pdf/{anno}`
**Bug noti:** Nessuno.

---

### 3.15 `ScontiMerceView.jsx`
**Cosa fa:** Gestione sconti merce ricevuti. Import da fatture, riepilogo mensile per fornitore.
**API chiamate:**
- `GET /api/sconti-merce/`
- `POST /api/sconti-merce/`
- `GET /api/sconti-merce/riepilogo/mensile`
- `GET /api/sconti-merce/riepilogo/fornitori`
- `POST /api/sconti-merce/importa-da-fatture`
- `GET /api/fornitori`
**Bug noti:** Nessuno.

---

### 3.16 `PECImportView.jsx`
**Cosa fa:** Connessione PEC Aruba, import fatture XML da email, stato connessione.
**API chiamate:**
- `GET /api/pec/status` ✅
- `POST /api/pec/import` ✅
- `GET /api/pec/preview?max_messages=N` ← ❌ **endpoint non esiste**
- `POST /api/pipeline/esegui`
- `GET /api/pipeline/status`
- `POST /api/fornitori/escludi`
- `GET /api/fornitori?stato=escluso`
- `GET /api/fatture?escludi_fornitori=false`
**Bug noti:** `/api/pec/preview` non esiste nel router.

---

### 3.17 `SchedulerView.jsx`
**Cosa fa:** Controllo scheduler (job notturni). Avvia/ferma, esegui ora, visualizza log.
**API chiamate:**
- `GET /api/scheduler/status` ✅
- `POST /api/scheduler/run-haccp-now` ✅
- `POST /api/scheduler/run-pec-now` ✅
- `GET /api/scheduler/logs?limit=20` ✅
**Bug noti:** Nessuno.

---

### 3.18 `ManualeHACCPView.jsx`
**Cosa fa:** Genera e visualizza manuale HACCP aziendale in HTML.
**API chiamate:**
- `GET /api/manuale-haccp/genera-manuale?anno={anno}` ✅
**Bug noti:** Nessuno.

---

### 3.19 `SaimaRicettariView.jsx`
**Cosa fa:** Visualizzazione ricettari PDF di SAIMA S.p.A. inline (con proxy blob per evitare CORS).
**API chiamate:**
- `GET /api/saima/ricettari`
- `POST /api/saima/ricettari/aggiorna`
- `POST /api/saima/ricettari/aggiungi`
- `DELETE /api/saima/ricettari/{id}`
- `GET /api/saima/ricettari/pdf-proxy?url=...` (blob URL per iframe)
**Bug noti:** Nessuno (fix blob URL applicato in sessione precedente).

---

### 3.20 `CatalogoFornitoreView.jsx`
**Cosa fa:** Catalogo prodotti SAIMA e MEPA. Scraping, ricerca, confronto prezzi.
**API chiamate:**
- `GET /api/saima/prodotti`
- `GET /api/saima/categorie`
- `POST /api/saima/scraping/avvia`
- `GET /api/saima/scraping/stato`
- `GET /api/mepa/prodotti`
- `GET /api/mepa/categorie`
- `POST /api/mepa/scraping/avvia`
- `GET /api/food-cost/dizionario`
**Bug noti:** Nessuno critico.

---

### 3.21 `TabletView.jsx`
**Cosa fa:** Interfaccia tablet per operatori (rosticceria/pasticceria). Schede prodotto, registrazione lotti, vendita banco, foto prodotti.
**API chiamate:**
- `GET /api/tablet/{reparto}` — ricette del reparto
- `GET /api/ricette?limit=200`
- `GET /api/lotti?limit=8`
- `POST /api/registra-produzione-lotto`
- `GET /api/anteprima-codice-lotto/{prodotto}`
- `POST /api/acquaviva/registra-vendita`
- `GET /api/acquaviva/prodotti`
- `GET /api/acquaviva/prodotti/senza-glutine`
- `GET /api/acquaviva/categorie`
- `PUT /api/ricette/{id}/reparto`
- `POST /api/ricette/{id}/upload-foto`
- `POST /api/vendita-banco/registra`
**Bug noti:**
- ❌ **Frigo hardcoded** (righe 152-153, 367-373): usa `["Frigo 1","Frigo 2","Frigo 3"]` invece di `GET /api/attrezzature/`

---

### 3.22 `RicettarioView.jsx`
**Cosa fa:** Calcolatore di produzione. Seleziona ricetta, calcola ingredienti per N pezzi, registra produzione, storico.
**API chiamate:**
- `GET /api/ricette-libro`
- `GET /api/food-cost/calcola/{id}`
- `POST /api/produzioni/`
- `GET /api/produzioni/?ricetta_id=&limit=20`
- `DELETE /api/produzioni/{id}`
- `GET /api/produzioni/riepilogo`
- `POST /api/registra-produzione-lotto`
**Bug noti:**
- ❌ **Frigo hardcoded** (righe 604-605): datalist con `["Frigo 1","Frigo 2","Frigo 3"]` invece di `GET /api/attrezzature/`

---

### 3.23 `StoricoProduzioniView.jsx`
**Cosa fa:** Storico globale di tutte le produzioni con filtri e cancellazione.
**API chiamate:**
- `GET /api/produzioni/`
- `DELETE /api/produzioni/{id}`
- `GET /api/produzioni/trend`
**Bug noti:** Nessuno.

---

### 3.24 `SchedaProdottoView.jsx`
**Cosa fa:** Scheda dettagliata singolo prodotto. Ingredienti, costo, recall, produzioni.
**API chiamate:**
- `GET /api/ricette/{id}`
- `GET /api/food-cost/calcola/{id}`
- `POST /api/food-cost/aggiorna-ingredienti-ricetta`
- `GET /api/food-cost/dizionario/search`
- `GET /api/lotti`
- `GET /api/lotti/recall/cerca?ingrediente=X`
- `GET /api/produzioni/?ricetta_id=&limit=10`
- `POST /api/registra-produzione-lotto`
- `GET /api/attrezzature/` ✅
- `GET /api/ricette-prezzi`
- `PUT /api/ricette/{id}/prezzo-vendita`
**Bug noti:** Nessuno critico.

---

### 3.25 `VenditaBancoView.jsx`
**Cosa fa:** Registro vendite al banco. Chiusura giornaliera, invenduti, statistiche.
**API chiamate:**
- `GET /api/vendita-banco/oggi`
- `GET /api/vendita-banco/statistiche`
- `PUT /api/vendita-banco/{id}/invenduto`
- `PUT /api/vendita-banco/{id}/riapri`
- `DELETE /api/vendita-banco/{id}`
- `GET /api/ricette`
**Bug noti:** Nessuno.

---

### 3.26 `BulkPrezziView.jsx`
**Cosa fa:** Impostazione massiva prezzi su più prodotti contemporaneamente.
**API chiamate:**
- `GET /api/prodotti-vendita/?solo_attivi=false`
- `PUT /api/prodotti-vendita/{id}`
**Bug noti:** Nessuno.

---

## 4. BUG NOTI E POSIZIONE ESATTA

### BUG-01 — Frigoriferi hardcoded in TabletView ❌ P0
**File:** `/app/frontend/src/components/haccp/TabletView.jsx`
**Righe esatte:**
```
152: ["Congelatore 1","Congelatore 2","Congelatore 3","Abbattitore 1","Abbattitore 2","Surgelatore"]
153: ["Frigo 1","Frigo 2","Frigo 3","Cella Frigo A","Cella Frigo B"]
367: {["Frigo 1","Frigo 2","Frigo 3","Cella Frigo A","Cella Frigo B"].map(v => ...)}
372: {["Congelatore 1","Congelatore 2","..."].map(v => ...)}
```
**Fix:** Aggiungere `useEffect` che chiama `GET /api/attrezzature/` e popola due array di stato `frigoOptions` e `congelatoreOptions`.

---

### BUG-02 — Frigoriferi hardcoded in RicettarioView ❌ P0
**File:** `/app/frontend/src/components/haccp/RicettarioView.jsx`
**Righe esatte:**
```
604: <option value="Frigo 1" /><option value="Frigo 2" /><option value="Frigo 3" />
605: <option value="Cella Frigo A" /><option value="Cella Frigo B" />
```
**Fix:** Chiamata `GET /api/attrezzature/` al mount, popola datalist dinamicamente.

---

### BUG-03 — Path errato importa-xml in ImportaFattureView ⚠️ P1
**File:** `/app/frontend/src/components/haccp/ImportaFattureView.jsx`
**Riga 50:** `axios.post(\`${API}/importa-xml\`)`
**Fix:** Cambiare in `${API}/fatture/importa-xml`

---

### BUG-04 — Path errato visualizza fattura in ImportaFattureView ⚠️ P1
**File:** `/app/frontend/src/components/haccp/ImportaFattureView.jsx`
**Riga 206:** `window.open(\`${API}/fattura/${id}/visualizza\`)`
**Fix:** Cambiare in `${API}/fatture/${id}/visualizza`

---

### BUG-05 — Path errato /sync in ProdottiVenditaView ⚠️ P1
**File:** `/app/frontend/src/components/haccp/ProdottiVenditaView.jsx`
**Chiamata:** `POST /api/prodotti-vendita/sync`
**Fix:** Cambiare in `/api/prodotti-vendita/sync-da-ricette`

---

### BUG-06 — Endpoint /pec/preview inesistente ⚠️ P1
**File:** `/app/frontend/src/components/haccp/PECImportView.jsx`
**Chiamata:** `GET /api/pec/preview?max_messages=N`
**Fix:** Creare endpoint `GET /api/pec/preview` nel router `pec_import.py` oppure rimuovere la chiamata dal frontend.

---

### BUG-07 — Recall: param errato (q vs ingrediente) ⚠️ P1
**File:** `/app/frontend/src/components/haccp/LottiList.jsx` riga 196
**Chiamata frontend:** `GET /api/lotti/recall/cerca?q=X`
**Backend si aspetta:** `?ingrediente=X`
**Fix:** Cambiare param da `q` a `ingrediente` nel frontend.

---

### BUG-08 — Report mensile in LottiList apre window.open ⚠️ P2
**File:** `/app/frontend/src/components/haccp/LottiList.jsx` riga 321
**Problema:** `window.open(url)` viene bloccato dal browser.
**Fix:** Usare lo stesso pattern fetch+srcdoc del `HACCPPdfButton` in App.js.

---

### BUG-09 — /report-haccp/ingredienti-non-mappati 500 ❌ P2
**File:** `/app/backend/routers/report_haccp.py`
**Problema:** Endpoint risponde 500 (errore interno server).
**Fix:** Verificare la query MongoDB e il formato della risposta.

---

### BUG-10 — /api/materie-prime/da-fatture inesistente ⚠️ P2
**File:** `/app/frontend/src/components/haccp/MateriePrimeList.jsx`
**Chiamata:** `GET /api/materie-prime/da-fatture`
**Backend ha:** `/api/materie-prime/storico` o `/api/materie-prime/`
**Fix:** Allineare il path frontend all'endpoint esistente.

---

## 5. ENDPOINT ROTTI / DISALLINEATI

| # | Frontend chiama | Backend esiste? | Correzione |
|---|----------------|-----------------|-----------|
| 1 | `POST /api/importa-xml` | ❌ | `/api/fatture/importa-xml` |
| 2 | `GET /api/fattura/{id}/visualizza` | ❌ | `/api/fatture/{id}/visualizza` |
| 3 | `POST /api/prodotti-vendita/sync` | ❌ | `/api/prodotti-vendita/sync-da-ricette` |
| 4 | `GET /api/pec/preview` | ❌ | Da creare o rimuovere |
| 5 | `GET /api/lotti/recall/cerca?q=X` | ⚠️ param sbagliato | `?ingrediente=X` |
| 6 | `GET /api/materie-prime/da-fatture` | ❌ | `/api/materie-prime/storico` |
| 7 | `GET /api/report-haccp/ingredienti-non-mappati` | ❌ 500 | Fix backend |
| 8 | `window.open(report-haccp/mensile)` | ⚠️ bloccato browser | fetch+srcdoc |

---

## 6. MAPPA VISUALE CONNESSIONI

```
NAVIGAZIONE (hash routing)
│
├── # Dashboard ────────────────── DashboardView
│   └── /api/lotti, /api/produzioni/, /api/vendita-banco/oggi
│
├── #ricette ─────────────────────RicetteCostiTabs
│   ├── sub-tab Ricettario ───────RicetteView
│   │   └── /api/ricette, /api/food-cost/*, /api/lotti-fornitori
│   ├── sub-tab Food Cost ────────FoodCostView
│   │   └── /api/food-cost/ricette-riepilogo, /api/food-cost/dizionario
│   └── sub-tab Prezzi ───────────PrezziProdottiView
│       └── /api/ricette-prezzi, /api/ricette/{id}/prezzo-vendita
│
├── #lotti ────────────────────── LottiList
│   └── /api/lotti, /api/lotti/recall/cerca ⚠️(param q→ingrediente)
│
├── #fornitori ────────────────── FornitoriList
│   └── /api/fornitori/*
│
├── #fatture ─────────────────── ImportaFattureView
│   ├── /api/fatture ✅
│   ├── /api/importa-xml ❌ (deve essere /api/fatture/importa-xml)
│   └── /api/fattura/{id}/visualizza ❌ (deve essere /api/fatture/{id}/visualizza)
│
├── #prodotti-vendita ─────────── ProdottiVenditaView
│   ├── /api/prodotti-vendita/ ✅
│   └── /api/prodotti-vendita/sync ❌ (deve essere /sync-da-ricette)
│
├── #temperatura-positiva ─────── TemperaturePositiveView
│   ├── /api/attrezzature/ ✅ (DINAMICO - OK)
│   └── /api/temperature-positive/scheda/{anno}/{n}
│
├── #temperatura-negativa ─────── TemperatureNegativeView
│   ├── /api/attrezzature/ ✅ (DINAMICO - OK)
│   └── /api/temperature-negative/scheda/{anno}/{n}
│
├── #sanificazione ────────────── SanificazioneView
│   └── /api/sanificazione/*
│
├── #disinfestazione ──────────── DisinfestazioneView
│   └── /api/disinfestazione/*
│
├── #anomalie ─────────────────── AnomalieView
│   └── /api/anomalie/*
│
├── #pec-import ───────────────── PECImportView
│   ├── /api/pec/status ✅
│   ├── /api/pec/import ✅
│   └── /api/pec/preview ❌ (non esiste)
│
├── #scheduler ────────────────── SchedulerView
│   └── /api/scheduler/* ✅ tutto ok
│
├── #tablet/rosticceria ─────────TabletView (reparto=rosticceria)
│   ├── FRIGO HARDCODED ❌ (righe 152-153, 367-372)
│   └── deve usare /api/attrezzature/
│
├── #tablet/pasticceria ─────────TabletView (reparto=pasticceria)
│   └── STESSO BUG FRIGO ❌
│
└── #storico-produzioni ─────────StoricoProduzioniView
    └── /api/produzioni/ ✅
```

---

## PRIORITÀ INTERVENTI

| Priorità | Bug | File | Effort |
|----------|-----|------|--------|
| 🔴 P0 | Frigo hardcoded TabletView | `TabletView.jsx:152-153,367-372` | Basso |
| 🔴 P0 | Frigo hardcoded RicettarioView | `RicettarioView.jsx:604-605` | Basso |
| 🟡 P1 | importa-xml path errato | `ImportaFattureView.jsx:50` | Minimo |
| 🟡 P1 | visualizza fattura path errato | `ImportaFattureView.jsx:206` | Minimo |
| 🟡 P1 | /sync path errato | `ProdottiVenditaView.jsx` | Minimo |
| 🟡 P1 | recall param q→ingrediente | `LottiList.jsx:196` | Minimo |
| 🟡 P1 | /pec/preview inesistente | `PECImportView.jsx` | Medio |
| 🔵 P2 | report mensile window.open | `LottiList.jsx:321` | Medio |
| 🔵 P2 | ingredienti-non-mappati 500 | `report_haccp.py` | Medio |
| 🔵 P2 | materie-prime/da-fatture | `MateriePrimeList.jsx` | Minimo |

---

*Generato automaticamente — /app/memory/MAPPA_STRUTTURALE.md*
