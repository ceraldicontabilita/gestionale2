# Credenziali di Test — Ceraldi ERP
> Aggiornato: Aprile 2026

---

## MongoDB Atlas
- URI: `mongodb+srv://Ceraldidatabase:Accesso1974.@cluster0.vofh7iz.mongodb.net/`
- Database: `azienda_erp_db`

---

## Gmail IMAP/SMTP
- Account: `ceraldigroupsrl@gmail.com`
- App Password: `nugg fttp swvx djqd`
- Host IMAP: `imap.gmail.com:993` (SSL)
- Host SMTP: `smtp.gmail.com:587` (TLS)
- Stato: **FUNZIONANTE** (Apr 2026)

---

## Aruba PEC (Fatturazione Elettronica SDI)
- Account: `fatturazioneceraldi@pec.it`
- Password: `L)9*kd5+78]?%LmF`
- Host: `imaps.pec.aruba.it:993`
- Stato: configurato (scheduler non ancora riabilitato)

---

## Auth App
- Autenticazione: **DISABILITATA** (`AUTH_DISABLED=true`)
- Nessun login richiesto per accedere all'app
- JWT Secret: `your-super-secret-key-change-in-production-min-32-chars-long`

---

## Note
- L'app non richiede login — accesso diretto a tutte le sezioni
- Per test API: usare `REACT_APP_BACKEND_URL` da `frontend/.env`
- Cron Secret: `ceraldi2025xK9mQ3zP8nR`
- AZIENDA_ID: `b0295759-35ce-4b34-a6b4-f01b883234ad`
