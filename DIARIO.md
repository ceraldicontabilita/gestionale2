# DIARIO.md — Ceraldi ERP gestionale2

## Chat 4 — Fix bug, 2 tab mancanti, push backend

### Fix applicati
- App.jsx: route mancanti tributi, alert-fiscali, fornitori, f24-privati
- TopNav.jsx: import duplicati, Building2 mancante
- tributi.py: import PRIVATI_CF/CF_AZIENDA mancante
- main.py: prefix doppio su tributi e f24_privati

---

## Chat 5 — 3 pagine HACCP nel gestionale2

### Pagine create e pushate
Le 3 pagine leggono le API di `ceraldiapp.it` (repo tracciabilita).
Prima di costruire: letti tutti e 4 i router backend (temperature_positive, temperature_negative, sanificazione, disinfestazione).

**frontend/src/pages/TemperatureHACCP.jsx**
- Tab interno: Frigoriferi (+) e Congelatori (−)
- Chiama GET `/temperature-positive/scheda/{anno}/{n}` e `/temperature-negative/scheda/{anno}/{n}` per tutti i 12 apparecchi
- Griglia: giorni come righe, apparecchi come colonne
- Legge stati speciali: is_chiuso 🚫, is_manutenzione 🔧, is_non_usato ⏸
- Badge "fuori range" se temp > max o < min
- CSS inline con design system utils.js

**frontend/src/pages/SanificazioneHACCP.jsx**
- Tab "Attrezzature": griglia mensile toggle X, pulsanti "marca tutto giorno N" → POST `/giorno-completo`, salva bulk → PUT `/scheda/{anno}/{mese}`
- Tab "Apparecchi Refrigeranti": read-only, griglia frigo+congelatori con ✓/✗ per sanificazioni ogni 7-10 giorni

**frontend/src/pages/DisinfestazioneHACCP.jsx**
- Intervento mensile: card + pulsante "Registra/Modifica" → POST `/registra-intervento/{anno}/{mese}`
- Cards frigoriferi/congelatori cliccabili → modal → POST `/registra-monitoraggio/{anno}/{mese}`
- Riepilogo annuale: griglia 12 mesi, click mese per navigare
- Ditta: ANTHIRAT CONTROL S.R.L., giorno fisso 15

### Modifiche a file esistenti
- App.jsx: aggiunte 3 route `/haccp/temperature`, `/haccp/sanificazione`, `/haccp/disinfestazione`
- TopNav.jsx: aggiunti 3 link 🌡️ Temp, ✨ Sanif., 🐀 Disinfest. con icone Thermometer, Sparkles, Bug

### Commit pushati (Chat 5)
- 63030da — feat: aggiunte 3 route HACCP in App.jsx
- 9ee8358 — feat: aggiunti 3 link HACCP in TopNav
- 66ec17d — feat: TemperatureHACCP.jsx
- 1d12ece — feat: SanificazioneHACCP.jsx
- 7648ce3 — feat: DisinfestazioneHACCP.jsx

---

## Chat 5 — continua: DashboardHACCP

### Pagina aggiunta
**frontend/src/pages/DashboardHACCP.jsx**
Adattamento fedele di DashboardView.jsx del repo tracciabilita.

**API chiamate (tutte su ceraldiapp.it):**
- GET /produzioni/per-oggi → pezziProdPast, pezziProdCucina per reparto
- GET /vendita-banco/oggi → aperte/chiuse, venduti/invenduti per reparto
- GET /lotti?limit=300 → filtra scadenza ≤ 7 giorni, max 10 lotti
- GET /acquaviva/magazzino-congelatore → saldo congelatore semilavorati Vandemoortele
- GET /chiusure/giorno-non-produttivo/oggi → stato toggle produttivo/riposo
- POST /chiusure/giorno-non-produttivo/oggi → setta stato
- PATCH /lotti/{id}/consuma → marca lotto come consumato (con confirm window)

**Funzionalità:**
- Toggle "Giorno Produttivo / Giorno di Riposo"
- 3 link rapidi tablet (rosticceria, pasticceria, vendita) → ceraldiapp.it
- Alert lotti in scadenza prossimi 7 giorni con bottone consuma
- Griglia 3 colonne × 6 righe (prodotti, al banco, in frigo, venduti, incasso pot., costo invenduto)
- Popup magazzino semilavorati (entrate/uscite/saldo Vandemoortele)
- Dettaglio banco espandibile al click su riga venduti
- KPI archivio (link a ceraldiapp.it)
- Lista produzioni di oggi

**Modifiche file esistenti:**
- App.jsx: route /haccp/dashboard
- TopNav.jsx: link 📊 Dashboard + import LayoutDashboard

---

## Chat 6 — 2026-04-08

### Nuovi router backend

**app/routers/omaggi_acquaviva.py** — GET /api/omaggi-acquaviva
- Calcola omaggi Acquaviva (1 ogni N cartoni, default 10) con progressivo cumulativo tra ordini
- Usa fatture_passive: campo fornitore_denominazione, linee[].prezzo_unitario=0 = omaggi
- Estrae pezzi/cartone dalla descrizione (regex 35G 4.95KG o 6X80G)

**app/routers/ordini.py** — CRUD ordini fornitori
- GET /api/ordini/prezzi/{nome_prodotto} — comparazione prezzi da fatture_passive (fuzzy matching)
- POST/GET/PUT/DELETE /api/ordini — collection ordini_ceraldi
- GET /api/ordini/{id}/testo-invio?fornitore=X — genera testo email + WhatsApp

### Nuove pagine frontend

- OrdiniFornitore.jsx → /ordini — catalogo ceraldiapp.it + CRUD locale
- ScontiMerce.jsx → /sconti-merce — ceraldiapp.it + tab Omaggi locale
- TemperatureHACCP.jsx → /haccp/temperature
- SanificazioneHACCP.jsx → /haccp/sanificazione
- DisinfestazioneHACCP.jsx → /haccp/disinfestazione
- DashboardHACCP.jsx → /haccp/dashboard

### Audit completo — 7 bug fixati

1. [CRITICO] f24.py /alert-duplicati — NameError includi_scartati: aggiunto Query(False)
2. [CRITICO] ordini.py route conflict — verificato: /prezzi/{nome} gia prima di /{id} OK
3. [MEDIO]   fatture.py upsert fornitori — struttura flat → anagrafica nested (anagrafica.piva)
4. [MEDIO]   fornitori.py import-xml — numero_fattura→numero, piva_fornitore→fornitore_piva
5. [BASSO]   fornitori.py /pagamento — query fornitore_id (inesistente) → fornitore_piva
6. [BASSO]   alert_fiscali.py — db.get_collection() → db['avvisi_bonari']
7. [BASSO]   distinte.py — riconcilia su iban → iban_cedolino con fallback

### Campi reali confermati

fatture_passive: fornitore_denominazione, fornitore_piva, numero, data, anno,
  importo_totale, imponibile, iva, causale, linee[], riepilogo_iva, pagamenti,
  dedup_key, stato, source.
  linee[]: descrizione, quantita, unita_misura, prezzo_unitario, prezzo_totale, aliquota_iva

fornitori: azienda_id, anagrafica.{ragione_sociale,piva,codice_fiscale,pec,regime_fiscale,sede},
  schede_tecniche, prodotti[], storico_prezzi[], pagamento, stato

dipendenti: codice_fiscale, nome, cognome, stato, iban_cedolino (NON iban),
  paga_base, livello, ferie_saldo_gg, permessi_saldo_ore,
  progressivi.{anno}.{imp_inps,imp_irpef,irpef_pagata,imp_inail},
  tfr.{anno}.{fondo_31_12,quota_anno,rivalutazione}, pignoramenti[]

### TODO prossima chat
- Portare rinomina inline colonne frigo/congelatore (da TemperaturePositiveView originale)
- Testare omaggi Acquaviva con fatture reali
- Verificare riconciliazione cedolini con estratto conto

