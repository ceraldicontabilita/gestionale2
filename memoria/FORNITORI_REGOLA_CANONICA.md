# Fornitori — regola canonica definitiva

Aggiornato: Aprile 2026

## Decisione definitiva

La collection MongoDB canonica per l'anagrafica fornitori e' sempre:

```text
fornitori
```

Non esiste piu' una seconda verita' funzionale su `suppliers`.

## Cosa significa nel codice

- `fornitori` = collection reale e primaria dei fornitori.
- `suppliers` = nome tecnico inglese accettabile solo per moduli, servizi, classi, route API e compatibilita' storica.
- Ogni costante `SUPPLIERS` deve puntare alla collection `fornitori`.
- Ogni nuovo accesso Mongo deve usare una costante centralizzata, non una stringa hardcoded.

## Fonti di verita' nel codice

Le fonti corrette sono:

```python
# app/db_collections.py
COLL_SUPPLIERS = "fornitori"
COLL_FORNITORI = "fornitori"

# app/database/collections.py
Collections.FORNITORI = "fornitori"
Collections.SUPPLIERS = "fornitori"

# app/database.py legacy
Collections.SUPPLIERS = "fornitori"
```

## Regola per backend

Corretto:

```python
from app.db_collections import COLL_FORNITORI
await db[COLL_FORNITORI].find(...)
```

Accettabile per retrocompatibilita', solo se la costante punta a `fornitori`:

```python
await db[Collections.SUPPLIERS].find(...)
```

Vietato nei nuovi sviluppi:

```python
await db["suppliers"].find(...)
await db["fornitori"].find(...)  # vietato come hardcoded: usare costante
```

## Regola per frontend

Le API restano sotto `/api/suppliers` per compatibilita' con il frontend e con i router esistenti.
Questo NON significa che la collection Mongo si chiami `suppliers`.

Corretto:

```javascript
api.get('/api/suppliers')
api.post('/api/suppliers', data)
```

La UI deve mostrare sempre testo italiano: Fornitori, Nuovo Fornitore, Metodo pagamento, Estratto fatture.

## Regola per documentazione

Ogni MD/memoria deve descrivere i fornitori cosi':

```text
fornitori = anagrafica fornitori, collection canonica
suppliers = alias tecnico/API, non collection primaria
```

Qualsiasi frase del tipo "usare suppliers, non fornitori" e' obsoleta e deve essere corretta.

## Motivo della decisione

Il progetto ha avuto una fase con doppia denominazione `fornitori`/`suppliers`.
La situazione corretta e' stata normalizzata puntando gli alias inglesi alla collection italiana `fornitori`, per evitare:

- anagrafiche duplicate;
- dashboard con conteggi diversi;
- fatture collegate a un fornitore non visibile in UI;
- riconciliazioni con controparte mancante;
- filtri magazzino/fornitore incoerenti;
- bug silenziosi causati da lettura e scrittura su collection diverse.

## Checklist audit fornitori

Prima di modificare una pagina o un router fornitori:

1. Cercare `"suppliers"` nel file.
2. Se e' una route `/api/suppliers`, lasciarla.
3. Se e' una collection Mongo, sostituirla con costante che punta a `fornitori`.
4. Verificare che i campi frontend combacino con la response backend.
5. Non creare nuove collection per fornitori.
6. Non usare `fornitori_dizionario` come anagrafica: e' dizionario/learning, non fonte primaria.
7. Dopo update/merge fornitore, invalidare cache e propagare evento se previsto.

## Stato correzione

- Corretto `app/services/suppliers/constants.py`: `SUPPLIERS` ora punta a `fornitori` tramite `COLL_FORNITORI`.
- Confermato che `app/db_collections.py`, `app/database/collections.py` e `app/database.py` puntano gia' a `fornitori`.
