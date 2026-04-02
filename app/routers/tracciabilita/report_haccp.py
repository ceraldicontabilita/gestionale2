"""
Router per Report HACCP Mensile in PDF/HTML
Genera un report consolidato di tutte le attività HACCP per un mese selezionato.
"""
import os
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse
from datetime import datetime, timezone
from db import database as db

ROOT_DIR = Path(__file__).parent.parent

router = APIRouter(prefix="/report-haccp", tags=["Report HACCP"])

MESI_IT = ["", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
           "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"]


def fmt_data(d: str) -> str:
    if not d:
        return "-"
    try:
        if "T" in d:
            return datetime.fromisoformat(d.replace("Z","")).strftime("%d/%m/%Y")
        if "-" in d and len(d) >= 10:
            parts = d[:10].split("-")
            if len(parts) == 3:
                return f"{parts[2]}/{parts[1]}/{parts[0]}"
        return d
    except Exception:
        return d


@router.get("/mensile", response_class=HTMLResponse)
async def report_haccp_mensile(
    anno: int = Query(..., description="Anno del report"),
    mese: int = Query(..., ge=1, le=12, description="Mese del report (1-12)")
):
    """
    Genera un report HTML/PDF completo di tutte le attività HACCP per il mese specificato.
    Include: Temperature, Sanificazioni, Disinfestazioni, Anomalie, Non Conformità, Lotti.
    """
    nome_mese = MESI_IT[mese]
    
    # Query per range mese
    # Temperature Positive — struttura: rec["anno"]=int, rec["frigorifero_nome"]=str,
    # rec["temperature"][str(mese)][str(giorno)] = dict {"mattina": val, "sera": val} o float
    temp_pos = await db.temperature_positive.find({"anno": anno}, {"_id": 0}).to_list(None)
    temp_pos_per_app = []   # [{nome, giorni: {day_str: {"mattina": val, "sera": val}}}]
    temp_pos_mese = []      # backward compat per stats
    for rec in temp_pos:
        if rec.get("anno") != anno:
            continue
        nome_app = rec.get("frigorifero_nome") or f"Frigorifero N°{rec.get('frigorifero_numero','?')}"
        temperature = rec.get("temperature", {})
        giorni_mese = temperature.get(str(mese), {})
        temp_min = rec.get("temp_min", 0)
        temp_max = rec.get("temp_max", 8)
        app_giorni = {}
        for giorno, valore in giorni_mese.items():
            if isinstance(valore, dict):
                mat = valore.get("mattina", "")
                sera = valore.get("sera", "")
            else:
                mat = valore
                sera = ""
            app_giorni[giorno] = {"mattina": mat, "sera": sera}
            conforme = (temp_min <= float(mat) <= temp_max) if isinstance(mat, (int, float)) else True
            temp_pos_mese.append({
                "apparecchio": nome_app, "giorno": giorno,
                "mattina": f"{mat}°" if isinstance(mat, (int, float)) else str(mat),
                "sera": "-", "conformita": "Sì" if conforme else "No"
            })
        if app_giorni:
            temp_pos_per_app.append({"nome": nome_app, "giorni": app_giorni, "min_ok": temp_min, "max_ok": temp_max})

    # Temperature Negative
    temp_neg = await db.temperature_negative.find({"anno": anno}, {"_id": 0}).to_list(None)
    temp_neg_per_app = []
    temp_neg_mese = []
    for rec in temp_neg:
        if rec.get("anno") != anno:
            continue
        nome_app = rec.get("congelatore_nome") or rec.get("frigorifero_nome") or f"Congelatore N°{rec.get('congelatore_numero', rec.get('frigorifero_numero','?'))}"
        temperature = rec.get("temperature", {})
        giorni_mese = temperature.get(str(mese), {})
        temp_min = rec.get("temp_min", -25)
        temp_max = rec.get("temp_max", -15)
        app_giorni = {}
        for giorno, valore in giorni_mese.items():
            if isinstance(valore, dict):
                mat = valore.get("mattina", "")
                sera = valore.get("sera", "")
            else:
                mat = valore
                sera = ""
            app_giorni[giorno] = {"mattina": mat, "sera": sera}
            conforme = (temp_min <= float(mat) <= temp_max) if isinstance(mat, (int, float)) else True
            temp_neg_mese.append({
                "apparecchio": nome_app, "giorno": giorno,
                "mattina": f"{mat}°" if isinstance(mat, (int, float)) else str(mat),
                "sera": "-", "conformita": "Sì" if conforme else "No"
            })
        if app_giorni:
            temp_neg_per_app.append({"nome": nome_app, "giorni": app_giorni, "min_ok": temp_min, "max_ok": temp_max})

    # Sanificazioni — struttura flat: rec["data"]="YYYY-MM-DD", rec["area"], rec["eseguita"], rec["prodotto_utilizzato"], rec["operatore"]
    san_records = await db.sanificazione.find({}, {"_id": 0}).to_list(None)
    san_mese = []
    for rec in san_records:
        data_str = rec.get("data", "")
        try:
            if data_str and "-" in str(data_str)[:10]:
                dt = datetime.fromisoformat(str(data_str)[:10])
                if dt.year == anno and dt.month == mese:
                    san_mese.append({
                        "apparecchio": rec.get("area", "-"),
                        "giorno": str(dt.day),
                        "prodotto": rec.get("prodotto_utilizzato", rec.get("prodotto_usato", "-")),
                        "operatore": rec.get("operatore", "-"),
                        "conforme": rec.get("conforme", rec.get("eseguita", True))
                    })
        except Exception:
            pass

    # (disinfestazione gestita nel modulo dedicato)

    # Anomalie
    anomalie_records = await db.anomalie.find({}, {"_id": 0}).to_list(None)
    anomalie_mese = []
    for a in anomalie_records:
        data = a.get("data_rilevazione", a.get("data", ""))
        try:
            if "-" in data:
                dt = datetime.fromisoformat(data[:10])
                if dt.year == anno and dt.month == mese:
                    anomalie_mese.append(a)
            elif "/" in data:
                parts = data.split("/")
                if len(parts) == 3 and int(parts[1]) == mese and int(parts[2][-4:]) == anno:
                    anomalie_mese.append(a)
        except Exception:
            pass

    # Lotti produzione nel mese
    lotti_records = await db.lotti.find({}, {"_id": 0}).to_list(None)
    lotti_mese = []
    for lotto in lotti_records:
        data = lotto.get("data_produzione", lotto.get("data", ""))
        try:
            if data and "-" in str(data)[:10]:
                dt = datetime.fromisoformat(str(data)[:10])
                if dt.year == anno and dt.month == mese:
                    lotti_mese.append(lotto)
        except Exception:
            pass

    # ===================== GENERA HTML =====================
    css = """
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; background: white; padding: 20px; }
        .header { text-align: center; border-bottom: 3px solid #2c5282; padding-bottom: 16px; margin-bottom: 20px; }
        .header h1 { font-size: 20px; color: #2c5282; }
        .header .subtitle { font-size: 13px; color: #555; margin-top: 4px; }
        .meta { display: flex; justify-content: space-between; font-size: 10px; color: #888; margin-bottom: 20px; }
        .section { margin-bottom: 24px; page-break-inside: avoid; }
        .section-title { background: #2c5282; color: white; padding: 6px 12px; font-size: 12px; font-weight: bold; border-radius: 4px 4px 0 0; display: flex; justify-content: space-between; align-items: center; }
        .section-title .count { background: rgba(255,255,255,0.3); padding: 2px 8px; border-radius: 10px; font-size: 10px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #ebf4ff; padding: 6px 8px; text-align: left; font-size: 10px; color: #2c5282; border-bottom: 1px solid #bee3f8; }
        td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; font-size: 10px; }
        tr:nth-child(even) td { background: #f7fafc; }
        .badge-ok { background: #c6f6d5; color: #276749; padding: 1px 6px; border-radius: 8px; font-size: 9px; }
        .badge-ko { background: #fed7d7; color: #9b2c2c; padding: 1px 6px; border-radius: 8px; font-size: 9px; }
        .badge-warn { background: #fefcbf; color: #744210; padding: 1px 6px; border-radius: 8px; font-size: 9px; }
        .empty-msg { padding: 10px 12px; color: #888; font-style: italic; background: #f9f9f9; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 20px; }
        .stat-card { background: #ebf4ff; border: 1px solid #bee3f8; border-radius: 6px; padding: 10px; text-align: center; }
        .stat-card .val { font-size: 22px; font-weight: bold; color: #2c5282; }
        .stat-card .lbl { font-size: 10px; color: #4a5568; margin-top: 2px; }
        .firma { margin-top: 40px; display: flex; justify-content: space-between; }
        .firma-box { border-top: 1px solid #aaa; width: 200px; text-align: center; padding-top: 4px; font-size: 10px; color: #555; }
        .print-btn { position: fixed; bottom: 24px; right: 24px; background: #2c5282; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 100; }
        @media print { .print-btn { display: none; } body { padding: 0; } }
    </style>
    """

    def table_temp_calendario(dati_per_app, mese, anno, default_min, default_max):
        """Tabella calendario: righe = apparecchio, colonne = giorni del mese."""
        import calendar as cal_mod
        n_giorni = cal_mod.monthrange(anno, mese)[1]
        if not dati_per_app:
            return '<div class="empty-msg">Nessun dato registrato per questo mese.</div>'
        day_style = "width:24px;min-width:22px;text-align:center;border:1px solid #e2e8f0;padding:2px 1px;font-size:9px"
        hdr = '<th style="min-width:130px;padding:4px 8px">Apparecchio</th>' + "".join(
            f'<th style="{day_style};background:#ebf4ff;color:#2c5282;font-weight:bold">{d}</th>'
            for d in range(1, n_giorni + 1)
        )
        rows_html = ""
        for app in dati_per_app:
            min_ok = app.get("min_ok", default_min)
            max_ok = app.get("max_ok", default_max)
            nome = app["nome"]
            giorni = app["giorni"]
            cells = f'<td style="padding:4px 8px;font-weight:bold;border:1px solid #e2e8f0;font-size:10px">{nome}</td>'
            for d in range(1, n_giorni + 1):
                gd = giorni.get(str(d), {})
                mat = gd.get("mattina", "") if isinstance(gd, dict) else gd
                if mat != "" and mat is not None:
                    try:
                        fval = float(mat)
                        ok = min_ok <= fval <= max_ok
                        bg = "#c6f6d5" if ok else "#fed7d7"
                        tc = "#276749" if ok else "#9b2c2c"
                        cells += f'<td style="{day_style};background:{bg};color:{tc};font-weight:bold">{fval:.1f}</td>'
                    except Exception:
                        cells += f'<td style="{day_style}">{mat}</td>'
                else:
                    cells += f'<td style="{day_style};background:#f8fafc;color:#cbd5e1">—</td>'
            rows_html += f"<tr>{cells}</tr>"
        return f'<div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%"><thead><tr>{hdr}</tr></thead><tbody>{rows_html}</tbody></table></div>'

    def table_temp(rows, tipo):
        if not rows:
            return '<div class="empty-msg">Nessun dato registrato per questo mese.</div>'
        html = '<table><thead><tr><th>Apparecchio</th><th>Giorno</th><th>Mattina (°C)</th><th>Sera (°C)</th><th>Conformità</th></tr></thead><tbody>'
        rows_sorted = sorted(rows, key=lambda x: (x['apparecchio'], int(x['giorno']) if x['giorno'].isdigit() else 0))
        for r in rows_sorted:
            conf = r.get('conformita', 'SI')
            badge = 'badge-ok' if str(conf).upper() in ('SI', 'SÌ', 'YES', 'TRUE', '1') else 'badge-ko'
            html += f"<tr><td>{r['apparecchio']}</td><td>{r['giorno']}</td><td>{r['mattina']}</td><td>{r['sera']}</td><td><span class='{badge}'>{conf}</span></td></tr>"
        html += '</tbody></table>'
        return html

    def table_san(rows):
        if not rows:
            return '<div class="empty-msg">Nessun dato registrato per questo mese.</div>'
        html = '<table><thead><tr><th>Apparecchio/Area</th><th>Giorno</th><th>Prodotto Usato</th><th>Operatore</th><th>Conforme</th></tr></thead><tbody>'
        rows_sorted = sorted(rows, key=lambda x: (x['apparecchio'], int(x['giorno']) if x['giorno'].isdigit() else 0))
        for r in rows_sorted:
            badge = 'badge-ok' if r.get('conforme', True) else 'badge-ko'
            label = 'SI' if r.get('conforme', True) else 'NO'
            html += f"<tr><td>{r['apparecchio']}</td><td>{r['giorno']}</td><td>{r['prodotto']}</td><td>{r['operatore']}</td><td><span class='{badge}'>{label}</span></td></tr>"
        html += '</tbody></table>'
        return html

    def table_anomalie(rows):
        if not rows:
            return '<div class="empty-msg">Nessuna anomalia registrata.</div>'
        html = '<table><thead><tr><th>Data</th><th>Tipo</th><th>Descrizione</th><th>Stato</th><th>Azione</th></tr></thead><tbody>'
        for a in rows:
            data = fmt_data(a.get("data_rilevazione", a.get("data", "")))
            stato = a.get("stato", "-")
            badge = 'badge-ok' if stato.lower() in ('chiusa', 'risolta') else 'badge-warn'
            html += f"<tr><td>{data}</td><td>{a.get('tipo','-')}</td><td>{a.get('descrizione','-')[:80]}</td><td><span class='{badge}'>{stato}</span></td><td>{a.get('azione_correttiva','-')[:60]}</td></tr>"
        html += '</tbody></table>'
        return html

    def table_lotti(rows):
        if not rows:
            return '<div class="empty-msg">Nessuna produzione registrata.</div>'
        html = '<table><thead><tr><th>Lotto</th><th>Ricetta</th><th>Pezzi</th><th>Data Prod.</th><th>Scadenza</th><th>Costo (€)</th></tr></thead><tbody>'
        for lotto in sorted(rows, key=lambda x: x.get("data_produzione","") or x.get("data","")):
            html += f"""<tr>
                <td><b>{lotto.get('numero_lotto', lotto.get('id','')[:8])}</b></td>
                <td>{lotto.get('ricetta_nome', lotto.get('nome','-'))}</td>
                <td>{lotto.get('pezzi_prodotti', lotto.get('quantita','-'))}</td>
                <td>{fmt_data(lotto.get('data_produzione', lotto.get('data','')))}</td>
                <td>{lotto.get('data_scadenza', lotto.get('scadenza','-'))}</td>
                <td>{float(lotto.get('costo_totale',0) or 0):.2f}</td>
            </tr>"""
        html += '</tbody></table>'
        return html

    now_str = datetime.now().strftime("%d/%m/%Y %H:%M")
    n_conf_pos = sum(1 for r in temp_pos_mese if str(r.get('conformita','')).upper() in ('SI','SÌ','YES'))
    n_conf_neg = sum(1 for r in temp_neg_mese if str(r.get('conformita','')).upper() in ('SI','SÌ','YES'))

    html = f"""<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<title>Report HACCP - {nome_mese} {anno}</title>
{css}
</head>
<body>

<button class="print-btn" onclick="window.print()">Stampa / Salva PDF</button>

<div class="header">
    <h1>REGISTRO HACCP MENSILE</h1>
    <div class="subtitle">Ceraldi Group S.R.L. &mdash; Piazza Carità 14, 80134 Napoli</div>
    <div class="subtitle" style="font-size:15px; font-weight:bold; margin-top:8px">{nome_mese} {anno}</div>
</div>

<div class="meta">
    <span>Generato il: {now_str}</span>
    <span>Documento riservato ad uso interno</span>
</div>

<!-- RIEPILOGO STATISTICO -->
<div class="stats-grid">
    <div class="stat-card">
        <div class="val">{len(temp_pos_mese) + len(temp_neg_mese)}</div>
        <div class="lbl">Rilevazioni Temp.</div>
    </div>
    <div class="stat-card">
        <div class="val">{len(san_mese)}</div>
        <div class="lbl">Sanificazioni</div>
    </div>
    <div class="stat-card">
        <div class="val">{len(anomalie_mese)}</div>
        <div class="lbl">Anomalie</div>
    </div>
    <div class="stat-card">
        <div class="val">{len(lotti_mese)}</div>
        <div class="lbl">Lotti Prodotti</div>
    </div>
</div>

<!-- TEMPERATURE POSITIVE -->
<div class="section">
    <div class="section-title">
        Monitoraggio Temperature Positive (Refrigerazione)
        <span class="count">{len(temp_pos_mese)} rilevazioni | {n_conf_pos} conformi</span>
    </div>
    <div style="font-size:10px;color:#555;padding:4px 12px;background:#f7fafc;border-left:3px solid #3182ce;margin-bottom:4px">
        Range accettabile: 0°C ÷ +8°C — celle rosse = fuori range
    </div>
    {table_temp_calendario(temp_pos_per_app, mese, anno, 0, 8)}
</div>

<!-- TEMPERATURE NEGATIVE -->
<div class="section">
    <div class="section-title">
        Monitoraggio Temperature Negative (Congelamento)
        <span class="count">{len(temp_neg_mese)} rilevazioni | {n_conf_neg} conformi</span>
    </div>
    <div style="font-size:10px;color:#555;padding:4px 12px;background:#f7fafc;border-left:3px solid #e53e3e;margin-bottom:4px">
        Range accettabile: -25°C ÷ -15°C — celle rosse = fuori range
    </div>
    {table_temp_calendario(temp_neg_per_app, mese, anno, -25, -15)}
</div>

<!-- SANIFICAZIONI -->
<div class="section">
    <div class="section-title">
        Piano di Sanificazione
        <span class="count">{len(san_mese)} interventi</span>
    </div>
    {table_san(san_mese)}
</div>

<!-- ANOMALIE -->
<div class="section">
    <div class="section-title">
        Anomalie e Non Conformità
        <span class="count">{len(anomalie_mese)} registrate</span>
    </div>
    {table_anomalie(anomalie_mese)}
</div>

<!-- LOTTI PRODUZIONE -->
<div class="section">
    <div class="section-title">
        Lotti di Produzione
        <span class="count">{len(lotti_mese)} lotti</span>
    </div>
    {table_lotti(lotti_mese)}
</div>

<!-- FIRME -->
<div class="firma">
    <div class="firma-box">Responsabile HACCP</div>
    <div class="firma-box">Titolare / Direttore</div>
</div>

</body>
</html>"""

    return HTMLResponse(content=html)


@router.get("/ingredienti-non-mappati")
async def ingredienti_non_mappati():
    """
    Analizza tutte le ricette e ritorna gli ingredienti senza corrispondenza nel dizionario prodotti.
    Utile per identificare cosa aggiungere o correggere.
    """
    import sys
    sys.path.insert(0, str(ROOT_DIR))
    from routers.food_cost import trova_prodotto_dizionario

    prodotti = await db.dizionario_prodotti.find({}, {"_id": 0}).to_list(10000)
    dizionario = {p["nome_normalizzato"].lower(): p for p in prodotti}

    ricette = await db.ricette.find(
        {"ingredienti_dettaglio": {"$exists": True, "$ne": []}},
        {"_id": 0, "nome": 1, "id": 1, "ingredienti_dettaglio": 1}
    ).to_list(200)

    mancanti_map = {}
    totale_ingredienti = 0
    trovati = 0

    for r in ricette:
        for ing in r.get("ingredienti_dettaglio", []):
            nome = ing.get("nome", "").strip()
            if not nome or len(nome) <= 1 or "#ref" in nome.lower() or nome.startswith("="):
                continue
            totale_ingredienti += 1
            prod = trova_prodotto_dizionario(nome, dizionario)
            if prod:
                trovati += 1
            else:
                if nome not in mancanti_map:
                    mancanti_map[nome] = {"ingrediente": nome, "ricette": [], "count": 0}
                if r["nome"] not in mancanti_map[nome]["ricette"]:
                    mancanti_map[nome]["ricette"].append(r["nome"])
                mancanti_map[nome]["count"] += 1

    mancanti_list = sorted(mancanti_map.values(), key=lambda x: -x["count"])

    return {
        "totale_ingredienti": totale_ingredienti,
        "trovati": trovati,
        "non_trovati": len(mancanti_list),
        "percentuale_copertura": round(trovati / totale_ingredienti * 100, 1) if totale_ingredienti else 0,
        "ingredienti_mancanti": mancanti_list
    }
