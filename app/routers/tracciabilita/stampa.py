"""
Router Stampa — endpoint centralizzato per etichette lotto POS 80mm.
Unica fonte di verità per la logica di stampa (allergeni, ordinamento, HTML).
GET /api/stampa/lotto/{id_o_numero_lotto} → HTML pronto per window.print()
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import os

router = APIRouter(prefix="/stampa", tags=["Stampa"])
db = AsyncIOMotorClient(os.environ.get("MONGO_URL"))[os.environ.get("DB_NAME")]

# ── Dizionario allergeni (Reg. UE 1169/2011) ─────────────────────────────────
ALLERGENI_KW = {
    "CEREALI/GLUTINE":    ["glutine","grano","frumento","orzo","segale","avena","farro","semola","farina"],
    "UOVA":               ["uov","tuorlo","albume"],
    "LATTE":              ["latte","panna","burro","formaggio","mozzarella","ricotta","parmigiano","pecorino","mascarpone"],
    "ARACHIDI":           ["arachide"],
    "SOIA":               ["soia"],
    "PESCE":              ["pesce","alici","acciughe","tonno","salmone","baccalà"],
    "CROSTACEI":          ["gamberi","aragoste","granchi","scampi"],
    "FRUTTA A GUSCIO":    ["noci","mandorle","nocciole","pistacchio","pinoli"],
    "SEDANO":             ["sedano"],
    "SENAPE":             ["senape"],
    "SESAMO":             ["sesamo"],
    "SOLFITI":            ["solfiti","anidride solforosa"],
    "LUPINO":             ["lupino"],
    "MOLLUSCHI":          ["molluschi","cozze","vongole","polpo","calamari"],
}

POS_CSS = """
  @page { size: 80mm auto; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 8pt; font-weight: 700; line-height: 1.25;
    width: 72mm; padding: 1.5mm 2mm 4mm 2mm;
    color: #000; background: #fff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .azienda { text-align: center; font-size: 6pt; font-weight: 500; color: #666; margin-bottom: 0.5mm; }
  .titolo-sezione { text-align: center; font-size: 10pt; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 0.5mm; }
  .prodotto-nome { text-align: center; font-size: 9pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; word-break: break-word; margin-bottom: 0.5mm; }
  .lotto-box { border: 2px solid #000; text-align: center; padding: 1mm 1.5mm; font-size: 8pt; font-weight: 900; font-family: 'Courier New', monospace; letter-spacing: 0.5px; margin: 1mm 0; word-break: break-all; }
  .qty-box { text-align: center; font-size: 9pt; font-weight: 900; margin-bottom: 0.5mm; color: #000; }
  .row { display: flex; justify-content: space-between; font-size: 7.5pt; font-weight: 700; padding: 0.5mm 0; border-bottom: 1px solid #aaa; color: #000; gap: 3mm; }
  .row .label { font-weight: 900; white-space: nowrap; }
  .row .val   { font-weight: 900; text-align: right; color: #000; }
  .row.scad .val { text-decoration: underline; }
  .row.frigo .val { border: 1px solid #000; padding: 0.2mm 0.8mm; font-size: 7pt; }
  .sep-solid { border-top: 2px solid #000; margin: 1mm 0; }
  .sep-dash  { border-top: 1px dashed #000; margin: 1mm 0; }
  .ing-title { font-size: 7pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.8mm; }
  .ing { font-size: 6.5pt; font-weight: 700; padding: 0.4mm 0; border-bottom: 1px dotted #666; word-break: break-word; color: #000; }
  .ing.allergene { font-weight: 900; }
  .ing.allergene::before { content: "! "; font-weight: 900; }
  .allergeni-box { border: 2px solid #000; padding: 1.5mm; margin-top: 1mm; background: #fff; }
  .allergeni-title { font-size: 7pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.3px; text-align: center; border-bottom: 1px solid #000; padding-bottom: 1mm; margin-bottom: 1mm; color: #000; }
  .allergeni-list { font-size: 7.5pt; font-weight: 900; word-break: break-word; text-align: center; color: #000; line-height: 1.4; }
  .no-allergeni { font-size: 7pt; font-weight: 700; text-align: center; margin-top: 1mm; color: #000; }
  .trac-title { font-size: 7pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.8mm; margin-top: 1mm; }
  .trac-row { font-size: 6pt; font-weight: 700; padding: 0.8mm 0; border-bottom: 1px dotted #888; line-height: 1.3; }
  .trac-row .trac-lotto { font-family: 'Courier New', monospace; font-weight: 900; font-size: 6.5pt; }
  .trac-row .trac-fornitore { font-weight: 700; color: #333; }
  .trac-row .trac-scad { font-weight: 900; text-decoration: underline; }
  .trac-non-trovati { font-size: 5.5pt; color: #888; font-style: italic; margin-top: 0.5mm; }
  .etichetta-finale { border: 1.5px solid #000; padding: 1.5mm; margin-top: 1.5mm; font-size: 7.5pt; font-weight: 900; text-align: center; word-break: break-word; line-height: 1.4; }
  .footer { margin-top: 1.5mm; border-top: 1px solid #000; padding-top: 1mm; font-size: 6pt; font-weight: 600; text-align: center; line-height: 1.4; }
"""


def rileva_allergeni(testo: str) -> list:
    t = testo.lower()
    return [nome for nome, kws in ALLERGENI_KW.items() if any(k in t for k in kws)]


def ordina_ingredienti(ingredienti: list, allergeni: list) -> list:
    def ha_allergene(ing: str) -> bool:
        i = ing.lower()
        return (
            any(kw in i for kws in ALLERGENI_KW.values() for kw in kws)
            or ("contiene" in i and "non contiene" not in i)
        )
    return sorted(ingredienti, key=lambda x: (0 if ha_allergene(x) else 1, x))


def build_pos_html(lotto: dict, allergeni: list, ingredienti: list) -> str:
    data_ora = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M")

    # ── Righe ingredienti ──────────────────────────────────────────────────
    if ingredienti:
        righe_ing = "".join(
            f'<div class="ing{"  allergene" if ("contiene" in i.lower() and "non contiene" not in i.lower()) else ""}">• {i}</div>'
            for i in ingredienti
        )
    else:
        righe_ing = '<div class="ing">Dati non disponibili</div>'

    # ── Sezione allergeni ──────────────────────────────────────────────────
    if allergeni:
        sezione_allergeni = f"""<div class="allergeni-box">
  <div class="allergeni-title">!!! ALLERGENI (Reg. UE 1169/2011) !!!</div>
  <div class="allergeni-list">{" · ".join(allergeni)}</div>
</div>"""
    else:
        sezione_allergeni = '<div class="no-allergeni">&#10003; Non contiene allergeni dichiarati</div>'

    # ── Sezione tracciabilità ──────────────────────────────────────────────
    lotti_scalati = (lotto.get("lotti_fornitori") or {}).get("lotti_scalati") or []
    ingredienti_non_trovati = (lotto.get("lotti_fornitori") or {}).get("ingredienti_non_trovati") or []

    sezione_trac = ""
    if lotti_scalati:
        righe_scalati = []
        for ls in lotti_scalati:
            is_fat = (ls.get("lotto_id_fornitore") or "").startswith("FAT-")
            is_diz = ls.get("da_dizionario") is True
            num = (ls.get("lotto_id_fornitore") or "N/D").replace("FAT-", "")
            if is_diz:
                badge = f'<span class="trac-lotto" style="background:#e0f2fe;color:#0369a1;">MAG: {num}</span>'
            elif is_fat:
                badge = f'<span class="trac-lotto" style="background:#fef3c7;color:#92400e;">FAT: {num}</span>'
            else:
                badge = f'<span class="trac-lotto">LOT: {num}</span>'
            scad_html = f'<span class="trac-scad"> | Scad: {ls["data_scadenza"]}</span>' if ls.get("data_scadenza") else ""
            fat_data_html = (
                f'<span style="font-size:6pt;color:#92400e;"> | Data Fattura: {ls["data_fattura"]}</span>'
                if is_fat and ls.get("data_fattura") else ""
            )
            qtà_used = ls.get("quantita_consumata")
            qtà_rim = ls.get("quantita_rimasta")
            unita = ls.get("unita") or ""
            esaurito = " · ⚠ ESAURITO" if ls.get("esaurito") else ""
            qty_txt = (f"Qtà usata: {qtà_used} {unita} · " if qtà_used is not None else "")
            qty_txt += f"Rimasto in magazzino: {qtà_rim if qtà_rim is not None else '—'} {unita}{esaurito}"
            righe_scalati.append(f"""<div class="trac-row">
  {badge}{scad_html}{fat_data_html}
  <br/><span class="trac-fornitore">{ls.get("fornitore") or "—"}</span>
  <br/><span>{ls.get("prodotto") or ls.get("ingrediente") or "—"}</span>
  <br/><span style="font-size:5.5pt;font-weight:bold;">{qty_txt}</span>
</div>""")
        non_trac_html = (
            f'<div class="trac-non-trovati">Non tracciati: {", ".join(ingredienti_non_trovati)}</div>'
            if ingredienti_non_trovati else ""
        )
        sezione_trac = f"""<div class="sep-dash"></div>
<div class="trac-title">Tracciabilità Fornitori (Controllo a Ritroso · Reg. CE 178/2002)</div>
{"".join(righe_scalati)}{non_trac_html}"""
    elif lotto.get("ingredienti_dettaglio"):
        righe_ing_fb = []
        for ing in lotto.get("ingredienti_dettaglio") or []:
            nome_ing = ing if isinstance(ing, str) else (ing.get("nome") or "?")
            righe_ing_fb.append(f"""<div class="trac-row">
  <span class="trac-lotto" style="background:#f3f4f6;color:#374151;">ING</span>
  <br/><span>{nome_ing}</span>
  <br/><span style="font-size:5.5pt;color:#6b7280;">Rimanenza magazzino: verificare manualmente</span>
</div>""")
        sezione_trac = f"""<div class="sep-dash"></div>
<div class="trac-title">Ingredienti (Tracciabilità in elaborazione — Reg. CE 178/2002)</div>
{"".join(righe_ing_fb)}"""

    # ── Campi lotto ────────────────────────────────────────────────────────
    prodotto = lotto.get("prodotto") or lotto.get("prodotto_nome") or ""
    numero_lotto = lotto.get("numero_lotto") or "N/D"
    pezzi = lotto.get("pezzi") or lotto.get("quantita")
    unita = lotto.get("unita") or lotto.get("unita_misura") or "pz"
    qty_box = f'<div class="qty-box">QTA: {pezzi} {unita}</div>' if pezzi else ""
    data_prod = lotto.get("data_produzione") or "—"
    data_scad = lotto.get("data_scadenza") or "—"
    scad_abbattuto = lotto.get("scadenza_abbattuto") or ""
    frigo = lotto.get("frigo_numero") or ""
    allergie_str = " · ".join(allergeni) if allergeni else ""

    ing_section = (
        f'<div class="sep-dash"></div><div class="ing-title">INGREDIENTI + TRACCIABILITA:</div>{righe_ing}'
        if ingredienti else ""
    )

    etichetta_finale_extra = f"<br/>CONTIENE: {allergie_str}" if allergeni else ""

    return f"""<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8"/>
  <title>Lotto {numero_lotto}</title>
  <style>{POS_CSS}</style>
</head>
<body>
  <div class="azienda">Ceraldi Group S.R.L.</div>
  <div class="titolo-sezione">LOTTO</div>
  <div class="prodotto-nome">{prodotto}</div>
  <div class="lotto-box">{numero_lotto}</div>
  {qty_box}
  <div class="sep-solid"></div>
  <div class="row"><span class="label">PRODOTTO:</span><span class="val">{data_prod}</span></div>
  <div class="row scad"><span class="label">SCADENZA:</span><span class="val">{data_scad}</span></div>
  {f'<div class="row"><span class="label">SCAD -18°C:</span><span class="val">{scad_abbattuto}</span></div>' if scad_abbattuto else ""}
  {f'<div class="row frigo"><span class="label">FRIGO:</span><span class="val">{frigo}</span></div>' if frigo else ""}
  {ing_section}
  {sezione_trac}
  {sezione_allergeni}
  <div class="etichetta-finale">
    {prodotto.upper()} · {data_prod}{etichetta_finale_extra}
  </div>
  <div class="footer">
    Stampato: {data_ora}<br/>
    Reg. CE 178/2002 — Ceraldi Group S.R.L.
  </div>
  <script>window.onload = () {{ setTimeout(() => {{ window.print(); window.onafterprint = () => window.close(); }}, 250); }}</script>
</body>
</html>"""


# ── Endpoint ───────────────────────────────────────────────────────────────────
@router.get("/lotto/{lotto_id}", response_class=HTMLResponse)
async def stampa_lotto(lotto_id: str):
    """Genera HTML etichetta POS 80mm per un lotto (per id o numero_lotto)."""
    lotto = await db.lotti.find_one(
        {"$or": [{"id": lotto_id}, {"numero_lotto": lotto_id}]},
        {"_id": 0},
    )
    if not lotto:
        raise HTTPException(status_code=404, detail=f"Lotto '{lotto_id}' non trovato")

    ingredienti_raw = lotto.get("ingredienti_dettaglio") or []
    ingredienti = [
        i if isinstance(i, str) else i.get("nome", "")
        for i in ingredienti_raw
        if i
    ]
    testo_completo = " ".join(ingredienti) + " " + (lotto.get("allergeni_testo") or "")
    allergeni = rileva_allergeni(testo_completo)
    ingredienti_ordinati = ordina_ingredienti(ingredienti, allergeni)

    html = build_pos_html(lotto, allergeni, ingredienti_ordinati)
    return HTMLResponse(content=html)
