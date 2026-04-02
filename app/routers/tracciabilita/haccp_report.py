"""
Router per la generazione di Report HACCP PDF mensili.
Genera un PDF con: temperature positive, negative, sanificazione.
"""
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
from datetime import datetime, timezone
from collections import defaultdict

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
    PageBreak, KeepTogether
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

router = APIRouter(prefix="/haccp-report", tags=["HACCP Report"])

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")
db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]

# ─── Palette colori ───────────────────────────────────────────────────────────
BLUE_DARK = colors.HexColor("#1e3a5f")
BLUE_MID = colors.HexColor("#2563eb")
BLUE_LIGHT = colors.HexColor("#dbeafe")
GREEN = colors.HexColor("#16a34a")
RED = colors.HexColor("#dc2626")
ORANGE = colors.HexColor("#ea580c")
GRAY_BG = colors.HexColor("#f8fafc")
GRAY_LINE = colors.HexColor("#e2e8f0")
WHITE = colors.white

MESI_IT = {
    1: "Gennaio", 2: "Febbraio", 3: "Marzo", 4: "Aprile",
    5: "Maggio", 6: "Giugno", 7: "Luglio", 8: "Agosto",
    9: "Settembre", 10: "Ottobre", 11: "Novembre", 12: "Dicembre"
}


def build_styles():
    styles = getSampleStyleSheet()
    custom = {
        "title": ParagraphStyle("title", parent=styles["Normal"],
            fontSize=22, fontName="Helvetica-Bold", textColor=BLUE_DARK,
            spaceAfter=4, alignment=TA_CENTER),
        "subtitle": ParagraphStyle("subtitle", parent=styles["Normal"],
            fontSize=12, fontName="Helvetica", textColor=colors.HexColor("#475569"),
            spaceAfter=16, alignment=TA_CENTER),
        "section": ParagraphStyle("section", parent=styles["Normal"],
            fontSize=13, fontName="Helvetica-Bold", textColor=WHITE,
            spaceBefore=8, spaceAfter=4, leftIndent=6),
        "label": ParagraphStyle("label", parent=styles["Normal"],
            fontSize=9, fontName="Helvetica-Bold", textColor=BLUE_DARK),
        "small": ParagraphStyle("small", parent=styles["Normal"],
            fontSize=8, fontName="Helvetica", textColor=colors.HexColor("#64748b")),
        "body": ParagraphStyle("body", parent=styles["Normal"],
            fontSize=9, fontName="Helvetica", textColor=colors.HexColor("#1e293b")),
        "ok": ParagraphStyle("ok", parent=styles["Normal"],
            fontSize=9, fontName="Helvetica-Bold", textColor=GREEN, alignment=TA_CENTER),
        "ko": ParagraphStyle("ko", parent=styles["Normal"],
            fontSize=9, fontName="Helvetica-Bold", textColor=RED, alignment=TA_CENTER),
    }
    return custom


def section_header(title: str, color=BLUE_DARK) -> Table:
    """Crea un'intestazione colorata per la sezione."""
    t = Table([[Paragraph(title, build_styles()["section"])]], colWidths=[17.5 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), color),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("ROUNDEDCORNERS", [4]),
    ]))
    return t


def val_color(val, min_ok, max_ok):
    """Restituisce il colore del testo in base alla tolleranza."""
    try:
        v = float(str(val).replace(",", ".").replace("°", ""))
        if min_ok <= v <= max_ok:
            return GREEN
        return RED
    except Exception:
        return colors.HexColor("#94a3b8")


async def get_temperature_data(mese: int, anno: int) -> dict:
    """
    Carica i dati temperatura per mese/anno.
    Struttura DB: doc.temperature[str(mese)][str(giorno)] = float
    """
    mese_str = str(mese)
    result = {"positive": [], "negative": []}

    for tipo in ["positive", "negative"]:
        col = db[f"temperature_{tipo}"]
        # Un doc per ogni attrezzatura+anno
        cursor = col.find({"anno": anno}, {"_id": 0})
        async for doc in cursor:
            temp_mese = doc.get("temperature", {}).get(mese_str, {})
            if not temp_mese:
                continue
            # Converti {giorno_str: valore} in formato {giorno_str: {"mattina": val}}
            # (nel DB c'è un solo valore al giorno, lo usiamo come "mattina")
            giorni_fmt = {}
            for g_str, val in temp_mese.items():
                if isinstance(val, dict):
                    # DB già strutturato con {"mattina": float, "sera": float}
                    giorni_fmt[g_str] = {"mattina": val.get("mattina", ""), "sera": val.get("sera", "")}
                else:
                    giorni_fmt[g_str] = {"mattina": val, "sera": ""}
            result[tipo].append({
                "attrezzatura": doc.get("frigorifero_nome") or doc.get("nome_attrezzatura", "N/D"),
                "giorni": giorni_fmt,
            })

    return result


async def get_sanificazione_data(mese: int, anno: int) -> list:
    """
    Carica i dati sanificazione per mese/anno.
    Struttura DB: doc.anno, doc.mese, doc.aree, doc.giorni[giorno_str].eseguita
    """
    cursor = db.sanificazione.find(
        {"anno": anno, "mese": mese},
        {"_id": 0, "aree": 1, "giorni": 1}
    )
    docs = await cursor.to_list(500)

    if not docs:
        return []

    # Aggreghiamo: per ogni area, un record con tutti i giorni
    # Le aree sono elencate nel campo 'aree' (lista stringhe)
    # I giorni sono in 'giorni' con stato per l'intera scheda (non per area)
    # Creiamo un unico record "Sanificazione Giornaliera" con i giorni
    giorni_agg = {}
    for doc in docs:
        for g_str, g_data in doc.get("giorni", {}).items():
            eseguita = g_data.get("eseguita", False) if isinstance(g_data, dict) else bool(g_data)
            if g_str not in giorni_agg:
                giorni_agg[g_str] = eseguita
            else:
                giorni_agg[g_str] = giorni_agg[g_str] and eseguita

    result = []

    # Un record per area (se le aree sono disponibili nel primo doc)
    aree = []
    for doc in docs:
        aree = doc.get("aree", [])
        if aree:
            break

    if aree:
        for area in aree:
            # Ogni area ha gli stessi giorni (il sistema registra tutto insieme)
            result.append({
                "zona": area,
                "giorni": {g: {"fatto": v} for g, v in giorni_agg.items()},
            })
    else:
        result.append({
            "zona": "Sanificazione Generale",
            "giorni": {g: {"fatto": v} for g, v in giorni_agg.items()},
        })

    return result


def build_temperature_table(attrezzature: list, mese: int, anno: int,
                             tipo: str, styles: dict) -> list:
    """
    Costruisce la tabella calendario PDF per le temperature.
    Layout: griglia mensile con righe = settimane, colonne = Lun-Dom.
    Celle colorate verde (OK) / rosso (fuori range) / grigio (assente).
    """
    import calendar
    n_giorni = calendar.monthrange(anno, mese)[1]
    primo_giorno_sett = calendar.monthrange(anno, mese)[0]  # 0=Lun, 6=Dom

    if not attrezzature:
        return [Paragraph("Nessun dato disponibile per questo mese.", styles["small"])]

    MIN_OK = -25 if tipo == "negative" else 0
    MAX_OK = -15 if tipo == "negative" else 8

    GIORNI_SETT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"]

    # Costruisce le settimane del mese
    # Ogni settimana è una lista di 7 elementi (giorno int o None)
    weeks = []
    current_week = [None] * primo_giorno_sett
    for day in range(1, n_giorni + 1):
        current_week.append(day)
        if len(current_week) == 7:
            weeks.append(current_week)
            current_week = []
    if current_week:
        current_week += [None] * (7 - len(current_week))
        weeks.append(current_week)

    # Larghezze colonne: etichetta riga + 7 colonne giorni
    # A4 usabile = 17 cm totali
    label_w = 1.8 * cm
    day_w   = (17.0 * cm - label_w) / 7  # ~2.17 cm ciascuna

    flowables = []

    for att in attrezzature:
        nome = att["attrezzatura"]
        dati_giorni = att.get("giorni", {})

        # Verifica se ha dati "sera"
        ha_sera = any(
            isinstance(dati_giorni.get(str(g), {}), dict) and dati_giorni.get(str(g), {}).get("sera")
            for g in range(1, n_giorni + 1)
        )

        # ── Intestazione apparecchio ──────────────────────────────────────────
        flowables.append(Paragraph(f"<b>{nome[:50]}</b>", styles["label"]))
        flowables.append(Spacer(1, 2))

        # ── Costruzione righe tabella ─────────────────────────────────────────
        header_row = [Paragraph("", styles["small"])] + [
            Paragraph(g, ParagraphStyle(
                f"dh_{g}", parent=styles["small"],
                alignment=TA_CENTER, fontName="Helvetica-Bold", fontSize=7
            ))
            for g in GIORNI_SETT
        ]
        rows = [header_row]

        # Stili per celle: lista comandi TableStyle (indici riga, col)
        style_cmds = [
            ("BACKGROUND", (0, 0), (-1, 0), BLUE_LIGHT),
            ("BOX", (0, 0), (-1, -1), 0.5, GRAY_LINE),
            ("INNERGRID", (0, 0), (-1, -1), 0.3, GRAY_LINE),
            ("FONTSIZE", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]

        for week_idx, week in enumerate(weeks):
            # Riga numero giorno
            num_row = [Paragraph("", ParagraphStyle(
                "nl", parent=styles["small"], fontSize=5, textColor=colors.HexColor("#94a3b8")
            ))]
            # Riga mattina
            mat_row = [Paragraph("Matt.", ParagraphStyle(
                "ml", parent=styles["small"], fontSize=6, textColor=colors.HexColor("#475569")
            ))]
            # Riga sera (opzionale)
            sera_row_data = [Paragraph("Sera", ParagraphStyle(
                "sl", parent=styles["small"], fontSize=6, textColor=colors.HexColor("#475569")
            ))] if ha_sera else None

            for day in week:
                if day is None:
                    num_row.append(Paragraph("", styles["small"]))
                    mat_row.append(Paragraph("", styles["small"]))
                    if sera_row_data is not None:
                        sera_row_data.append(Paragraph("", styles["small"]))
                else:
                    g_str = str(day)
                    # Numero giorno
                    num_row.append(Paragraph(str(day), ParagraphStyle(
                        f"dn_{day}", parent=styles["small"],
                        alignment=TA_CENTER, fontName="Helvetica-Bold", fontSize=6,
                        textColor=colors.HexColor("#334155")
                    )))

                    # Valore mattina
                    gd = dati_giorni.get(g_str, {})
                    mat_val = gd.get("mattina", "") if isinstance(gd, dict) else gd
                    if isinstance(mat_val, dict):
                        mat_val = mat_val.get("mattina", "")
                    c_mat = val_color(mat_val, MIN_OK, MAX_OK) if mat_val != "" else colors.HexColor("#cbd5e1")
                    try:
                        mat_str = f"{float(str(mat_val).replace(',', '.').replace('°', '')):.1f}°" if mat_val != "" else "—"
                    except (ValueError, TypeError):
                        mat_str = str(mat_val) if mat_val else "—"
                    mat_row.append(Paragraph(mat_str, ParagraphStyle(
                        f"mv_{day}", parent=styles["small"],
                        textColor=c_mat, alignment=TA_CENTER, fontSize=7, fontName="Helvetica-Bold"
                    )))

                    # Valore sera
                    if sera_row_data is not None:
                        sera_val = gd.get("sera", "") if isinstance(gd, dict) else ""
                        if isinstance(sera_val, dict):
                            sera_val = sera_val.get("sera", "")
                        c_sera = val_color(sera_val, MIN_OK, MAX_OK) if sera_val else colors.HexColor("#cbd5e1")
                        try:
                            sera_str = f"{float(str(sera_val).replace(',', '.').replace('°', '')):.1f}°" if sera_val else "—"
                        except (ValueError, TypeError):
                            sera_str = str(sera_val) if sera_val else "—"
                        sera_row_data.append(Paragraph(sera_str, ParagraphStyle(
                            f"sv_{day}", parent=styles["small"],
                            textColor=c_sera, alignment=TA_CENTER, fontSize=7
                        )))

            rows.append(num_row)
            rows.append(mat_row)
            if sera_row_data is not None:
                rows.append(sera_row_data)

            # Background alternato per settimane (ogni 2 o 3 righe)
            n_sub = 3 if ha_sera else 2  # num_row + mat_row + (sera_row)
            base_idx = 1 + week_idx * n_sub  # 1 per il header
            # Sfondo grigio chiaro per le righe numero giorno
            style_cmds.append(("BACKGROUND", (0, base_idx), (-1, base_idx), colors.HexColor("#f1f5f9")))
            # Sfondo bianco per le righe mattina
            style_cmds.append(("BACKGROUND", (0, base_idx + 1), (-1, base_idx + 1), WHITE))

        t = Table(rows, colWidths=[label_w] + [day_w] * 7, repeatRows=1)
        t.setStyle(TableStyle(style_cmds))
        flowables.append(t)
        flowables.append(Spacer(1, 10))

    return flowables



def build_sanificazione_table(zone: list, mese: int, anno: int, styles: dict) -> list:
    """Costruisce la tabella di sanificazione."""
    import calendar
    n_giorni = calendar.monthrange(anno, mese)[1]
    giorni = list(range(1, n_giorni + 1))

    if not zone:
        return [Paragraph("Nessun dato disponibile.", styles["small"])]

    flowables = []
    for zona_data in zone:
        nome = zona_data["zona"]
        dati = zona_data.get("giorni", {})

        header = [Paragraph(nome, styles["label"])] + [
            Paragraph(str(g), styles["small"]) for g in giorni
        ]
        col_w = [3.5 * cm] + [0.46 * cm] * n_giorni

        stato_row = [Paragraph("Stato", styles["small"])]
        for g in giorni:
            giorno_str = str(g)
            gd = dati.get(giorno_str, {})
            fatto = gd.get("fatto", False) or gd.get("eseguita", False)
            if isinstance(gd, bool):
                fatto = gd
            testo = "✓" if fatto else "-"
            colore = GREEN if fatto else colors.HexColor("#cbd5e1")
            stato_row.append(Paragraph(testo, ParagraphStyle(
                "sv", parent=styles["small"], textColor=colore, alignment=TA_CENTER, fontSize=8
            )))

        data = [header, stato_row]
        t = Table(data, colWidths=col_w, repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dcfce7")),
            ("BACKGROUND", (0, 1), (-1, 1), WHITE),
            ("BOX", (0, 0), (-1, -1), 0.5, GRAY_LINE),
            ("INNERGRID", (0, 0), (-1, -1), 0.3, GRAY_LINE),
            ("FONTSIZE", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        flowables.append(t)
        flowables.append(Spacer(1, 6))

    return flowables


def on_page(canvas, doc, mese: int, anno: int):
    """Header/footer di ogni pagina."""
    canvas.saveState()
    w, h = A4
    # Footer
    canvas.setFillColor(colors.HexColor("#94a3b8"))
    canvas.setFont("Helvetica", 7)
    canvas.drawString(2 * cm, 1 * cm, f"Report HACCP - {MESI_IT[mese]} {anno}")
    canvas.drawRightString(w - 2 * cm, 1 * cm, f"Pag. {doc.page}")
    # Linea footer
    canvas.setStrokeColor(GRAY_LINE)
    canvas.line(2 * cm, 1.3 * cm, w - 2 * cm, 1.3 * cm)
    canvas.restoreState()


@router.get("/pdf")
async def genera_pdf_haccp(
    mese: int = Query(..., ge=1, le=12, description="Mese (1-12)"),
    anno: int = Query(..., ge=2020, le=2030, description="Anno"),
):
    """
    Genera e restituisce il Report HACCP PDF mensile.
    Include: temperature positive, temperature negative, sanificazione.
    """
    styles = build_styles()
    nome_mese = MESI_IT[mese]

    # ── Carica dati ──────────────────────────────────────────────────────────
    temp_data = await get_temperature_data(mese, anno)
    san_data = await get_sanificazione_data(mese, anno)

    # ── Buffer PDF ────────────────────────────────────────────────────────────
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2.5 * cm,
        bottomMargin=2 * cm,
        title=f"Report HACCP - {nome_mese} {anno}",
        author="Ceraldi Group S.R.L."
    )

    story = []

    # ── Copertina ─────────────────────────────────────────────────────────────
    story.append(Spacer(1, 1.5 * cm))
    story.append(Paragraph("REPORT HACCP MENSILE", styles["title"]))
    story.append(Paragraph(f"{nome_mese} {anno}", ParagraphStyle(
        "mese", parent=styles["subtitle"], fontSize=18, textColor=BLUE_MID,
        fontName="Helvetica-Bold"
    )))
    story.append(Paragraph("Ceraldi Group S.R.L.", styles["subtitle"]))
    story.append(HRFlowable(width="100%", thickness=2, color=BLUE_MID, spaceAfter=12))

    # Riepilogo counts
    n_pos = len(temp_data["positive"])
    n_neg = len(temp_data["negative"])
    n_san = len(san_data)

    summary_data = [
        ["Sezione", "N° Attrezzature/Zone", "Periodo"],
        ["Temperature Positive", str(n_pos), f"{nome_mese} {anno}"],
        ["Temperature Negative", str(n_neg), f"{nome_mese} {anno}"],
        ["Sanificazione", str(n_san), f"{nome_mese} {anno}"],
    ]
    summary_t = Table(summary_data, colWidths=[7 * cm, 5 * cm, 5 * cm])
    summary_t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BLUE_DARK),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BACKGROUND", (0, 1), (-1, -1), GRAY_BG),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [GRAY_BG, WHITE]),
        ("BOX", (0, 0), (-1, -1), 0.5, GRAY_LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, GRAY_LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(summary_t)
    story.append(Spacer(1, 0.5 * cm))
    story.append(Paragraph(
        f"Documento generato il {datetime.now().strftime('%d/%m/%Y %H:%M')}",
        styles["small"]
    ))

    # ── SEZIONE 1: Temperature Positive ──────────────────────────────────────
    story.append(PageBreak())
    story.append(section_header("TEMPERATURE POSITIVE (Refrigerazione)", BLUE_MID))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "Valori accettabili: 0°C ÷ +8°C. Valori fuori range evidenziati in rosso.",
        styles["small"]
    ))
    story.append(Spacer(1, 6))
    story.extend(build_temperature_table(temp_data["positive"], mese, anno, "positive", styles))

    # ── SEZIONE 2: Temperature Negative ──────────────────────────────────────
    story.append(PageBreak())
    story.append(section_header("TEMPERATURE NEGATIVE (Congelazione)", RED))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "Valori accettabili: -25°C ÷ -15°C. Valori fuori range evidenziati in rosso.",
        styles["small"]
    ))
    story.append(Spacer(1, 6))
    story.extend(build_temperature_table(temp_data["negative"], mese, anno, "negative", styles))

    # ── SEZIONE 3: Sanificazione ──────────────────────────────────────────────
    story.append(PageBreak())
    story.append(section_header("SANIFICAZIONE GIORNALIERA", GREEN))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "✓ = Sanificazione effettuata. - = Non registrata.",
        styles["small"]
    ))
    story.append(Spacer(1, 6))
    story.extend(build_sanificazione_table(san_data, mese, anno, styles))

    # ── Build PDF ─────────────────────────────────────────────────────────────
    doc.build(
        story,
        onFirstPage=lambda c, d: on_page(c, d, mese, anno),
        onLaterPages=lambda c, d: on_page(c, d, mese, anno),
    )
    buffer.seek(0)

    filename = f"HACCP_{nome_mese}_{anno}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
