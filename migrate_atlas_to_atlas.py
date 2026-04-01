"""
Migrazione dati: azienda_erp_db → mittenti-integration-azienda_erp
Stesso cluster Atlas, database diverso.
Evita duplicati usando _id (skip se esiste già).
"""
import sys
from pymongo import MongoClient, InsertOne
from pymongo.errors import BulkWriteError
from datetime import datetime

ATLAS_URL = "mongodb+srv://Ceraldidatabase:Accesso1974.@cluster0.vofh7iz.mongodb.net/?appName=Cluster0"
SOURCE_DB = "azienda_erp_db"
TARGET_DB = "mittenti-integration-azienda_erp"

BATCH_SIZE = 500  # inserimenti per batch

def migrate():
    print(f"\n{'='*60}")
    print(f"MIGRAZIONE ATLAS: {SOURCE_DB} → {TARGET_DB}")
    print(f"Avvio: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}\n")

    client = MongoClient(ATLAS_URL, serverSelectionTimeoutMS=30000)
    src = client[SOURCE_DB]
    tgt = client[TARGET_DB]

    collections = sorted(src.list_collection_names())
    print(f"Collection sorgente trovate: {len(collections)}\n")

    total_copied = 0
    total_skipped = 0
    results = []

    for i, col_name in enumerate(collections, 1):
        src_col = src[col_name]
        tgt_col = tgt[col_name]

        src_count = src_col.count_documents({})
        tgt_count = tgt_col.count_documents({})

        if src_count == 0:
            print(f"  [{i:3d}/{len(collections)}] {col_name}: 0 doc — SKIP (vuota)")
            results.append((col_name, 0, 0, 0))
            continue

        if tgt_count >= src_count:
            print(f"  [{i:3d}/{len(collections)}] {col_name}: già aggiornata ({tgt_count} doc) — SKIP")
            total_skipped += tgt_count
            results.append((col_name, src_count, 0, tgt_count))
            continue

        # Carica _id esistenti nel target per evitare duplicati
        existing_ids = set()
        if tgt_count > 0:
            for doc in tgt_col.find({}, {"_id": 1}):
                existing_ids.add(doc["_id"])

        # Copia in batch
        batch = []
        copied = 0
        skipped = 0

        for doc in src_col.find({}):
            if doc["_id"] in existing_ids:
                skipped += 1
                continue
            batch.append(InsertOne(doc))
            if len(batch) >= BATCH_SIZE:
                try:
                    tgt_col.bulk_write(batch, ordered=False)
                    copied += len(batch)
                except BulkWriteError as e:
                    copied += e.details.get("nInserted", 0)
                    skipped += len(batch) - e.details.get("nInserted", 0)
                batch = []

        if batch:
            try:
                tgt_col.bulk_write(batch, ordered=False)
                copied += len(batch)
            except BulkWriteError as e:
                copied += e.details.get("nInserted", 0)
                skipped += len(batch) - e.details.get("nInserted", 0)

        total_copied += copied
        total_skipped += skipped
        results.append((col_name, src_count, copied, skipped))
        print(f"  [{i:3d}/{len(collections)}] {col_name}: {src_count} src → copiati {copied}, saltati {skipped}")

    # Riepilogo finale
    print(f"\n{'='*60}")
    print(f"COMPLETATO: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Documenti copiati:  {total_copied:,}")
    print(f"Documenti saltati:  {total_skipped:,} (già presenti)")
    print(f"{'='*60}")

    # Verifica finale
    print(f"\nVerifica collection TARGET ({TARGET_DB}):")
    tgt_collections = tgt.list_collection_names()
    tgt_total = 0
    for col_name in sorted(tgt_collections):
        count = tgt[col_name].count_documents({})
        tgt_total += count
    print(f"  {len(tgt_collections)} collections, {tgt_total:,} documenti totali")

    client.close()
    return total_copied

if __name__ == "__main__":
    copied = migrate()
    sys.exit(0 if copied >= 0 else 1)
