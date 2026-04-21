#!/usr/bin/env python3
"""
Cleanup ESTRATTO CONTO — rimuove i duplicati creati da import ripetuti in
formati di data diversi (ISO vs italiano) e unifica i due campi data_contabile
e data su ogni record superstite.

Criterio dedup:
  stessa (data ISO normalizzata, importo ±0.01, descrizione[:40])
  → tiene UN SOLO record, preferendo quello con entrambi i campi data valorizzati.

Non cancella: fa un hard-delete dei duplicati.
"""
import asyncio
import os
import re
from collections import defaultdict
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()
# Load backend .env explicitly (script may be run from different dir)
load_dotenv("/app/backend/.env")


def normalize_date(data_iso, data_it):
    """Ritorna data in formato ISO (YYYY-MM-DD) partendo da un record che può
    avere solo `data` (ISO) o solo `data_contabile` (italiano gg/mm/aaaa)."""
    if data_iso and re.match(r"^\d{4}-\d{2}-\d{2}", str(data_iso)):
        return str(data_iso)[:10]
    if data_it and "/" in str(data_it):
        parts = str(data_it).split("/")
        if len(parts) == 3:
            d, m, y = parts
            return f"{y.zfill(4)}-{m.zfill(2)}-{d.zfill(2)}"
    return None


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    coll = db.estratto_conto_movimenti

    total = await coll.count_documents({})
    print(f"Estratto conto movimenti totali: {total}")

    # Scansiona TUTTI i record (campi minimi)
    records = []
    async for m in coll.find({}, {
        "_id": 1, "data": 1, "data_contabile": 1, "data_valuta": 1,
        "importo": 1, "descrizione": 1, "tipo": 1,
    }):
        records.append(m)

    print(f"Caricati {len(records)} record in memoria.")

    # Raggruppa per (data ISO, importo, descrizione normalizzata, tipo)
    groups = defaultdict(list)
    no_date = 0
    for r in records:
        iso = normalize_date(r.get("data"), r.get("data_contabile"))
        if not iso:
            no_date += 1
            continue
        key = (
            iso,
            round(float(r.get("importo") or 0), 2),
            (r.get("descrizione") or "")[:60].strip(),
            r.get("tipo") or "",
        )
        groups[key].append(r)

    print(f"Gruppi univoci: {len(groups)}. Record senza data: {no_date}")

    # Trova duplicati
    dup_groups = [g for g in groups.values() if len(g) > 1]
    total_extras = sum(len(g) - 1 for g in dup_groups)
    print(f"Gruppi con duplicati: {len(dup_groups)}. Record extra da eliminare: {total_extras}")

    if total_extras == 0:
        print("Nessun duplicato da rimuovere. Done.")
        client.close()
        return

    # ---- PER OGNI GRUPPO: tieni il migliore, elimina gli altri ----
    to_delete_ids = []
    to_update_ops = []
    for grp in dup_groups:
        # Ordina: preferisci quelli con data_contabile + data
        def score(r):
            has_it = 1 if r.get("data_contabile") else 0
            has_iso = 1 if r.get("data") else 0
            return -(has_it + has_iso)  # più campi = meglio (score basso)
        grp_sorted = sorted(grp, key=score)
        keeper = grp_sorted[0]
        # Merge fields: il keeper deve avere sia data che data_contabile
        iso = normalize_date(keeper.get("data"), keeper.get("data_contabile"))
        it_fmt = None
        for r in grp:
            if r.get("data_contabile"):
                it_fmt = r["data_contabile"]
                break
            if r.get("data_valuta"):
                it_fmt = r["data_valuta"]
                break
        if not it_fmt and iso:
            # derive italian from ISO
            y, m, d = iso.split("-")
            it_fmt = f"{d}/{m}/{y}"
        update_fields = {}
        if iso and keeper.get("data") != iso:
            update_fields["data"] = iso
        if it_fmt and not keeper.get("data_contabile"):
            update_fields["data_contabile"] = it_fmt
        if update_fields:
            to_update_ops.append((keeper["_id"], update_fields))
        # Flag duplicati
        for r in grp_sorted[1:]:
            to_delete_ids.append(r["_id"])

    print(f"Aggiornamenti keepers: {len(to_update_ops)}")
    print(f"Da eliminare: {len(to_delete_ids)}")

    # Applica updates in bulk
    from pymongo import UpdateOne
    if to_update_ops:
        ops = [UpdateOne({"_id": _id}, {"$set": fields}) for _id, fields in to_update_ops]
        # batches da 500
        BATCH = 500
        for i in range(0, len(ops), BATCH):
            await coll.bulk_write(ops[i:i+BATCH], ordered=False)
        print(f"Bulk update completed: {len(ops)}")

    # Elimina in batch da 500
    BATCH = 500
    deleted = 0
    for i in range(0, len(to_delete_ids), BATCH):
        batch_ids = to_delete_ids[i:i + BATCH]
        r = await coll.delete_many({"_id": {"$in": batch_ids}})
        deleted += r.deleted_count

    print(f"ELIMINATI: {deleted}")
    after = await coll.count_documents({})
    print(f"Estratto conto dopo cleanup: {after} (era {total})")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
