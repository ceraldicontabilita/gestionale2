# 📓 Diario Ceraldi ERP

Registro cronologico di tutto quello che viene fatto sul gestionale, chat per chat.
Scritto in linguaggio semplice — non tecnico — per capire a colpo d'occhio lo stato del progetto.

---

## Chat 8 — 10 Aprile 2026

### Cosa abbiamo fatto

#### 1. Push del repo su Emergent
Emergent aveva dei fix locali non ancora caricati su GitHub. Abbiamo istruito Emergent a fare un push completo di tutti i file modificati su `main`, così il repo è tornato allineato con quello che gira in produzione.

#### 2. Mappatura completa del gestionale
Abbiamo letto tutto il codice del repo e prodotto un riassunto umano di ogni pagina — cosa fa, a cosa serve, dove si trova. Il gestionale è diviso in circa 20 sezioni principali:

- **Dashboard** — la schermata principale con i numeri dell'anno
- **Inserimento Rapido** — per registrare cose velocemente da mobile
- **Fatture** — archivio fatture ricevute + corrispettivi giornalieri
- **Fornitori** — anagrafica e ordini
- **Prima Nota** — registrazioni contabili manuali
- **Riconciliazione** — abbinare i movimenti bancari alle fatture (include PayPal)
- **Dipendenti** — anagrafica, contratti, PIN, IBAN
- **Presenze** — registro presenze + saldi ferie/permessi
- **Cedolini** — upload PDF Zucchetti, prima nota salari
- **TFR** — calcolo trattamento di fine rapporto
- **Contabilità** — hub con 10 sotto-sezioni (bilancio, cespiti, mutui, budget, ecc.)
- **Magazzino** — giacenze, inventario, ricerca prodotti, coerenza POS
- **Noleggio/Veicoli** — auto aziendali, verbali, targhe
- **Scadenze** — calendario scadenze fiscali
- **To-Do** — lista attività interne
- **Documenti** — import XML/PDF, da rivedere, classificazione email, correzione AI
- **Learning Machine** — sistema che impara a categorizzare le spese automaticamente
- **Strumenti** — verifica coerenza dati, pacchetti commercialista, download email, visure, pianificazione
- **Integrazioni** — PagoPA, Invoicetronic (SDI), API esterne
- **Agenti AI** — automazioni schedulate con alert in tempo reale
- **Admin** — pannello sistema, batch reprocessing, impostazioni

#### 3. Pulizia duplicati nel menù
Abbiamo trovato che alcune sezioni apparivano in più punti del menù come voci separate, ma in realtà erano già tab interni di hub esistenti. Esempio: "Verifica Coerenza" era una route standalone ma è anche tab in Strumenti. Stessa cosa per corrispettivi, ordini fornitori, bilancio, mutui, cespiti e tutta la sezione import documenti. Il riassunto è stato rifatto eliminando queste voci doppie.

#### 4. Tracciabilità — eliminato il mini-sito embedded
**Problema:** La pagina `/tracciabilita` nel gestionale era un iframe che caricava il sito HACCP dentro una cornice. Questo creava confusione, era lento e non aveva senso avere due interfacce sovrapposte.

**Soluzione:** La pagina è stata completamente riscritta. Adesso mostra:
- Un **bottone grande** "Apri ceraldiapp.it" che apre il sito HACCP in una nuova scheda
- Un **pannello di stato** che mostra in tempo reale se la sincronizzazione col database funziona, quante fatture sono state già trasferite, le produzioni del giorno e l'orario dell'ultimo controllo

**Come funziona la sincronizzazione (in parole semplici):** I due sistemi — il gestionale e ceraldiapp.it — usano lo stesso database MongoDB. Quando ceraldiapp importa una fattura fornitore dalla PEC, manda automaticamente una notifica al gestionale, che la registra nella sezione Fatture evitando duplicati. Questo "ponte" esisteva già nel codice, ma non era visibile da nessuna parte. Adesso appare nel pannello di stato della pagina Tracciabilità.

---

### File modificati in questa chat

| File | Cosa è cambiato |
|---|---|
| `frontend/src/pages/TracciabilitaPage.jsx` | Riscritto da zero — rimosso iframe, aggiunto bottone + pannello sync |
| `claude-patches/chat8-tracciabilita/` | Cartella patch con file + istruzioni per Emergent |
| `DIARIO.md` | Creato (questo file) |

### File che NON sono stati toccati

- Tutto il backend tracciabilità (`app/routers/tracciabilita/`) — rimane invariato perché serve a ceraldiapp.it
- Il ponte ERP (`app/routers/erp_bridge.py`) — già funzionante, non modificato
- Tutte le altre pagine del gestionale

---

### Prossimi passi suggeriti (da Chat 8)

1. **Pagina admin gestione PIN dipendenti** — interfaccia per cambiare i PIN senza andare sul DB
2. **Tablet Cucina** — schermata semplificata per rosticceria/pasticceria (`GET ceraldiapp.it/api/tablet/{reparto}`)
3. **Rinomina inline frigo** — in TemperatureHACCP.jsx, rinominare le colonne dei frigo direttamente dalla tabella
4. **Dominio custom** — configurare dopo la build su Emergent
5. **Verifica riconciliazione cedolini** — controllare che i cedolini caricati combacino con i movimenti in estratto conto

---

*Prossima chat: Chat 9*
