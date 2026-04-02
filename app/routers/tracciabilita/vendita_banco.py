"""
Router: Vendita al Banco
Gestisce la produzione giornaliera inviata alla vendita e l'invenduto serale.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, date
import uuid

router = APIRouter(prefix="/vendita-banco", tags=["vendita_banco"])

# Importa db dal server principale
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from app.routers.tracciabilita.server import db


# ── Modelli ────────────────────────────────────────────────────────────────────

class VenditaBancoIn(BaseModel):
    prodotto_id: str
    prodotto_nome: str
    reparto: str = "rosticceria"
    pezzi_prodotti: int
    foto_url: Optional[str] = None
    data: Optional[str] = None   # yyyy-MM-dd, default oggi


class InvendutoIn(BaseModel):
    vendita_id: str
    pezzi_invenduto: int
    note: Optional[str] = ""


# ── Helper ─────────────────────────────────────────────────────────────────────

def oggi_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/registra")
async def registra_vendita_banco(payload: VenditaBancoIn):
    """Registra produzione inviata al banco (non stoccata in frigo)."""
    doc = {
        "id": str(uuid.uuid4()),
        "prodotto_id": payload.prodotto_id,
        "prodotto_nome": payload.prodotto_nome,
        "reparto": payload.reparto,
        "foto_url": payload.foto_url,
        "pezzi_prodotti": payload.pezzi_prodotti,
        "pezzi_invenduto": None,         # compilato la sera
        "pezzi_venduti": None,           # calcolato quando arriva invenduto
        "data": payload.data or oggi_str(),
        "creato_at": datetime.now(timezone.utc).isoformat(),
        "invenduto_at": None,
        "stato": "aperto"                # aperto → chiuso (dopo invenduto)
    }
    await db.vendite_banco.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/{vendita_id}/invenduto")
async def registra_invenduto(vendita_id: str, payload: InvendutoIn):
    """Segna l'invenduto serale e calcola il venduto effettivo."""
    vendita = await db.vendite_banco.find_one({"id": vendita_id}, {"_id": 0})
    if not vendita:
        raise HTTPException(404, "Registrazione non trovata")

    pezzi_venduti = max(0, vendita["pezzi_prodotti"] - payload.pezzi_invenduto)

    await db.vendite_banco.update_one(
        {"id": vendita_id},
        {"$set": {
            "pezzi_invenduto": payload.pezzi_invenduto,
            "pezzi_venduti": pezzi_venduti,
            "note_invenduto": payload.note,
            "invenduto_at": datetime.now(timezone.utc).isoformat(),
            "stato": "chiuso"
        }}
    )
    return {"vendita_id": vendita_id, "pezzi_venduti": pezzi_venduti, "pezzi_invenduto": payload.pezzi_invenduto}


@router.get("/oggi")
async def get_vendite_oggi(reparto: str = ""):
    """Restituisce le registrazioni di oggi arricchite con costo e prezzo."""
    query = {"data": oggi_str()}
    if reparto:
        query["reparto"] = reparto
    docs = await db.vendite_banco.find(query, {"_id": 0}).sort("creato_at", -1).to_list(200)

    # Filtra record corrotti (senza nome prodotto)
    docs = [d for d in docs if d.get("prodotto_nome")]

    for doc in docs:
        # Se il record ha già costo e prezzo salvati, non serve cercare
        if doc.get("costo_produzione") and doc.get("prezzo_vendita"):
            continue

        nome = (doc.get("prodotto_nome") or "").strip().lower()
        prod_id = doc.get("prodotto_id")

        # 1. Cerca in prodotti_vendita per id (più preciso)
        pv = None
        if prod_id:
            pv = await db.prodotti_vendita.find_one(
                {"id": prod_id},
                {"_id": 0, "costo_produzione": 1, "prezzo_vendita": 1}
            )
        # 2. Fallback: cerca per nome in prodotti_vendita
        if not pv:
            pv = await db.prodotti_vendita.find_one(
                {"nome_display": {"$regex": nome, "$options": "i"}},
                {"_id": 0, "costo_produzione": 1, "prezzo_vendita": 1}
            )
        if pv:
            if not doc.get("costo_produzione"):
                doc["costo_produzione"] = pv.get("costo_produzione") or 0
            if not doc.get("prezzo_vendita"):
                doc["prezzo_vendita"] = pv.get("prezzo_vendita") or 0
            if doc.get("costo_produzione"):
                continue  # trovato, passa al prossimo

        # 3. Fallback: cerca in ricette per nome
        ricetta = await db.ricette.find_one(
            {"nome": {"$regex": nome, "$options": "i"}},
            {"_id": 0, "costo_totale": 1, "pezzi_produzione": 1, "prezzo_vendita": 1}
        )
        if ricetta:
            ct  = ricetta.get("costo_totale") or 0
            pzr = ricetta.get("pezzi_produzione") or 1
            if not doc.get("costo_produzione"):
                doc["costo_produzione"] = round(ct / pzr, 4)
            if not doc.get("prezzo_vendita"):
                doc["prezzo_vendita"] = ricetta.get("prezzo_vendita") or 0

    return docs


@router.get("/giorno/{data}")
async def get_vendite_giorno(data: str, reparto: str = ""):
    """Registrazioni per una data specifica (yyyy-MM-dd)."""
    query = {"data": data}
    if reparto:
        query["reparto"] = reparto
    docs = await db.vendite_banco.find(query, {"_id": 0}).sort("creato_at", -1).to_list(500)
    return docs


@router.get("/statistiche")
async def get_statistiche_vendite(
    data_da: Optional[str] = None,
    data_a: Optional[str] = None,
    reparto: Optional[str] = None
):
    """Statistiche vendite per periodo: totale prodotto, venduto, invenduto per prodotto."""
    match: dict = {"stato": "chiuso"}
    if data_da:
        match.setdefault("data", {})["$gte"] = data_da
    if data_a:
        match.setdefault("data", {})["$lte"] = data_a
    if reparto:
        match["reparto"] = reparto

    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": "$prodotto_nome",
            "totale_prodotti": {"$sum": "$pezzi_prodotti"},
            "totale_venduti": {"$sum": "$pezzi_venduti"},
            "totale_invenduto": {"$sum": "$pezzi_invenduto"},
            "giorni": {"$sum": 1}
        }},
        {"$project": {
            "prodotto": "$_id",
            "_id": 0,
            "totale_prodotti": 1,
            "totale_venduti": 1,
            "totale_invenduto": 1,
            "giorni": 1,
            "pct_venduto": {
                "$cond": [
                    {"$gt": ["$totale_prodotti", 0]},
                    {"$multiply": [{"$divide": ["$totale_venduti", "$totale_prodotti"]}, 100]},
                    0
                ]
            }
        }},
        {"$sort": {"totale_venduti": -1}}
    ]
    result = await db.vendite_banco.aggregate(pipeline).to_list(200)
    for r in result:
        r["pct_venduto"] = round(r.get("pct_venduto", 0), 1)
    return result


@router.get("/statistiche-giorno")
async def get_statistiche_per_giorno(
    data_da: Optional[str] = None,
    data_a: Optional[str] = None,
    reparto: Optional[str] = None
):
    """Vendite raggruppate per giorno, con dettaglio prodotti per ogni giorno."""
    match: dict = {"stato": "chiuso"}
    if data_da:
        match.setdefault("data", {})["$gte"] = data_da
    if data_a:
        match.setdefault("data", {})["$lte"] = data_a
    if reparto:
        match["reparto"] = reparto

    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": {"data": "$data", "prodotto": "$prodotto_nome"},
            "pezzi_prodotti": {"$sum": "$pezzi_prodotti"},
            "pezzi_venduti":  {"$sum": "$pezzi_venduti"},
            "pezzi_invenduto":{"$sum": "$pezzi_invenduto"},
        }},
        {"$sort": {"_id.data": -1, "_id.prodotto": 1}}
    ]
    rows = await db.vendite_banco.aggregate(pipeline).to_list(1000)

    # Raggruppa per giorno
    giorni_map: dict = {}
    for r in rows:
        d = r["_id"]["data"]
        prod = r["_id"]["prodotto"]
        pz_p = r["pezzi_prodotti"] or 0
        pz_v = r["pezzi_venduti"] or 0
        pz_i = r["pezzi_invenduto"] or 0
        pct  = round((pz_v / pz_p) * 100, 1) if pz_p > 0 else 0
        if d not in giorni_map:
            giorni_map[d] = {"data": d, "totale_prodotti": 0, "totale_venduti": 0, "totale_invenduto": 0, "prodotti": []}
        giorni_map[d]["totale_prodotti"]  += pz_p
        giorni_map[d]["totale_venduti"]   += pz_v
        giorni_map[d]["totale_invenduto"] += pz_i
        giorni_map[d]["prodotti"].append({
            "prodotto": prod,
            "pezzi_prodotti": pz_p,
            "pezzi_venduti": pz_v,
            "pezzi_invenduto": pz_i,
            "pct": pct
        })

    return sorted(giorni_map.values(), key=lambda x: x["data"], reverse=True)


@router.get("/trend-giornaliero")
async def get_trend_giornaliero(giorni: int = 30, reparto: Optional[str] = None):
    """Trend giornaliero: pezzi prodotti vs venduti."""
    from datetime import timedelta
    data_inizio = (datetime.now(timezone.utc) - timedelta(days=giorni)).strftime("%Y-%m-%d")
    match: dict = {"stato": "chiuso", "data": {"$gte": data_inizio}}
    if reparto:
        match["reparto"] = reparto
    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": "$data",
            "prodotti": {"$sum": "$pezzi_prodotti"},
            "venduti": {"$sum": "$pezzi_venduti"},
            "invenduto": {"$sum": "$pezzi_invenduto"},
            "articoli": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    result = await db.vendite_banco.aggregate(pipeline).to_list(100)
    return [{"data": r["_id"], "prodotti": r["prodotti"], "venduti": r["venduti"],
             "invenduto": r["invenduto"], "articoli": r["articoli"]} for r in result]


@router.put("/{vendita_id}/riapri")
async def riapri_vendita(vendita_id: str):
    """Riapre un record già chiuso per correggere l'invenduto."""
    result = await db.vendite_banco.update_one(
        {"id": vendita_id},
        {"$set": {"stato": "aperto", "pezzi_invenduto": None, "pezzi_venduti": None}}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Non trovata")
    return {"success": True}


@router.delete("/{vendita_id}")
async def elimina_vendita(vendita_id: str):
    result = await db.vendite_banco.delete_one({"id": vendita_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Non trovata")
    return {"success": True}



@router.get("/report-sprechi")
async def get_report_sprechi(
    raggruppamento: str = "giorno",   # "giorno" | "mese" | "anno"
    data_da: Optional[str] = None,
    data_a: Optional[str] = None,
):
    """
    Report invenduto (sprechi) con stima costo materie prime.
    Raggruppa per giorno, mese o anno.
    Calcola il costo sprecato unendo vendite_banco con il costo delle ricette.
    """
    from datetime import timedelta

    # Range default: ultimi 30 giorni
    if not data_da:
        data_da = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    if not data_a:
        data_a = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    match = {
        "stato": "chiuso",
        "data": {"$gte": data_da, "$lte": data_a},
        "pezzi_invenduto": {"$gt": 0}
    }

    # Carica tutti i record invenduti nel periodo
    docs = await db.vendite_banco.find(match, {"_id": 0}).to_list(5000)

    # Carica ricette per recuperare costo_totale e pezzi_produzione
    ricette_list = await db.ricette.find({}, {"_id": 0, "nome": 1, "costo_totale": 1, "pezzi_produzione": 1}).to_list(1000)
    # Mappa nome (lowercase) → costo_per_pezzo
    costo_map: dict = {}
    for r in ricette_list:
        nome_n = (r.get("nome") or "").strip().lower()
        ct = r.get("costo_totale") or 0
        pz = r.get("pezzi_produzione") or 1
        if nome_n and ct > 0:
            costo_map[nome_n] = round(ct / pz, 4)

    # Raggruppa
    def chiave(doc):
        data = doc.get("data", "")
        if raggruppamento == "anno":
            return data[:4]
        if raggruppamento == "mese":
            return data[:7]
        return data  # giorno

    gruppi: dict = {}
    for doc in docs:
        k = chiave(doc)
        nome = (doc.get("prodotto_nome") or "").strip()
        nome_n = nome.lower()
        pz_inv = doc.get("pezzi_invenduto") or 0
        pz_prod = doc.get("pezzi_prodotti") or 0
        costo_pz = costo_map.get(nome_n, 0)
        costo_sprecato = round(pz_inv * costo_pz, 4)

        if k not in gruppi:
            gruppi[k] = {
                "periodo": k,
                "totale_invenduto": 0,
                "totale_prodotto": 0,
                "costo_sprecato": 0,
                "prodotti": {}
            }

        g = gruppi[k]
        g["totale_invenduto"] += pz_inv
        g["totale_prodotto"] += pz_prod
        g["costo_sprecato"] += costo_sprecato

        if nome_n not in g["prodotti"]:
            g["prodotti"][nome_n] = {
                "nome": nome,
                "pezzi_invenduto": 0,
                "pezzi_prodotto": 0,
                "costo_pz": costo_pz,
                "costo_sprecato": 0,
                "giorni": 0
            }
        g["prodotti"][nome_n]["pezzi_invenduto"] += pz_inv
        g["prodotti"][nome_n]["pezzi_prodotto"] += pz_prod
        g["prodotti"][nome_n]["costo_sprecato"] += costo_sprecato
        g["prodotti"][nome_n]["giorni"] += 1

    # Costruisci risposta ordinata
    result = []
    for k in sorted(gruppi.keys(), reverse=True):
        g = gruppi[k]
        pct_sprecato = round((g["totale_invenduto"] / g["totale_prodotto"]) * 100, 1) if g["totale_prodotto"] > 0 else 0
        prodotti_list = sorted(g["prodotti"].values(), key=lambda x: x["costo_sprecato"], reverse=True)
        # Arrotonda costi
        for p in prodotti_list:
            p["costo_sprecato"] = round(p["costo_sprecato"], 2)
        result.append({
            "periodo": k,
            "totale_invenduto": g["totale_invenduto"],
            "totale_prodotto": g["totale_prodotto"],
            "pct_sprecato": pct_sprecato,
            "costo_sprecato": round(g["costo_sprecato"], 2),
            "prodotti": prodotti_list
        })

    # KPI globali
    tot_pz = sum(g["totale_invenduto"] for g in gruppi.values())
    tot_costo = round(sum(g["costo_sprecato"] for g in gruppi.values()), 2)
    tot_prod = sum(g["totale_prodotto"] for g in gruppi.values())

    return {
        "raggruppamento": raggruppamento,
        "data_da": data_da,
        "data_a": data_a,
        "kpi": {
            "totale_pezzi_invenduti": tot_pz,
            "totale_prodotto": tot_prod,
            "pct_media_spreco": round((tot_pz / tot_prod) * 100, 1) if tot_prod > 0 else 0,
            "costo_totale_sprecato": tot_costo
        },
        "periodi": result
    }
