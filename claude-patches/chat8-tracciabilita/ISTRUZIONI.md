# Patch Chat 8 — Tracciabilità: rimozione iframe, bottone esterno + pannello sync

## Cosa cambia

Il mini-sito HACCP embedded via iframe viene rimosso.
La pagina `/tracciabilita` diventa una schermata semplice con:
- Bottone "Apri ceraldiapp.it" (nuova scheda)
- Pannello stato sincronizzazione DB in tempo reale

## File da sostituire

### 1. `frontend/src/pages/TracciabilitaPage.jsx`
Sostituire completamente il file con il contenuto di `TracciabilitaPage.jsx` in questa cartella.

**Prima:** iframe che puntava a `/api/tracciabilita/`
**Dopo:** pagina con bottone esterno + 4 stat card (ponte ERP, produzioni oggi, DB, ultimo aggiornamento)

## File che NON cambiano

- `app/main.py` — il router tracciabilità backend rimane (serve ceraldiapp.it)
- `app/routers/erp_bridge.py` — il ponte rimane, anzi viene mostrato nella UI
- `frontend/src/main.jsx` — la route `/tracciabilita` rimane identica

## API chiamate dalla nuova pagina

| Endpoint | Scopo |
|---|---|
| `GET /api/erp/ponte/status` | Verifica connessione ponte + count fatture sync |
| `GET /api/tr/produzioni/per-oggi` | Numero produzioni odierne da ceraldiapp.it |

Entrambi esistono già nel backend, nessuna modifica backend necessaria.

## Note

- Nessuna dipendenza nuova
- CSS inline con lib/utils.js (STYLES, COLORS) come da regole
- Icone lucide-react
- Il pannello si aggiorna manualmente con il bottone "Aggiorna"
