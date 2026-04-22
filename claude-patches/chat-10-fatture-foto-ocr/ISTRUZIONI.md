# Deploy backend gestionale2 — fatture_foto_ocr

## 1. Copia il file

```
app/routers/fatture_foto_ocr.py
```

nella tua codebase di gestionale2.

## 2. Registra il router

In `app/router_registry.py`, aggiungi l'import (in cima, insieme agli altri router):

```python
from app.routers import fatture_foto_ocr
```

Poi aggiungi la registrazione nella funzione che monta i router.
**Attenzione al prefix**: questo router espone path che iniziano con `/invoices/{id}/foto` e `/ocr-fatture/...`, quindi va montato sotto `/api` (non `/api/invoices` né `/api/ocr-fatture`):

```python
app.include_router(
    fatture_foto_ocr.router,
    prefix="/api",
    tags=["Fatture Foto & OCR Correzioni"],
)
```

Così gli URL finali saranno:

- `POST   /api/invoices/{id}/foto`
- `GET    /api/invoices/{id}/foto`
- `GET    /api/invoices/{id}/foto/{foto_id}`
- `DELETE /api/invoices/{id}/foto/{foto_id}`
- `POST   /api/ocr-fatture/correzione`
- `GET    /api/ocr-fatture/correzioni`
- `DELETE /api/ocr-fatture/correzioni/{id}`
- `GET    /api/ocr-fatture/stats`

Questi sono esattamente i path che Appgestionale `index.html` chiama.

## 3. Variabile d'ambiente (opzionale)

Il router salva le foto in `app/uploads/fatture_foto/<invoice_id>/`. Se vuoi cambiare percorso aggiungi a `.env`:

```
FATTURE_FOTO_DIR=/percorso/assoluto/fatture_foto
```

Su Emergent di default `app/uploads/` dovrebbe funzionare perché hai già altre foto lì (es. `app/uploads/pec_xml/`).

## 4. CORS (critico!)

Il frontend Appgestionale gira su `https://ceraldicontabilita.github.io/Appgestionale/` (diverso dominio da impresasemplice.online). Verifica che `app/main.py` abbia già questa origin nel CORSMiddleware. Dalle istruzioni pre-esistenti dovrebbe già esserci — se no, aggiungi:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://ceraldicontabilita.github.io",
        "http://localhost:3000",
        # ... altre origins già presenti
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Nota: per l'upload `multipart/form-data` serve che `allow_headers` includa almeno `Authorization` e `Content-Type`, ma `"*"` copre tutto.

## 5. Collezioni MongoDB create automaticamente

- `ocr_correzioni` — un doc per ogni diff AI↔utente registrato. Non serve alcuna creazione manuale (Motor le crea al primo insert).

## 6. Test rapido dopo deploy

Da terminale con un JWT admin valido:

```bash
JWT="eyJhbGciOi..."  # il JWT che l'app mobile riceve dal PIN login

# 1. Vedi correzioni (lista vuota all'inizio)
curl -H "Authorization: Bearer $JWT" \
     https://impresasemplice.online/api/ocr-fatture/correzioni

# 2. Stats (tutti zeri)
curl -H "Authorization: Bearer $JWT" \
     https://impresasemplice.online/api/ocr-fatture/stats

# 3. Simula correzione
curl -X POST -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
     -d '{"ai_read":{"fornitore":"MADBIT ENTER","numero_fattura":"FT001"},"user_final":{"fornitore":"MadBit Entertainment S.r.l.","numero_fattura":"FT001"},"fornitore_context":"MadBit Entertainment S.r.l."}' \
     https://impresasemplice.online/api/ocr-fatture/correzione

# 4. Rivedi lista — ora c'è 1 record
curl -H "Authorization: Bearer $JWT" \
     https://impresasemplice.online/api/ocr-fatture/correzioni
```

Se tutti e 4 funzionano, l'Appgestionale mobile può iniziare a usare l'apprendimento.
