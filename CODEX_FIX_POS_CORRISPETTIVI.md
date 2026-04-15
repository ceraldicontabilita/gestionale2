# FIX POS CORRISPETTIVI - ISTRUZIONI PER CODEX

## ERRORE ATTUALE
Il sistema confronta:
- XML (pagato_elettronico)
- Accrediti POS bancari

Questo genera falsi errori.

## LOGICA CORRETTA
Il confronto deve essere:
- POS MANUALE (chiusure giornaliere)
- Accrediti POS bancari

---

## MODIFICHE DA FARE

### 1. Sostituire variabile principale

DA:
```
elettronico_xml = corr["elettronico"]
```

A:
```
pos_manuale = chiusure_by_date.get(data, 0)
```

---

### 2. Calcolo differenza

DA:
```
differenza = abs(elettronico_xml - pos_accreditato)
tolleranza = max(elettronico_xml * 0.02, 5)
```

A:
```
differenza = abs(pos_manuale - pos_accreditato)
tolleranza = max(pos_manuale * 0.02, 5)
```

---

### 3. Condizioni stato

Sostituire tutte le condizioni:

DA:
```
if elettronico_xml > 0 and pos_accreditato == 0:
```

A:
```
if pos_manuale > 0 and pos_accreditato == 0:
```

---

### 4. Nuovo stato: IN_TRANSITO

Aggiungere:

```
from datetime import datetime, timedelta

oggi = datetime.now()
data_dt = datetime.strptime(data, "%Y-%m-%d")

if data_dt >= oggi - timedelta(days=2):
    stato = "in_transito"
```

---

### 5. Aggiornare regex POS

DA:
```
POS|NEXI|SUMUP|...
```

Aggiungere:
```
AMEX|AMERICAN EXPRESS
```

---

## NOTE IMPORTANTI

- NON modificare struttura API
- NON rimuovere XML (serve per controlli fiscali)
- POS manuale diventa fonte primaria per riconciliazione
- XML resta solo controllo secondario

---

## RISULTATO ATTESO

- Eliminazione falsi errori
- Coerenza reale con banca
- Sistema conforme operatività reale bar

---

## COMANDO PER CODEX

Refactor verifica_coerenza_pos_corrispettivi:
- Use pos_manuale instead of elettronico_xml
- Compare pos_manuale with pos_accreditato
- Update tolerance logic
- Add AMEX to regex
- Add stato "in_transito"
- Do not change API structure

