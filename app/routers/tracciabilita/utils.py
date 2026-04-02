"""
Router per utility: allergeni, calcola-scadenza, stats, scadenze-ingredienti,
importa-dati-iniziali, aggiorna-materie-da-fatture, esporta/importa ricette,
registro-lotti-asl, registro-tracciabilita, pulizia-dati.
"""
import re
import uuid
import json
import csv
import os
from datetime import datetime, timezone, timedelta
from io import BytesIO
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from fastapi.responses import HTMLResponse, Response, StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(tags=["Utils"])

# MongoDB connection
_mongo_url = os.environ.get('MONGO_URL')
_client = AsyncIOMotorClient(_mongo_url)
db = _client[os.environ.get('DB_NAME', 'test_database')]


def set_database(database):
    """Permette override del db dall'esterno (compatibilità)."""
    global db
    db = database


# ── Allergeni (inline, piccoli dict locali) ──────────────────────────────────

_ALLERGENI_KEYS = {
    "glutine": {"nome": "Cereali contenenti GLUTINE", "keywords": ["glutine", "grano", "frumento", "farina", "semola", "orzo", "segale", "avena", "farro", "malto", "pangrattato", "pasta", "brioche", "cornetto", "00"]},
    "uova": {"nome": "UOVA e derivati", "keywords": ["uova", "uovo", "tuorlo", "albume", "ovoprodotti", "maionese", "zabaione"]},
    "latte": {"nome": "LATTE e derivati (incluso lattosio)", "keywords": ["latte", "lattosio", "panna", "burro", "formaggio", "mozzarella", "ricotta", "mascarpone", "yogurt", "parmigiano", "grana", "pecorino", "caseina", "siero di latte", "crema", "besciamella"]},
    "soia": {"nome": "SOIA e derivati", "keywords": ["soia", "soja", "tofu", "miso", "lecitina di soia", "proteine di soia"]},
    "arachidi": {"nome": "ARACHIDI e derivati", "keywords": ["arachidi", "arachide", "burro di arachidi", "olio di arachidi"]},
    "frutta_guscio": {"nome": "FRUTTA A GUSCIO", "keywords": ["mandorle", "mandorla", "nocciole", "nocciola", "noci", "noce", "pistacchi", "pistacchio", "pinoli", "castagne", "gianduia", "nutella", "pasta di nocciole"]},
    "sesamo": {"nome": "SEMI DI SESAMO e derivati", "keywords": ["sesamo", "semi di sesamo", "tahina"]},
    "solfiti": {"nome": "ANIDRIDE SOLFOROSA e SOLFITI (>10mg/kg)", "keywords": ["solfiti", "anidride solforosa", "metabisolfito", "vino", "aceto"]},
    "pesce": {"nome": "PESCE e derivati", "keywords": ["pesce", "merluzzo", "salmone", "tonno", "acciuga", "alice", "sardina", "sgombro", "colatura"]},
    "crostacei": {"nome": "CROSTACEI e derivati", "keywords": ["crostacei", "gamberi", "scampi", "aragosta", "granchio"]},
    "molluschi": {"nome": "MOLLUSCHI e derivati", "keywords": ["molluschi", "cozze", "vongole", "ostriche", "calamari", "polpo"]},
    "sedano": {"nome": "SEDANO e derivati", "keywords": ["sedano", "sedano rapa"]},
    "senape": {"nome": "SENAPE e derivati", "keywords": ["senape", "mostarda"]},
    "lupini": {"nome": "LUPINI e derivati", "keywords": ["lupini", "lupino", "farina di lupini"]},
}


def _rileva_allergeni(ingredienti: list) -> dict:
    trovati = {}
    for ing in ingredienti:
        if not ing:
            continue
        ing_l = ing.lower().strip()
        for all_id, info in _ALLERGENI_KEYS.items():
            if all_id not in trovati:
                for kw in info["keywords"]:
                    if kw in ing_l:
                        trovati[all_id] = {"nome": info["nome"], "ingredienti": [ing]}
                        break
    nomi = [i["nome"] for i in trovati.values()]
    testo = ("Contiene: " + ", ".join(nomi)) if nomi else "Non contiene allergeni dichiarati"
    return {"allergeni_presenti": list(trovati.keys()), "allergeni_dettaglio": trovati, "testo_etichetta": testo, "contiene_allergeni": bool(trovati)}


@router.get("/allergeni")
async def get_allergeni_dict():
    return {"allergeni": _ALLERGENI_KEYS, "totale": len(_ALLERGENI_KEYS), "note": "14 allergeni obbligatori Reg. UE 1169/2011"}


@router.post("/rileva-allergeni")
async def api_rileva_allergeni(ingredienti: List[str]):
    return _rileva_allergeni(ingredienti)


# ── Scadenze ingredienti ──────────────────────────────────────────────────────

_SCADENZE = {
    "crema": (2, 60), "crema pasticcera": (2, 60), "panna": (2, 90), "ricotta": (3, 60),
    "uova": (3, 90), "uovo": (3, 90), "latte": (3, 90), "burro": (7, 270),
    "mozzarella": (3, 60), "farina": (90, 365), "zucchero": (365, 365), "sale": (365, 365),
    "lievito": (14, 180), "lievito madre": (7, 90), "frutta": (2, 90), "fragole": (1, 180),
    "cioccolato": (30, 365), "ganache": (5, 90), "marmellata": (30, 365), "miele": (365, 365),
    "pasta frolla": (5, 180), "pan di spagna": (5, 270), "babà": (3, 270), "sfogliatella": (2, 180),
    "cornetto": (2, 180), "brioche": (2, 180), "prosciutto": (5, 60), "salame": (14, 120),
    "wurstel": (5, 60), "parmigiano": (30, 270), "default": (20, 90)
}


def _calcola_scadenza(ingredienti: list, data_produzione: str, abbattuto: bool = False) -> tuple:
    try:
        fmt = "%d/%m/%Y" if "/" in data_produzione else "%Y-%m-%d"
        dt_prod = datetime.strptime(data_produzione, fmt)
    except (ValueError, TypeError):
        dt_prod = datetime.now()
    default = _SCADENZE.get("default", (20, 90))
    min_frigo, min_abb = default
    ing_critico = "prodotto generico"
    for ing in ingredienti:
        if not ing:
            continue
        il = ing.lower().strip()
        scad = _SCADENZE.get(il)
        if scad is None:
            for kw, s in _SCADENZE.items():
                if kw != "default" and (kw in il or il in kw):
                    scad = s
                    break
        if scad and scad[0] < min_frigo:
            min_frigo, min_abb = scad
            ing_critico = ing
    dt_frigo = dt_prod + timedelta(days=min_frigo)
    dt_abb = dt_prod + timedelta(days=min_abb)
    return (dt_frigo.strftime("%d/%m/%Y"), dt_abb.strftime("%d/%m/%Y"), ing_critico, min_frigo, min_abb, min_abb // 30)


@router.get("/scadenze-ingredienti")
async def get_scadenze_ingredienti():
    formatted = {k: {"frigo_0_4C_giorni": v[0], "abbattuto_-18C_giorni": v[1], "abbattuto_mesi": v[1]//30} for k, v in _SCADENZE.items()}
    return {"scadenze": formatted, "note": "Scadenze in giorni dalla data di produzione. Basate su normativa HACCP."}


@router.post("/calcola-scadenza")
async def calcola_scadenza(ingredienti: List[str], data_produzione: str = Query(...)):
    scad_frigo, scad_abb, ing_critico, g_frigo, g_abb, mesi_abb = _calcola_scadenza(ingredienti, data_produzione)
    return {
        "data_scadenza": scad_frigo, "data_scadenza_frigo": scad_frigo, "data_scadenza_abbattuto": scad_abb,
        "ingrediente_critico": ing_critico, "giorni_scadenza": g_frigo, "giorni_frigo": g_frigo,
        "giorni_abbattuto": g_abb, "mesi_abbattuto": mesi_abb,
        "motivazione": f"Scadenza determinata da '{ing_critico}': {g_frigo} giorni frigo, {mesi_abb} mesi abbattuto (-18°C)"
    }


# ── Stats ────────────────────────────────────────────────────────────────────

@router.get("/stats")
async def get_stats():
    materie_count  = await db.materie_prime.count_documents({})
    ricette_count  = await db.ricette.count_documents({})
    lotti_count    = await db.lotti.count_documents({})
    fatture_count  = await db.fatture.count_documents({})
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    lotti_recenti  = await db.lotti.count_documents({"created_at": {"$gte": week_ago}})
    return {
        "materie_prime":   materie_count,
        "ricette":         ricette_count,
        "lotti_totali":    lotti_count,
        "lotti_settimana": lotti_recenti,
        "fatture":         fatture_count,
    }


# ── Root ─────────────────────────────────────────────────────────────────────

@router.get("/")
async def root():
    return {"message": "API Tracciabilità Lotti", "version": "1.0.0"}


# ── Importa dati iniziali ────────────────────────────────────────────────────

@router.post("/importa-dati")
async def importa_dati_iniziali():
    """Importa dati dal file JSON (eseguire una sola volta)"""
    try:
        with open("/app/data_export.json", "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File dati non trovato")

    ricette_imported = 0
    for r in data.get("ricette", []):
        if not await db.ricette.find_one({"nome": r["nome"]}):
            await db.ricette.insert_one({
                "id": str(uuid.uuid4()),
                "nome": r["nome"],
                "ingredienti": r.get("ingredienti", []),
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            ricette_imported += 1

    materie_imported = 0
    for m in data.get("magazzino", []):
        if not await db.materie_prime.find_one({
            "materia_prima": m["materia_prima"],
            "numero_fattura": m["numero_fattura"]
        }):
            await db.materie_prime.insert_one({
                "id": str(uuid.uuid4()),
                **m,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            materie_imported += 1

    return {"message": "Importazione completata", "ricette_importate": ricette_imported, "materie_prime_importate": materie_imported}


# ── Aggiorna materie da fatture ──────────────────────────────────────────────

@router.post("/aggiorna-materie-da-fatture")
async def aggiorna_materie_da_fatture():
    """Aggiorna tutte le materie prime dalle fatture (senza limite tempo)"""
    ricette = await db.ricette.find({}, {"_id": 0}).to_list(5000)
    ingredienti_map = {}
    for ricetta in ricette:
        for ing in ricetta.get("ingredienti", []):
            ingredienti_map[ing.lower().strip()] = ing

    fatture = await db.fatture.find({}, {"_id": 0}).to_list(50000)
    aggiornamenti = 0
    dettagli = []

    for fattura in fatture:
        for prodotto in fattura.get("prodotti", []):
            desc_lower = prodotto.get("descrizione", "").lower()
            for ing_lower, ing_originale in ingredienti_map.items():
                parole_ing = ing_lower.split()
                parole_match = sum(1 for p in parole_ing if len(p) > 2 and p in desc_lower)
                if parole_match < 1:
                    continue
                data_fmt = fattura["data_fattura"]
                if "-" in data_fmt:
                    try:
                        data_fmt = datetime.strptime(data_fmt, "%Y-%m-%d").strftime("%d/%m/%Y")
                    except (ValueError, TypeError):
                        pass
                allergeni = "non contiene allergeni"
                if any(a in desc_lower for a in ["uova", "latte", "glutine", "frumento", "grano", "soia"]):
                    allergeni = "contiene allergeni"
                descrizione_completa = f"{prodotto['descrizione']}  {allergeni} - {fattura['fornitore']} n° fatt {fattura['numero_fattura']} - {data_fmt}"
                materia_esistente = await db.materie_prime.find_one(
                    {"materia_prima": {"$regex": ing_lower, "$options": "i"}}, {"_id": 0}
                )
                deve_aggiornare = True
                if materia_esistente:
                    data_esistente = materia_esistente.get("data_fattura", "")
                    try:
                        fmt_e = "%d/%m/%Y" if "/" in data_esistente else "%Y-%m-%d"
                        fmt_n = "%d/%m/%Y" if "/" in data_fmt else "%Y-%m-%d"
                        dt_e = datetime.strptime(data_esistente, fmt_e)
                        dt_n = datetime.strptime(data_fmt, fmt_n)
                        deve_aggiornare = dt_n >= dt_e
                    except (ValueError, TypeError):
                        deve_aggiornare = True
                if not deve_aggiornare:
                    continue
                result = await db.materie_prime.update_one(
                    {"materia_prima": {"$regex": ing_lower, "$options": "i"}},
                    {"$set": {
                        "azienda": fattura["fornitore"],
                        "data_fattura": data_fmt,
                        "numero_fattura": fattura["numero_fattura"],
                        "allergeni": allergeni,
                        "descrizione_completa": descrizione_completa,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                if result.modified_count > 0:
                    aggiornamenti += 1
                    dettagli.append({"ingrediente": ing_originale, "nuovo_fornitore": fattura["fornitore"]})

    return {"message": f"Aggiornate {aggiornamenti} materie prime", "aggiornamenti": aggiornamenti, "dettagli": dettagli[:20]}


# ── Esporta ricette ───────────────────────────────────────────────────────────

@router.get("/esporta-ricette/json")
async def esporta_ricette_json():
    ricette = await db.ricette.find({}, {"_id": 0}).to_list(1000)
    export_data = {
        "versione": "1.0",
        "data_export": datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M"),
        "totale_ricette": len(ricette),
        "ricette": [{"nome": r.get("nome", ""), "ingredienti": r.get("ingredienti", [])} for r in ricette]
    }
    output = BytesIO()
    output.write(json.dumps(export_data, ensure_ascii=False, indent=2).encode("utf-8"))
    output.seek(0)
    return StreamingResponse(output, media_type="application/json",
                             headers={"Content-Disposition": 'attachment; filename="ricette_export.json"'})


@router.get("/esporta-ricette/csv")
async def esporta_ricette_csv():
    ricette = await db.ricette.find({}, {"_id": 0}).to_list(1000)
    max_ingredienti = max((len(r.get("ingredienti", [])) for r in ricette), default=0)
    header = ["Nome Ricetta"] + [f"Ingrediente {i+1}" for i in range(max_ingredienti)]
    lines = [";".join(header)]
    for r in ricette:
        row = [r.get("nome", "")] + r.get("ingredienti", [])
        row.extend([""] * (max_ingredienti - len(r.get("ingredienti", []))))
        lines.append(";".join([f'"{str(v).replace(chr(34), chr(34)+chr(34))}"' for v in row]))
    output = BytesIO()
    output.write(b"\xef\xbb\xbf")
    output.write("\n".join(lines).encode("utf-8"))
    output.seek(0)
    return StreamingResponse(output, media_type="text/csv",
                             headers={"Content-Disposition": 'attachment; filename="ricette_export.csv"'})


# ── Importa ricette ───────────────────────────────────────────────────────────

@router.post("/importa-ricette")
async def importa_ricette(file: UploadFile = File(...)):
    """Importa ricette da file CSV."""
    from routers.xml_helpers import pulisci_nome_ingrediente

    content = await file.read()
    risultato = {"ricette_importate": 0, "ricette_aggiornate": 0, "errori": []}

    try:
        try:
            text_content = content.decode("utf-8-sig")
        except UnicodeDecodeError:
            text_content = content.decode("latin-1")

        delimiter = ";" if ";" in text_content[:1000] else ","
        lines = text_content.strip().split("\n")
        reader = csv.reader(lines, delimiter=delimiter)

        first_row = next(reader, None)
        if first_row:
            first_cell = (first_row[0] or "").lower().strip()
            if not any(kw in first_cell for kw in ["ricetta", "nome", "ingrediente", "prodotto"]):
                lines = [delimiter.join(first_row)] + lines[1:]
                reader = csv.reader(lines, delimiter=delimiter)

        for row in reader:
            if not row or not row[0].strip():
                continue
            nome = row[0].strip()
            ingredienti_raw = [cell.strip() for cell in row[1:] if cell.strip()]
            ingredienti = []
            for ing in ingredienti_raw:
                ing_pulito = pulisci_nome_ingrediente(ing)
                if ing_pulito and not any(i.lower() == ing_pulito.lower() for i in ingredienti):
                    ingredienti.append(ing_pulito)
            if not nome:
                risultato["errori"].append("Riga senza nome ricetta saltata")
                continue
            esistente = await db.ricette.find_one({"nome": {"$regex": f"^{re.escape(nome)}$", "$options": "i"}})
            if esistente:
                await db.ricette.update_one({"id": esistente["id"]}, {"$set": {"ingredienti": ingredienti, "updated_at": datetime.now(timezone.utc).isoformat()}})
                risultato["ricette_aggiornate"] += 1
            else:
                await db.ricette.insert_one({
                    "id": str(uuid.uuid4()),
                    "nome": nome,
                    "ingredienti": ingredienti,
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
                risultato["ricette_importate"] += 1
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Errore lettura file: {str(e)}")

    return risultato


# ── Registro lotti ASL ────────────────────────────────────────────────────────

@router.get("/registro-lotti-asl", response_class=HTMLResponse)
async def genera_registro_lotti_asl(
    data_inizio: str = Query(...),
    data_fine: str = Query(...)
):
    try:
        dt_inizio = datetime.strptime(data_inizio, "%Y-%m-%d")
        dt_fine = datetime.strptime(data_fine, "%Y-%m-%d")
        data_inizio_it = dt_inizio.strftime("%d/%m/%Y")
        data_fine_it = dt_fine.strftime("%d/%m/%Y")
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato data non valido. Usa YYYY-MM-DD")

    lotti = await db.lotti.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    lotti_filtrati = []
    for lotto in lotti:
        # Salta lotti senza prodotto valido (es. colazione acquaviva registrata in vendite_banco)
        prodotto = (lotto.get("prodotto") or lotto.get("prodotto_nome") or "").strip()
        if not prodotto or prodotto == "-":
            continue
        data_prod = lotto.get("data_produzione", "")
        try:
            fmt = "%d/%m/%Y" if "/" in data_prod else "%Y-%m-%d"
            dt_lotto = datetime.strptime(data_prod, fmt)
            if dt_inizio <= dt_lotto <= dt_fine:
                lotti_filtrati.append(lotto)
        except (ValueError, TypeError):
            continue
    lotti_filtrati.sort(key=lambda x: x.get("data_produzione", ""), reverse=True)

    rows_html = ""
    for idx, lotto in enumerate(lotti_filtrati, 1):
        ingredienti = lotto.get("ingredienti_dettaglio", [])[:5]
        ing_text = "; ".join([i.split(" - ")[0][:35] for i in ingredienti]) if ingredienti else "-"
        allergeni = lotto.get("allergeni_testo", "")
        allergeni_display = "-" if (not allergeni or "Non contiene" in allergeni) else allergeni.replace("Contiene: ", "")
        alert_class = ' class="allergeni"' if allergeni_display != "-" else ""
        prodotto_display = (lotto.get('prodotto') or lotto.get('prodotto_nome') or '-').strip() or '-'
        rows_html += f"""<tr>
            <td class="center">{idx}</td>
            <td class="center">{lotto.get('data_produzione','-')}</td>
            <td><strong>{prodotto_display}</strong></td>
            <td class="mono center">{lotto.get('numero_lotto','-')}</td>
            <td class="center">{lotto.get('quantita',1)} {lotto.get('unita_misura','pz')}</td>
            <td class="center">{lotto.get('data_scadenza','-')}</td>
            <td class="center">{lotto.get('scadenza_abbattuto','-') if lotto.get('scadenza_abbattuto') else '-'}</td>
            <td class="small">{ing_text}</td>
            <td{alert_class}>{allergeni_display}</td>
        </tr>"""

    total = len(lotti_filtrati)
    now_str = datetime.now().strftime("%d/%m/%Y %H:%M")

    return HTMLResponse(content=f"""<!DOCTYPE html><html lang="it"><head>
<meta charset="UTF-8"><title>Registro Lotti ASL - {data_inizio_it} / {data_fine_it}</title>
<style>
@page {{ size: A4 landscape; margin: 12mm 10mm; }}
*{{ margin:0;padding:0;box-sizing:border-box; }}
body {{ font-family: Arial,sans-serif; font-size:9px; color:#1a1a2e; }}
.print-bar {{ display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#1a1a2e;margin-bottom:14px;border-radius:8px; }}
.print-bar h2 {{ color:#fff;font-size:14px; }}
.btn-print {{ background:#f59e0b;color:#fff;border:none;padding:8px 20px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer; }}
@media print {{ .print-bar {{ display:none; }} }}
.doc-header {{ border-bottom:3px solid #1a1a2e;padding-bottom:10px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:flex-end; }}
.doc-title h1 {{ font-size:16px;font-weight:700;text-transform:uppercase; }}
.doc-meta {{ text-align:right;font-size:9px;color:#444;line-height:1.7; }}
.summary-bar {{ display:flex;gap:12px;margin-bottom:12px; }}
.summary-box {{ flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 12px; }}
.summary-box .val {{ font-size:18px;font-weight:700;color:#1a1a2e; }}
.summary-box .lbl {{ font-size:8px;color:#666; }}
table {{ width:100%;border-collapse:collapse;font-size:8.5px; }}
thead {{ background:#1a1a2e;color:#fff; }}
thead th {{ padding:6px 5px;text-align:left;font-weight:600;font-size:8px;text-transform:uppercase; }}
tbody tr {{ border-bottom:1px solid #e8eaf0; }}
tbody tr:nth-child(even) {{ background:#f9fafb; }}
td {{ padding:5px;vertical-align:top; }}
td.center {{ text-align:center; }}
td.mono {{ font-family:monospace;font-weight:700;background:#f1f5f9;border-radius:3px;font-size:9px; }}
td.small {{ font-size:7.5px;color:#555; }}
td.allergeni {{ color:#dc2626;font-weight:600;font-size:8px; }}
.footer {{ margin-top:20px;padding-top:12px;border-top:2px solid #1a1a2e;display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;font-size:8.5px; }}
.firma-line {{ border-bottom:1px solid #333;height:30px;margin-top:6px; }}
</style></head><body>
<div class="print-bar"><h2>Registro Lotti ASL — {data_inizio_it} / {data_fine_it}</h2>
<button class="btn-print" onclick="window.print()">Stampa / Salva PDF</button></div>
<div class="doc-header">
<div class="doc-title"><h1>Registro Tracciabilità Lotti di Produzione</h1>
<p style="font-size:9px;margin-top:3px">Ai sensi del Reg. CE 178/2002 e Reg. CE 852/2004</p></div>
<div class="doc-meta">
<div><strong>Azienda:</strong> Ceraldi Group S.R.L.</div>
<div><strong>Indirizzo:</strong> Piazza Carità 14, 80134 Napoli (NA)</div>
<div><strong>Periodo:</strong> {data_inizio_it} — {data_fine_it}</div>
<div><strong>Stampa:</strong> {now_str}</div></div></div>
<div class="summary-bar">
<div class="summary-box"><div class="val">{total}</div><div class="lbl">Lotti nel periodo</div></div>
<div class="summary-box"><div class="val">{len(set(item.get('prodotto','') for item in lotti_filtrati))}</div><div class="lbl">Prodotti distinti</div></div>
<div class="summary-box"><div class="val">{len([item for item in lotti_filtrati if item.get('allergeni_testo') and 'Non contiene' not in item.get('allergeni_testo','')])}</div><div class="lbl">Con allergeni</div></div>
<div class="summary-box"><div class="val">{(dt_fine-dt_inizio).days+1}</div><div class="lbl">Giorni coperti</div></div></div>
<table><thead><tr>
<th style="width:3%">N°</th><th style="width:8%">Data Prod.</th><th style="width:14%">Prodotto</th>
<th style="width:14%">Codice Lotto</th><th style="width:6%">Quantità</th><th style="width:8%">Scad. Frigo</th>
<th style="width:8%">Scad. Abbatt.</th><th style="width:24%">Ingredienti</th><th style="width:15%">Allergeni</th>
</tr></thead><tbody>{'<tr><td colspan="9" style="text-align:center;padding:30px;color:#999">Nessun lotto nel periodo selezionato</td></tr>' if total==0 else rows_html}</tbody></table>
<div class="footer">
<div><strong>Firma Responsabile Produzione</strong><div class="firma-line"></div><p style="margin-top:4px;font-size:8px">Nome e Cognome: ______________________</p></div>
<div><strong>Firma Responsabile HACCP</strong><div class="firma-line"></div><p style="margin-top:4px;font-size:8px">Nome e Cognome: ______________________</p></div>
<div><strong>Firma Ispettore ASL</strong><div class="firma-line"></div><p style="margin-top:4px;font-size:8px">Data ispezione: ______________________</p></div>
</div>
<p style="font-size:7.5px;color:#666;margin-top:12px">Conservare il presente registro per almeno 5 anni.</p>
</body></html>""")


# ── Registro tracciabilità ────────────────────────────────────────────────────

@router.get("/registro-tracciabilita", response_class=HTMLResponse)
async def get_registro_tracciabilita():
    """Genera il registro di tracciabilità fatture-ricette (Reg. CE 178/2002)"""
    fornitori_esclusi_docs = await db.fornitori.find({"escluso": True}, {"nome": 1}).to_list(1000)
    nomi_esclusi = {f["nome"].lower().strip() for f in fornitori_esclusi_docs}
    fatture = await db.fatture.find({}, {"_id": 0}).sort("data_fattura", -1).to_list(50000)
    fatture = [f for f in fatture if f.get("fornitore", "").lower().strip() not in nomi_esclusi]
    ricette = await db.ricette.find({}, {"_id": 0}).to_list(5000)

    ingrediente_ricette = {}
    for ricetta in ricette:
        for ing in ricetta.get("ingredienti", []):
            for parola in [p for p in ing.lower().split() if len(p) > 3]:
                ingrediente_ricette.setdefault(parola, set()).add(ricetta.get("nome", ""))

    registro = []
    prodotti_utilizzati = set()
    for fattura in fatture:
        fornitore = fattura.get("fornitore", "N/A")
        data_fattura = fattura.get("data_fattura", "N/A")
        numero_fattura = fattura.get("numero_fattura", "N/A")
        for prodotto in fattura.get("prodotti", []):
            desc = prodotto.get("descrizione", "")
            ricette_correlate = set()
            for parola in [p for p in desc.lower().split() if len(p) > 3]:
                for chiave, ricette_set in ingrediente_ricette.items():
                    if parola in chiave or chiave in parola:
                        ricette_correlate.update(ricette_set)
            if ricette_correlate:
                prodotti_utilizzati.add(desc)
                registro.append({
                    "fornitore": fornitore, "data_fattura": data_fattura,
                    "numero_fattura": numero_fattura, "prodotto": desc,
                    "quantita": prodotto.get("quantita", ""),
                    "ricette": list(ricette_correlate)[:10]
                })

    righe = ""
    for item in registro[:500]:
        ricette_html = "".join([f'<span style="background:#e3f2fd;padding:2px 8px;border-radius:10px;font-size:8pt;white-space:nowrap">{r}</span>' for r in item["ricette"]])
        righe += f"""<tr>
            <td>{item['data_fattura']}</td><td>{item['fornitore']}</td>
            <td>{item['numero_fattura'][:20]}...</td><td>{item['prodotto'][:50]}...</td>
            <td>{item['quantita']}</td><td style="display:flex;flex-wrap:wrap;gap:4px">{ricette_html}</td>
        </tr>"""

    return HTMLResponse(content=f"""<!DOCTYPE html><html lang="it"><head>
<meta charset="UTF-8"><title>Registro Tracciabilità</title>
<style>@page{{size:A4 landscape;margin:10mm}}@media print{{.no-print{{display:none}}}}
body{{font-family:Arial,sans-serif;font-size:10pt;color:#333}}
.header{{text-align:center;border-bottom:3px solid #2e7d32;padding-bottom:15px;margin-bottom:20px}}
.header h1{{color:#2e7d32;margin:0;font-size:18pt}}
.stats{{display:flex;justify-content:space-around;margin:20px 0;padding:15px;background:#e8f5e9;border-radius:8px}}
.stat{{text-align:center}}.stat-value{{font-size:24pt;font-weight:bold;color:#2e7d32}}
table{{width:100%;border-collapse:collapse;margin:15px 0}}
th,td{{border:1px solid #ddd;padding:8px;text-align:left;font-size:9pt}}
th{{background:#2e7d32;color:white}}
.btn-print{{padding:12px 30px;font-size:14pt;background:#2e7d32;color:white;border:none;border-radius:5px;cursor:pointer;margin:5px}}
.footer{{margin-top:30px;text-align:center;font-size:9pt;color:#999;border-top:1px solid #ddd;padding-top:15px}}
</style></head><body>
<div class="header"><h1>REGISTRO TRACCIABILITÀ FATTURE - RICETTE</h1>
<p><strong>Ceraldi Group S.R.L.</strong> - Piazza Carità 14, 80134 Napoli (NA)</p>
<p>Generato il: {datetime.now().strftime('%d/%m/%Y alle %H:%M')}</p></div>
<div class="stats">
<div class="stat"><div class="stat-value">{len(fatture)}</div><div>FATTURE TOTALI</div></div>
<div class="stat"><div class="stat-value">{len(prodotti_utilizzati)}</div><div>PRODOTTI UTILIZZATI</div></div>
<div class="stat"><div class="stat-value">{len(ricette)}</div><div>RICETTE TOTALI</div></div>
<div class="stat"><div class="stat-value">{len(registro)}</div><div>COLLEGAMENTI</div></div></div>
<div class="no-print" style="text-align:center;margin:20px 0">
<button onclick="window.print()" class="btn-print">Stampa PDF</button>
<a href="/api/registro-tracciabilita/csv" class="btn-print" style="text-decoration:none">Scarica CSV</a></div>
<h2>Dettaglio Prodotti e Ricette Correlate</h2>
<table><tr><th>Data Fattura</th><th>Fornitore</th><th>N° Fattura</th><th>Prodotto</th><th>Qtà</th><th>Ricette</th></tr>
{righe}</table>
<div class="footer"><p>Conforme a Reg. CE 178/2002 - Rintracciabilità degli alimenti</p></div>
</body></html>""")


@router.get("/registro-tracciabilita/csv")
async def get_registro_tracciabilita_csv():
    fornitori_esclusi_docs = await db.fornitori.find({"escluso": True}, {"nome": 1}).to_list(1000)
    nomi_esclusi = {f["nome"].lower().strip() for f in fornitori_esclusi_docs}
    fatture = await db.fatture.find({}, {"_id": 0}).sort("data_fattura", -1).to_list(50000)
    fatture = [f for f in fatture if f.get("fornitore", "").lower().strip() not in nomi_esclusi]
    ricette = await db.ricette.find({}, {"_id": 0}).to_list(5000)

    ingrediente_ricette = {}
    for ricetta in ricette:
        for ing in ricetta.get("ingredienti", []):
            for parola in [p for p in ing.lower().split() if len(p) > 3]:
                ingrediente_ricette.setdefault(parola, set()).add(ricetta.get("nome", ""))

    lines = ["Data Fattura;Fornitore;N° Fattura;Prodotto;Quantità;Prezzo;Ricette Correlate"]
    for fattura in fatture:
        for prodotto in fattura.get("prodotti", []):
            desc = prodotto.get("descrizione", "").replace(";", ",")
            ricette_correlate = set()
            for parola in [p for p in desc.lower().split() if len(p) > 3]:
                for chiave, rs in ingrediente_ricette.items():
                    if parola in chiave or chiave in parola:
                        ricette_correlate.update(rs)
            ricette_str = ", ".join(list(ricette_correlate)[:10]).replace(";", ",")
            fornitore = fattura.get("fornitore", "").replace(";", ",")
            numero = fattura.get("numero_fattura", "").replace(";", ",")
            lines.append(f'"{fattura.get("data_fattura","")}";"{fornitore}";"{numero}";"{desc}";"{prodotto.get("quantita","")}";"{prodotto.get("prezzo_unitario","")}";"{ricette_str}"')

    filename = f"registro_tracciabilita_{datetime.now().strftime('%Y%m%d')}.csv"
    return Response(
        content="\n".join(lines).encode("utf-8-sig"),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/registro-tracciabilita/json")
async def get_registro_tracciabilita_json():
    fornitori_esclusi_docs = await db.fornitori.find({"escluso": True}, {"nome": 1}).to_list(1000)
    nomi_esclusi = {f["nome"].lower().strip() for f in fornitori_esclusi_docs}
    fatture = await db.fatture.find({}, {"_id": 0}).sort("data_fattura", -1).to_list(50000)
    fatture = [f for f in fatture if f.get("fornitore", "").lower().strip() not in nomi_esclusi]
    ricette = await db.ricette.find({}, {"_id": 0}).to_list(5000)

    ingrediente_ricette = {}
    for ricetta in ricette:
        for ing in ricetta.get("ingredienti", []):
            for parola in [p for p in ing.lower().split() if len(p) > 3]:
                if ricetta.get("nome", "") not in ingrediente_ricette.setdefault(parola, []):
                    ingrediente_ricette[parola].append(ricetta.get("nome", ""))

    registro = []
    for fattura in fatture:
        entry = {"fornitore": fattura.get("fornitore", ""), "data_fattura": fattura.get("data_fattura", ""),
                 "numero_fattura": fattura.get("numero_fattura", ""), "prodotti": []}
        for prodotto in fattura.get("prodotti", []):
            desc = prodotto.get("descrizione", "")
            ricette_correlate = set()
            for parola in [p for p in desc.lower().split() if len(p) > 3]:
                for chiave, rl in ingrediente_ricette.items():
                    if parola in chiave or chiave in parola:
                        ricette_correlate.update(rl)
            entry["prodotti"].append({"descrizione": desc, "quantita": prodotto.get("quantita", ""),
                                       "ricette_correlate": list(ricette_correlate)[:10]})
        registro.append(entry)

    return {"azienda": "Ceraldi Group S.R.L.", "generato_il": datetime.now().isoformat(),
            "totale_fatture": len(fatture), "registro": registro}


# ── Pulizia dati ──────────────────────────────────────────────────────────────

@router.post("/pulizia-dati-spazzatura")
async def pulizia_dati_spazzatura():
    """Rimuove dati di test/spazzatura dal database."""
    deleted = {}
    for coll_name in ["lotti", "materie_prime"]:
        coll = db[coll_name]
        result = await coll.delete_many({
            "$or": [
                {"prodotto": {"$regex": "test", "$options": "i"}},
                {"materia_prima": {"$regex": "test", "$options": "i"}},
                {"nome": {"$regex": "test", "$options": "i"}}
            ]
        })
        deleted[coll_name] = result.deleted_count
    return {"message": "Pulizia completata", "eliminati": deleted}
