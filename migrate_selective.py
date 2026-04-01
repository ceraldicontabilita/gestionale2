"""
Migrazione SELETTIVA: Atlas azienda_erp_db → Atlas mittenti-integration-azienda_erp
Copia SOLO le collection essenziali elencate, evita duplicati.
"""
from pymongo import MongoClient, InsertOne
from pymongo.errors import BulkWriteError
from datetime import datetime
import hashlib
import json

ATLAS_URL = "mongodb+srv://Ceraldidatabase:Accesso1974.@cluster0.vofh7iz.mongodb.net/?appName=Cluster0"
SOURCE_DB = "azienda_erp_db"
TARGET_DB = "mittenti-integration-azienda_erp"

COLLECTION_DA_MIGRARE = [
    # GESTIONALE
    "invoices", "fornitori", "prima_nota_cassa", "prima_nota_banca",
    "estratto_conto_movimenti", "estratto_conto_bpm", "corrispettivi",
    "f24_unificato", "cedolini", "employees", "dipendenti",
    "presenze", "presenze_mensili", "salari_buste", "bonifici_stipendi",
    "assegni", "mutui", "cespiti", "dati_provvisori",
    "scadenziario_fornitori", "documenti_classificati", "indice_documenti",
    "prima_nota_salari", "cedolini_importati", "verbali_noleggio",
    # TRACCIABILITÀ / CONDIVISE
    "dizionario_prodotti", "dizionario_ingredienti", "dizionario_prezzi",
    "acquisti_prodotti", "dettaglio_righe_fatture", "haccp_lotti",
    "ricette", "ordini_fornitori", "price_history",
    "warehouse_inventory", "warehouse_stocks", "warehouse_movements",
    "sanificazione", "temperature_positive", "temperature_negative",
]

BATCH_SIZE = 500


def doc_hash(doc_copy: dict) -> str:
    """Hash MD5 dei primi 500 char del doc serializzato come dedup fallback."""
    chiave = json.dumps(doc_copy, default=str, sort_keys=True)[:500]
    return hashlib.md5(chiave.encode()).hexdigest()


def migra():
    client = MongoClient(ATLAS_URL, serverSelectionTimeoutMS=30000)
    src = client[SOURCE_DB]
    tgt = client[TARGET_DB]

    print(f"\n{'='*65}")
    print(f"MIGRAZIONE SELETTIVA — {len(COLLECTION_DA_MIGRARE)} collection")
    print(f"  Da: {SOURCE_DB}")
    print(f"  A:  {TARGET_DB}")
    print(f"  Avvio: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*65}\n")

    totale_inseriti = 0
    totale_saltati = 0
    risultati = []

    for i, coll_name in enumerate(COLLECTION_DA_MIGRARE, 1):
        src_col = src[coll_name]
        tgt_col = tgt[coll_name]

        src_count = src_col.count_documents({})
        if src_count == 0:
            print(f"  [{i:2d}/{len(COLLECTION_DA_MIGRARE)}] {coll_name}: 0 doc sorgente — SKIP")
            risultati.append((coll_name, 0, 0, 0))
            continue

        # Determina strategia dedup: usa campo 'id' se esiste nel primo doc
        sample = src_col.find_one({})
        usa_id_field = sample and 'id' in sample

        # Carica chiavi esistenti nel target per dedup veloce
        tgt_count = tgt_col.count_documents({})
        existing_keys = set()
        if tgt_count > 0:
            if usa_id_field:
                for d in tgt_col.find({}, {"id": 1, "_id": 0}):
                    if "id" in d:
                        existing_keys.add(d["id"])
            else:
                for d in tgt_col.find({}, {"_dedup_hash": 1, "_id": 0}):
                    if "_dedup_hash" in d:
                        existing_keys.add(d["_dedup_hash"])

        # Scansione sorgente e inserimento batch
        batch = []
        inseriti = 0
        saltati = 0

        for doc in src_col.find({}):
            doc_copy = {k: v for k, v in doc.items() if k != "_id"}

            if usa_id_field:
                chiave = doc_copy.get("id")
                if chiave in existing_keys:
                    saltati += 1
                    continue
            else:
                h = doc_hash(doc_copy)
                doc_copy["_dedup_hash"] = h
                if h in existing_keys:
                    saltati += 1
                    continue
                chiave = h

            existing_keys.add(chiave)
            batch.append(InsertOne(doc_copy))

            if len(batch) >= BATCH_SIZE:
                try:
                    res = tgt_col.bulk_write(batch, ordered=False)
                    inseriti += res.inserted_count
                except BulkWriteError as e:
                    inseriti += e.details.get("nInserted", 0)
                    saltati += len(batch) - e.details.get("nInserted", 0)
                batch = []

        if batch:
            try:
                res = tgt_col.bulk_write(batch, ordered=False)
                inseriti += res.inserted_count
            except BulkWriteError as e:
                inseriti += e.details.get("nInserted", 0)
                saltati += len(batch) - e.details.get("nInserted", 0)

        totale_inseriti += inseriti
        totale_saltati += saltati
        risultati.append((coll_name, src_count, inseriti, saltati))

        dedup_mode = "by id" if usa_id_field else "by hash"
        print(f"  [{i:2d}/{len(COLLECTION_DA_MIGRARE)}] {coll_name:<35} {src_count:>6} src | "
              f"+{inseriti:>5} ins | ={saltati:>5} skip  ({dedup_mode})")

    # Riepilogo finale
    print(f"\n{'='*65}")
    print(f"COMPLETATO: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Totale inseriti:  {totale_inseriti:,}")
    print(f"Totale saltati:   {totale_saltati:,} (già presenti)")
    print(f"{'='*65}")

    # Verifica finale sul target
    print(f"\nStato finale {TARGET_DB}:")
    tgt_total = 0
    for coll_name, src_c, ins, skip in risultati:
        if src_c > 0:
            final_count = tgt[coll_name].count_documents({})
            tgt_total += final_count
            status = "✅" if final_count >= src_c else "⚠️"
            print(f"  {status} {coll_name:<35} target={final_count:>6}  src={src_c:>6}")
    print(f"\n  Totale doc nelle collection selezionate: {tgt_total:,}")

    client.close()


if __name__ == "__main__":
    migra()
