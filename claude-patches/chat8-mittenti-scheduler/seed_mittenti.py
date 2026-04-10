"""
Script di seed per la collection mittenti_email.
Popola SOLO i mittenti attendibili — tutto il resto viene ignorato dallo scanner.

Eseguire con: python3 seed_mittenti.py
(Richiede motor: pip install motor)
"""
import asyncio
import uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

MONGODB_URI = "mongodb+srv://Ceraldidatabase:Ceraldi1974@cluster0.vofh7iz.mongodb.net/Gestionale?retryWrites=true&w=majority"

# ═══════════════════════════════════════════════════════════════════════════════
# MITTENTI GMAIL
# Solo questi indirizzi vengono scaricati dalla casella ceraldigroupsrl@gmail.com
# ═══════════════════════════════════════════════════════════════════════════════
MITTENTI_GMAIL = [
    # ── COMMERCIALISTA / CONSULENTE DEL LAVORO ────────────────────────────
    # Mandano: F24 fiscali, F24 contributivi, cedolini PDF, libro unico, TFR
    {
        "pattern": "rosaria.marotta",
        "tipo_documento": "cedolino",
        "descrizione": "Commercialista Marotta – F24 fiscali IRPEF/IVA/IRAP + cedolini"
    },
    {
        "pattern": "grazia.studioferrantini",
        "tipo_documento": "cedolino",
        "descrizione": "Studio Ferrantini Grazia – F24 contributivi INPS/INAIL + cedolini"
    },
    {
        "pattern": "f.ferrantini",
        "tipo_documento": "cedolino",
        "descrizione": "F. Ferrantini – F24 contributivi"
    },
    {
        "pattern": "studioferrantini",
        "tipo_documento": "cedolino",
        "descrizione": "Studio Ferrantini (dominio generico)"
    },

    # ── INPS ──────────────────────────────────────────────────────────────
    # Mandano: DURC, DM10, delibere FONSI, cassa integrazione, comunicazioni
    {
        "pattern": "inps.it",
        "tipo_documento": "inps",
        "descrizione": "INPS – comunicazioni ufficiali, DURC, matricola"
    },
    {
        "pattern": "pec.inps",
        "tipo_documento": "inps",
        "descrizione": "INPS PEC – delibere, FONSI, CIG, ammortizzatori sociali"
    },
    {
        "pattern": "fonsi",
        "tipo_documento": "inps",
        "descrizione": "INPS FONSI – delibere cassa integrazione"
    },

    # ── INAIL ─────────────────────────────────────────────────────────────
    # Mandano: autoliquidazione annuale, denuncia infortuni, ricevute
    {
        "pattern": "inail.it",
        "tipo_documento": "inail",
        "descrizione": "INAIL – autoliquidazione, infortuni sul lavoro"
    },

    # ── AGENZIA ENTRATE / RISCOSSIONE ────────────────────────────────────
    # Mandano: cartelle esattoriali, avvisi bonari, rottamazione, intimazioni
    {
        "pattern": "agenziaentrate.gov",
        "tipo_documento": "cartella_esattoriale",
        "descrizione": "Agenzia Entrate – avvisi bonari, comunicazioni fiscali"
    },
    {
        "pattern": "agenziariscossione",
        "tipo_documento": "cartella_esattoriale",
        "descrizione": "Agenzia Riscossione (AdER) – cartelle, intimazioni"
    },
    {
        "pattern": "riscossione.gov",
        "tipo_documento": "cartella_esattoriale",
        "descrizione": "Riscossione – cartelle esattoriali, rottamazione"
    },
    {
        "pattern": "@ader.",
        "tipo_documento": "cartella_esattoriale",
        "descrizione": "AdER diretto – intimazioni di pagamento"
    },

    # ── PAGOPA / COMUNE DI NAPOLI ────────────────────────────────────────
    # Mandano: ricevute PagoPA, avvisi TARI, COSAP, verbali CdS pagati, multa pagata
    {
        "pattern": "pagopa.gov",
        "tipo_documento": "pagopa",
        "descrizione": "PagoPA – ricevute pagamento tasse comunali"
    },
    {
        "pattern": "comune.napoli",
        "tipo_documento": "pagopa",
        "descrizione": "Comune di Napoli – avvisi TARI, COSAP, verbali CdS"
    },
    {
        "pattern": "napoli.gov",
        "tipo_documento": "pagopa",
        "descrizione": "Portale Napoli – avvisi e ricevute"
    },
    {
        "pattern": "municipalita.napoli",
        "tipo_documento": "pagopa",
        "descrizione": "Municipalità Napoli – verbali pagati, ricevute"
    },

    # ── PAYPAL ───────────────────────────────────────────────────────────
    # Mandano: estratti conto mensili, conferme transazioni
    {
        "pattern": "paypal.com",
        "tipo_documento": "paypal",
        "descrizione": "PayPal – estratti conto, movimenti, ricevute transazioni"
    },
    {
        "pattern": "service@paypal",
        "tipo_documento": "paypal",
        "descrizione": "PayPal Service – notifiche pagamenti ricevuti/inviati"
    },

    # ── NOLEGGIO AUTO ────────────────────────────────────────────────────
    # Mandano: verbali di infrazione (targa auto aziendale), fatture canone mensile
    {
        "pattern": "leasys",
        "tipo_documento": "generico",
        "descrizione": "Leasys – verbali infrazione + fatture canone noleggio"
    },
    {
        "pattern": "ald",
        "tipo_documento": "generico",
        "descrizione": "ALD Automotive – verbali + canoni"
    },
    {
        "pattern": "arval",
        "tipo_documento": "generico",
        "descrizione": "Arval – verbali + canoni noleggio"
    },
    {
        "pattern": "leaseplan",
        "tipo_documento": "generico",
        "descrizione": "LeasePlan – verbali + canoni"
    },
    {
        "pattern": "ayvens",
        "tipo_documento": "generico",
        "descrizione": "Ayvens (ex ALD) – verbali + canoni"
    },
    {
        "pattern": "free2move",
        "tipo_documento": "generico",
        "descrizione": "Free2Move – noleggio auto"
    },

    # ── BANCHE ───────────────────────────────────────────────────────────
    # Mandano: estratti conto PDF, avvisi saldo, notifiche movimenti
    {
        "pattern": "bnl.it",
        "tipo_documento": "generico",
        "descrizione": "BNL – estratti conto corrente e carta Business"
    },
    {
        "pattern": "bancobpm",
        "tipo_documento": "generico",
        "descrizione": "Banco BPM – estratti conto"
    },
    {
        "pattern": "nexi.it",
        "tipo_documento": "generico",
        "descrizione": "Nexi – estratti carta, movimenti POS"
    },

    # ── ARUBA FATTURE ────────────────────────────────────────────────────
    # Mandano: notifica "hai ricevuto una nuova fattura elettronica"
    # Il sistema legge il corpo HTML, estrae i dati e crea la fattura provvisoria
    {
        "pattern": "fatturazioneelettronica.aruba.it",
        "tipo_documento": "fattura_xml",
        "descrizione": "Aruba – notifica ricezione fattura elettronica (corpo HTML con dati)"
    },
    {
        "pattern": "noreply@fatturazioneelettronica",
        "tipo_documento": "fattura_xml",
        "descrizione": "Aruba noreply – notifica fattura"
    },
]

# ═══════════════════════════════════════════════════════════════════════════════
# MITTENTI PEC (fatturazioneceraldi@pec.it via imaps.pec.aruba.it)
# ═══════════════════════════════════════════════════════════════════════════════
MITTENTI_PEC = [
    # ── SDI — Sistema di Interscambio (fatture XML obbligatorie) ──────────
    # Mandano: file .xml e .p7m con le fatture elettroniche dei fornitori
    {
        "pattern": "pec.fatturapa.gov.it",
        "tipo_documento": "fattura_xml",
        "descrizione": "SDI – fatture elettroniche XML (principale)"
    },
    {
        "pattern": "fatturapa.gov.it",
        "tipo_documento": "fattura_xml",
        "descrizione": "SDI – fatture elettroniche PA"
    },
    {
        "pattern": "sdi01",
        "tipo_documento": "fattura_xml",
        "descrizione": "SDI nodo 01 – fatture B2B"
    },
    {
        "pattern": "noreply@pec",
        "tipo_documento": "fattura_xml",
        "descrizione": "PEC generica SDI"
    },

    # ── COMMERCIALISTA / CEDOLINI via PEC ────────────────────────────────
    {
        "pattern": "rosaria.marotta",
        "tipo_documento": "cedolino",
        "descrizione": "Commercialista Marotta via PEC"
    },
    {
        "pattern": "studioferrantini",
        "tipo_documento": "cedolino",
        "descrizione": "Studio Ferrantini via PEC"
    },

    # ── INPS via PEC ─────────────────────────────────────────────────────
    {
        "pattern": "pec.inps.it",
        "tipo_documento": "inps",
        "descrizione": "INPS PEC ufficiale – DURC, delibere"
    },

    # ── AGENZIA ENTRATE via PEC ──────────────────────────────────────────
    {
        "pattern": "agenziaentrate",
        "tipo_documento": "cartella_esattoriale",
        "descrizione": "Agenzia Entrate via PEC – avvisi ufficiali"
    },
    {
        "pattern": "riscossione",
        "tipo_documento": "cartella_esattoriale",
        "descrizione": "Riscossione via PEC – cartelle, intimazioni"
    },

    # ── PAGOPA via PEC ───────────────────────────────────────────────────
    {
        "pattern": "pagopa",
        "tipo_documento": "pagopa",
        "descrizione": "PagoPA via PEC – ricevute ufficiali"
    },
    {
        "pattern": "comune.napoli",
        "tipo_documento": "pagopa",
        "descrizione": "Comune Napoli via PEC – verbali CdS, avvisi"
    },
]


async def main():
    print("🔌 Connessione a MongoDB Atlas...")
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client["Gestionale"]

    inseriti = 0
    aggiornati = 0
    saltati = 0

    async def upsert_lista(lista, canale):
        nonlocal inseriti, aggiornati
        for m in lista:
            existing = await db["mittenti_email"].find_one({
                "pattern": m["pattern"], "canale": canale
            })
            doc = {
                "pattern":        m["pattern"],
                "canale":         canale,
                "tipo_documento": m["tipo_documento"],
                "descrizione":    m["descrizione"],
                "attivo":         True,
                "updated_at":     datetime.now(timezone.utc).isoformat(),
            }
            if existing:
                await db["mittenti_email"].update_one(
                    {"_id": existing["_id"]}, {"$set": doc}
                )
                aggiornati += 1
                print(f"  ↻ aggiornato [{canale}] {m['pattern']}")
            else:
                doc["id"]         = str(uuid.uuid4())
                doc["created_at"] = datetime.now(timezone.utc).isoformat()
                await db["mittenti_email"].insert_one(doc)
                inseriti += 1
                print(f"  + inserito  [{canale}] {m['pattern']}")

    print(f"\n📧 Gmail ({len(MITTENTI_GMAIL)} mittenti)...")
    await upsert_lista(MITTENTI_GMAIL, "gmail")

    print(f"\n📨 PEC ({len(MITTENTI_PEC)} mittenti)...")
    await upsert_lista(MITTENTI_PEC, "pec")

    client.close()

    print(f"\n{'='*50}")
    print(f"✅ COMPLETATO")
    print(f"   Inseriti:   {inseriti}")
    print(f"   Aggiornati: {aggiornati}")
    print(f"   Gmail:      {len(MITTENTI_GMAIL)} pattern")
    print(f"   PEC:        {len(MITTENTI_PEC)} pattern")
    print(f"\n⚠️  IMPORTANTE: Aggiornare anche lo scheduler a 50 minuti.")
    print(f"   app/services/email_monitor_service.py → interval_seconds: int = 3000")


if __name__ == "__main__":
    asyncio.run(main())
