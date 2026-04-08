# Ceraldi ERP v2

Gestionale HORECA — FastAPI + Motor + React 18 + Vite + MongoDB Atlas

## Setup

```bash
# Backend
pip install -r requirements.txt
cd frontend && npm install && cd ..

# Configura variabili d'ambiente
cp .env.example .env  # oppure crea .env manualmente

# Avvio sviluppo
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
cd frontend && npm run dev
```

## Seed database (dati iniziali)
```bash
pip install pymongo dnspython
python seed_database.py
```

## Stack
- **Backend:** FastAPI + Motor (async MongoDB)
- **Frontend:** React 18 + Vite + React Router v6
- **Database:** MongoDB Atlas (db: Gestionale)
- **PDF parsing:** PyMuPDF + pdfplumber
- **PDF generation:** ReportLab

## Sezioni
- **Dipendenti** — CRUD + pignoramenti + dichiarazione stragiudiziale
- **Fatture** — Upload XML SDI, parsing FatturaPA
- **Cedolini** — Upload PDF Zucchetti multi-dipendente
- **Estratto Conto** — Upload PDF Banco BPM, categorizzazione movimenti
- **Distinte** — Upload PDF distinta pagamento stipendi
- **F24** — Upload PDF modello F24, estrazione tributi
- **Corrispettivi** — Upload XML registratore telematico
- **Verbali** — Upload PDF verbali CdS / bollo auto
