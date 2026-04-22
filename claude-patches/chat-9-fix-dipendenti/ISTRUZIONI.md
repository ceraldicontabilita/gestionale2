# PATCH — Fix Gestione Dipendenti (fascicolo completo)
## Data: 22 Aprile 2026

## Problemi risolti

1. **Stipendi non trovati in banca**: il match cercava solo per nome nella descrizione
   del bonifico ("VOSTRA DISPOSIZIONE FAVORE COGNOME"). Ora cerca con 3 strategie:
   - IBAN del dipendente (ultime 8 cifre nella descrizione)
   - Nome/cognome nella descrizione (come prima, ma anche invertito)
   - Importo netto del cedolino ±1€ (match per importo)

2. **Anagrafica non popolata**: i campi CF, stipendio netto/lordo non venivano
   presi dai cedolini. Ora l'endpoint fascicolo arricchisce automaticamente
   l'anagrafica se manca il CF o lo stipendio.

3. **Presenze non collegate**: cercava solo per dipendente_id, ora cerca anche
   per codice_fiscale e per cognome (regex). Prova sia presenze_mensili che
   attendance_presenze_calendario.

4. **Saldi mancanti**: non esisteva un calcolo unificato per dipendente.
   Ora l'endpoint /fascicolo restituisce: netto anno, lordo anno, stipendi
   pagati da banca, differenza netto vs banca, cedolini da pagare, TFR anno,
   costo azienda stimato.

5. **Stato pagamento cedolino incompleto**: cercava solo in prima_nota_salari.
   Ora fa fallback sull'estratto conto cercando per importo netto ±1.5€ nello
   stesso mese.

## File nuovo

```
app/routers/employees/fascicolo_dipendente.py
```

## Registrare il router

In `main.py` o `router_registry.py`:

```python
from app.routers.employees.fascicolo_dipendente import router as fascicolo_router
app.include_router(fascicolo_router, prefix="/api")
```

## Endpoint

- `GET /api/dipendenti/{id}/fascicolo?anno=2026` — fascicolo completo
- `POST /api/dipendenti/{id}/arricchisci-da-cedolini` — arricchisce anagrafica

## Come usarlo nel frontend

Nella scheda dipendente (HRDipendenti.jsx), sostituire le chiamate multiple con:

```javascript
const { data } = await api.get(`/api/dipendenti/${dip.id}/fascicolo?anno=${anno}`);

// data.anagrafica — dati anagrafici (arricchiti)
// data.cedolini.lista — cedolini con stato pagato/data_pagamento
// data.cedolini.totale_netto — netto totale anno
// data.stipendi_banca.movimenti — bonifici trovati in banca
// data.presenze.mesi — presenze mensili
// data.tfr — accantonamenti TFR
// data.saldi — tutti i saldi calcolati
// data.completezza — campi mancanti
```
