"""
Utility condivise per il ciclo passivo (magazzino + scadenziario).
Usate da import_xml.py durante l'importazione fatture.
"""
import re
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

COL_MAGAZZINO    = "warehouse_stocks"
COL_MOVIMENTI_MAG = "warehouse_movements"
COL_LOTTI        = "haccp_lotti"
COL_SCADENZIARIO = "scadenziario_fornitori"
COL_BANK_TRANSACTIONS = "bank_transactions"
COL_RICONCILIAZIONI   = "riconciliazioni"
COL_FATTURE      = "invoices"

# Fuzzy matching opzionale
try:
    from rapidfuzz import fuzz
    FUZZY_AVAILABLE = True
except ImportError:
    FUZZY_AVAILABLE = False

METODI_PAGAMENTO = {
    "MP01": {"desc": "Contanti",  "tipo": "contanti",  "giorni_default": 0},
    "MP02": {"desc": "Assegno",   "tipo": "assegno",   "giorni_default": 0},
    "MP03": {"desc": "Assegno circolare", "tipo": "assegno", "giorni_default": 0},
    "MP05": {"desc": "Bonifico",  "tipo": "bonifico",  "giorni_default": 30},
    "MP09": {"desc": "RID",       "tipo": "rid",       "giorni_default": 30},
    "MP12": {"desc": "RIBA",      "tipo": "riba",      "giorni_default": 60},
}

CATEGORIE_CENTRO_COSTO = {
    "alimentari": "FOOD", "bevande": "BEVERAGE", "beverage": "BEVERAGE",
    "food": "FOOD", "utenze": "UTILITIES", "energia": "UTILITIES",
    "gas": "UTILITIES", "acqua": "UTILITIES", "pulizie": "SERVICES",
    "manutenzione": "MAINTENANCE", "affitto": "RENT", "locazione": "RENT",
    "personale": "STAFF", "consulenza": "PROFESSIONAL", "marketing": "MARKETING",
}


def estrai_codice_lotto(descrizione: str) -> Optional[str]:
    if not descrizione:
        return None
    patterns = [
        r'LOTTO[:\s]+([A-Z0-9\-]+)',
        r'LOT[:\s]+([A-Z0-9\-]+)',
        r'BATCH[:\s]+([A-Z0-9\-]+)',
        r'\b(L\d{2}[A-Z]\d{3,})\b',
    ]
    for pattern in patterns:
        m = re.search(pattern, descrizione.upper())
        if m:
            return m.group(1).strip()
    return None


def estrai_scadenza(descrizione: str) -> Optional[str]:
    if not descrizione:
        return None
    patterns = [
        r'SCAD[A-Z]*[:\s]+(\d{1,2}[\-/]\d{1,2}[\-/]\d{2,4})',
        r'EXP[A-Z]*[:\s]+(\d{1,2}[\-/]\d{1,2}[\-/]\d{2,4})',
    ]
    for pattern in patterns:
        m = re.search(pattern, descrizione.upper())
        if m:
            try:
                parts = m.group(1).replace('-', '/').split('/')
                if len(parts) == 3:
                    if len(parts[2]) == 2:
                        parts[2] = '20' + parts[2]
                    return f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
            except (ValueError, IndexError):
                pass
    return None


def detect_centro_costo(fornitore: Dict, descrizione_linea: str = "") -> str:
    categoria = (fornitore.get("categoria") or "").lower()
    for key, centro in CATEGORIE_CENTRO_COSTO.items():
        if key in categoria:
            return centro
    ragione = (fornitore.get("ragione_sociale") or "").lower()
    for kw in ["alimentari", "food", "macelleria", "pescheria"]:
        if kw in ragione or kw in descrizione_linea.lower():
            return "FOOD"
    for kw in ["bevande", "vino", "birra"]:
        if kw in ragione or kw in descrizione_linea.lower():
            return "BEVERAGE"
    for kw in ["enel", "eni", "edison", "telecom", "vodafone"]:
        if kw in ragione:
            return "UTILITIES"
    return "GENERAL"


def genera_id_lotto_interno(fornitore_nome: str, data_fattura: str, numero_linea: str) -> str:
    try:
        data_part = data_fattura[:10].replace("-", "")
    except (TypeError, IndexError):
        data_part = datetime.now().strftime("%Y%m%d")
    forn_clean = re.sub(r'[^A-Za-z]', '', fornitore_nome or "XXXX")[:4].upper().ljust(4, 'X')
    unique_part = str(uuid.uuid4())[:4].upper()
    return f"{data_part}-{forn_clean}-{numero_linea.zfill(3)}-{unique_part}"


async def processa_carico_magazzino(
    db, fattura_id: str, fornitore: Dict,
    linee: List[Dict], data_fattura: str, numero_documento: str = ""
) -> Dict:
    """Carico magazzino + lotti HACCP per ogni riga fattura."""
    if fornitore.get("esclude_magazzino", False):
        return {"movimenti_creati": 0, "lotti_creati": 0, "lotti": [], "skipped": True,
                "reason": "Fornitore escluso dal magazzino"}

    movimenti_creati = 0
    lotti_creati = 0
    lotti_dettaglio = []

    for idx, linea in enumerate(linee):
        descrizione = linea.get("descrizione", "")
        if not descrizione or len(descrizione) < 3:
            continue
        try:
            quantita = float(linea.get("quantita", 1))
            prezzo_unitario = float(linea.get("prezzo_unitario", 0))
        except (ValueError, TypeError):
            quantita = 1
            prezzo_unitario = 0

        lotto_fornitore = linea.get("lotto_fornitore") or estrai_codice_lotto(descrizione)
        scadenza_prodotto = linea.get("scadenza_prodotto") or estrai_scadenza(descrizione)
        numero_linea = linea.get("numero_linea", str(idx + 1))
        lotto_interno = genera_id_lotto_interno(fornitore.get("ragione_sociale", ""), data_fattura, numero_linea)

        prodotto = await db[COL_MAGAZZINO].find_one(
            {"$or": [
                {"codice": linea.get("codice_articolo")},
                {"descrizione": {"$regex": f"^{re.escape(descrizione[:30])}", "$options": "i"}}
            ]}, {"_id": 0}
        )
        prodotto_id = prodotto.get("id") if prodotto else str(uuid.uuid4())

        if not prodotto:
            nuovo = {
                "id": prodotto_id,
                "codice": linea.get("codice_articolo") or f"AUTO_{prodotto_id[:8]}",
                "descrizione": descrizione[:100],
                "fornitore_principale": fornitore.get("ragione_sociale"),
                "unita_misura": linea.get("unita_misura", "pz"),
                "prezzo_acquisto": prezzo_unitario,
                "giacenza": 0,
                "categoria": detect_centro_costo(fornitore, descrizione),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db[COL_MAGAZZINO].insert_one(nuovo.copy())

        await db[COL_MAGAZZINO].update_one(
            {"id": prodotto_id},
            {"$inc": {"giacenza": quantita},
             "$set": {"ultimo_carico": data_fattura, "prezzo_acquisto": prezzo_unitario,
                      "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

        movimento = {
            "id": str(uuid.uuid4()), "tipo": "carico",
            "prodotto_id": prodotto_id, "prodotto_descrizione": descrizione[:100],
            "quantita": quantita, "prezzo_unitario": prezzo_unitario,
            "valore_totale": quantita * prezzo_unitario,
            "fattura_id": fattura_id, "fornitore_id": fornitore.get("id"),
            "fornitore_nome": fornitore.get("ragione_sociale"),
            "lotto_interno": lotto_interno, "lotto_fornitore": lotto_fornitore,
            "data_scadenza": scadenza_prodotto, "data_movimento": data_fattura,
            "note": f"Carico da fattura {numero_documento or fattura_id[:8]}",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db[COL_MOVIMENTI_MAG].insert_one(movimento.copy())
        movimenti_creati += 1

        if not scadenza_prodotto:
            try:
                data_base = datetime.strptime(data_fattura[:10], "%Y-%m-%d")
                scadenza_prodotto = (data_base + timedelta(days=30)).strftime("%Y-%m-%d")
            except (ValueError, TypeError):
                scadenza_prodotto = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

        lotto_id = str(uuid.uuid4())
        lotto = {
            "id": lotto_id, "lotto_interno": lotto_interno, "lotto_fornitore": lotto_fornitore,
            "lotto_da_inserire_manualmente": lotto_fornitore is None,
            "prodotto": descrizione[:100], "prodotto_id": prodotto_id,
            "fornitore": fornitore.get("ragione_sociale"), "fornitore_id": fornitore.get("id"),
            "fattura_id": fattura_id, "fattura_numero": numero_documento,
            "data_carico": data_fattura, "data_scadenza": scadenza_prodotto,
            "quantita_iniziale": quantita, "quantita_disponibile": quantita,
            "quantita_scaricata": 0, "unita_misura": linea.get("unita_misura", "pz"),
            "prezzo_unitario": prezzo_unitario, "valore_totale": quantita * prezzo_unitario,
            "stato": "disponibile", "esaurito": False,
            "source": "import_xml", "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db[COL_LOTTI].insert_one(lotto.copy())
        lotti_creati += 1
        lotti_dettaglio.append({
            "lotto_id": lotto_id, "lotto_interno": lotto_interno,
            "prodotto": descrizione[:50], "quantita": quantita, "scadenza": scadenza_prodotto
        })

    return {"movimenti_creati": movimenti_creati, "lotti_creati": lotti_creati, "lotti": lotti_dettaglio}


async def crea_scadenza_pagamento(
    db, fattura_id: str, fattura: Dict, fornitore: Dict
) -> Optional[str]:
    """Crea voce nello Scadenziario Fornitori dal metodo pagamento del fornitore."""
    pagamento = fattura.get("pagamento", {})
    metodo_fornitore = (fornitore.get("metodo_pagamento") or "").lower()

    if metodo_fornitore in ["contanti", "cassa", "cash"]:
        modalita = "MP01"
    elif metodo_fornitore in ["assegno", "check"]:
        modalita = "MP02"
    elif metodo_fornitore in ["rid", "addebito"]:
        modalita = "MP09"
    elif metodo_fornitore in ["riba"]:
        modalita = "MP12"
    else:
        modalita = "MP05"  # Bonifico default

    metodo_info = METODI_PAGAMENTO.get(modalita, METODI_PAGAMENTO["MP05"])

    data_scadenza_str = pagamento.get("data_scadenza")
    if not data_scadenza_str:
        try:
            data_fattura = datetime.strptime(fattura.get("data_documento")[:10], "%Y-%m-%d")
            giorni = int(pagamento.get("giorni_termini", metodo_info["giorni_default"]))
            data_scadenza_str = (data_fattura + timedelta(days=giorni)).strftime("%Y-%m-%d")
        except (ValueError, TypeError, AttributeError):
            data_scadenza_str = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

    scadenza_id = str(uuid.uuid4())
    scadenza = {
        "id": scadenza_id, "tipo": "fattura_passiva",
        "fattura_id": fattura_id, "numero_fattura": fattura.get("numero_documento"),
        "data_fattura": fattura.get("data_documento"),
        "fornitore_id": fornitore.get("id"), "fornitore_piva": fornitore.get("partita_iva"),
        "fornitore_nome": fornitore.get("ragione_sociale"),
        "importo_totale": float(fattura.get("importo_totale", 0)),
        "importo_pagato": 0, "importo_residuo": float(fattura.get("importo_totale", 0)),
        "metodo_pagamento": modalita, "metodo_descrizione": metodo_info["desc"],
        "tipo_pagamento": metodo_info["tipo"],
        "data_scadenza": data_scadenza_str, "data_pagamento": None,
        "stato": "aperto", "pagato": False, "riconciliato": False,
        "source": "import_xml", "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db[COL_SCADENZIARIO].insert_one(scadenza.copy())
    return scadenza_id


async def cerca_match_bancario(
    db, scadenza: Dict, tolleranza_giorni: int = 30,
    tolleranza_importo: float = 0.50, include_suggerimenti: bool = False
) -> Optional[Dict]:
    """Cerca match tra scadenza e movimenti bancari."""
    importo = abs(float(scadenza.get("importo_totale", 0)))
    data_scadenza = scadenza.get("data_scadenza")
    fornitore_nome = (scadenza.get("fornitore_nome") or "").strip()
    fornitore_nome_lower = fornitore_nome.lower()
    numero_fattura = scadenza.get("numero_fattura", "")

    if not data_scadenza or not importo:
        return None

    try:
        data_scad = datetime.strptime(data_scadenza[:10], "%Y-%m-%d")
        data_min = (data_scad - timedelta(days=120)).strftime("%Y-%m-%d")
        data_max = (data_scad + timedelta(days=tolleranza_giorni)).strftime("%Y-%m-%d")
    except (ValueError, TypeError):
        return None

    parole_comuni = {"srl", "spa", "snc", "sas", "di", "e", "del", "della", "gruppo", "italia"}
    parole_fornitore = [p.lower() for p in fornitore_nome.split() if len(p) >= 4 and p.lower() not in parole_comuni]
    prima_parola = parole_fornitore[0] if parole_fornitore else ""

    query_esatto = {
        "tipo": {"$in": ["uscita", "addebito"]},
        "$or": [
            {"importo": {"$gte": importo - 1.0, "$lte": importo + 1.0}},
            {"importo": {"$gte": -importo - 1.0, "$lte": -importo + 1.0}}
        ],
        "data": {"$gte": data_min, "$lte": data_max},
        "fattura_id": {"$exists": False}
    }
    movimenti_esatti = await db["estratto_conto_movimenti"].find(query_esatto, {"_id": 0}).to_list(50)

    for mov in movimenti_esatti:
        testo = f"{(mov.get('fornitore') or '')} {(mov.get('descrizione_originale') or '')}".lower()
        nome_match = prima_parola and prima_parola in testo
        if not nome_match and FUZZY_AVAILABLE and mov.get("fornitore"):
            nome_match = fuzz.partial_ratio(fornitore_nome_lower, mov["fornitore"].lower()) >= 75
        if nome_match:
            mov.update({"source_collection": "estratto_conto_movimenti", "match_type": "alta_confidenza", "match_score": 95, "confidence": "HIGH"})
            return mov

    if movimenti_esatti and importo >= 100:
        mov = movimenti_esatti[0]
        if abs(abs(float(mov.get("importo", 0))) - importo) <= 1.0:
            mov.update({"source_collection": "estratto_conto_movimenti", "match_type": "media_confidenza", "match_score": 75, "confidence": "MEDIUM"})
            return mov

    if include_suggerimenti:
        tolleranza_sugg = max(importo * 0.10, 20.0)
        query_sugg = {
            "tipo": {"$in": ["uscita", "addebito"]},
            "$or": [
                {"importo": {"$gte": importo - tolleranza_sugg, "$lte": importo + tolleranza_sugg}},
                {"importo": {"$gte": -importo - tolleranza_sugg, "$lte": -importo + tolleranza_sugg}}
            ],
            "data": {"$gte": data_min, "$lte": data_max},
            "fattura_id": {"$exists": False}
        }
        movimenti_sugg = await db["estratto_conto_movimenti"].find(query_sugg, {"_id": 0}).to_list(20)
        if movimenti_sugg:
            best = min(movimenti_sugg, key=lambda m: abs(abs(float(m.get("importo", 0))) - importo))
            best.update({"source_collection": "estratto_conto_movimenti", "match_type": "suggerimento", "match_score": 50, "confidence": "LOW"})
            return best
    return None


async def esegui_riconciliazione(
    db, scadenza_id: str, transazione_id: str,
    source_collection: str = "estratto_conto_movimenti"
) -> Dict:
    """Esegue riconciliazione tra scadenza e movimento bancario."""
    now = datetime.now(timezone.utc).isoformat()
    await db[COL_SCADENZIARIO].update_one(
        {"id": scadenza_id},
        {"$set": {"stato": "saldato", "pagato": True, "riconciliato": True,
                  "transazione_bancaria_id": transazione_id, "data_pagamento": now, "updated_at": now}}
    )
    if source_collection == "estratto_conto_movimenti":
        await db["estratto_conto_movimenti"].update_one(
            {"id": transazione_id},
            {"$set": {"fattura_id": scadenza_id, "riconciliato": True, "updated_at": now}}
        )
    else:
        await db[COL_BANK_TRANSACTIONS].update_one(
            {"id": transazione_id},
            {"$set": {"riconciliato": True, "scadenza_id": scadenza_id, "updated_at": now}}
        )
    riconciliazione = {
        "id": str(uuid.uuid4()), "scadenza_id": scadenza_id, "transazione_id": transazione_id,
        "source_collection": source_collection, "tipo": "automatica",
        "data_riconciliazione": now, "created_at": now
    }
    await db[COL_RICONCILIAZIONI].insert_one(riconciliazione.copy())
    return {"success": True, "riconciliazione_id": riconciliazione["id"]}
