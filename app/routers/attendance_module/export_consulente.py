"""
ATTENDANCE - Export consulente
==============================

Export presenze/giustificativi verso consulente del lavoro.

Regola operativa: le presenze nascono e si correggono nel gestionale;
verso il consulente si esporta un tracciato mensile chiaro. Non si usa
questo flusso per importare presenze da PDF.
"""
from __future__ import annotations

import calendar
import csv
import io
from datetime import datetime
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.database import Database
from app.utils.error_handler import handle_errors

router = APIRouter()

STATO_LABEL = {
    "presente": "P",
    "assente": "A",
    "ferie": "F",
    "permesso": "PE",
    "malattia": "M",
    "rol": "R",
    "chiuso": "CH",
    "riposo_settimanale": "RS",
    "trasferta": "T",
    "cessato": "X",
    "riposo": "-",
    "festivita_lavorata": "FL",
    "festivita_non_lavorata": "FNL",
}

STATI_TOTALI = ["P", "A", "F", "PE", "M", "R", "CH", "RS", "T", "X", "-", "FL", "FNL"]
STATI_RETRIBUITI = {"P", "F", "PE", "M", "R", "T", "FL", "FNL"}
STATI_NON_RETRIBUITI = {"A", "CH", "RS", "X", "-"}


def _nome_dipendente(dip: Dict[str, Any]) -> str:
    return (
        dip.get("nome_completo")
        or dip.get("name")
        or f"{dip.get('cognome', '')} {dip.get('nome', '')}".strip()
        or dip.get("id")
        or "Dipendente"
    )


def _mese_range(anno: int, mese: int) -> tuple[str, str, int]:
    if mese < 1 or mese > 12:
        raise HTTPException(status_code=400, detail="mese deve essere compreso tra 1 e 12")
    giorni = calendar.monthrange(anno, mese)[1]
    data_inizio = f"{anno}-{mese:02d}-01"
    if mese == 12:
        data_fine = f"{anno + 1}-01-01"
    else:
        data_fine = f"{anno}-{mese + 1:02d}-01"
    return data_inizio, data_fine, giorni


async def _carica_export(anno: int, mese: int) -> Dict[str, Any]:
    db = Database.get_db()
    data_inizio, data_fine, giorni_mese = _mese_range(anno, mese)

    dipendenti = await db["dipendenti"].find(
        {
            "$and": [
                {"$or": [{"in_carico": True}, {"in_carico": {"$exists": False}}]},
                {"$or": [{"stato_contratto": {"$ne": "cessato"}}, {"stato_contratto": {"$exists": False}}]},
            ]
        },
        {"_id": 0, "id": 1, "nome": 1, "cognome": 1, "nome_completo": 1, "name": 1, "codice_fiscale": 1},
    ).sort([("cognome", 1), ("nome", 1)]).to_list(1000)

    presenze_raw = await db["attendance_presenze_calendario"].find(
        {"data": {"$gte": data_inizio, "$lt": data_fine}},
        {"_id": 0},
    ).to_list(20000)

    note_raw = await db["attendance_note_presenze"].find(
        {"data": {"$gte": data_inizio, "$lt": data_fine}},
        {"_id": 0},
    ).to_list(5000)

    acconti_raw = await db["acconti_dipendenti"].find(
        {"anno": anno, "mese": mese},
        {"_id": 0},
    ).to_list(5000)

    presenze = {(p.get("employee_id"), p.get("data")): p.get("stato") for p in presenze_raw}
    note = {(n.get("employee_id"), n.get("data")): n for n in note_raw}
    acconti = {a.get("employee_id"): a.get("importo", 0) or 0 for a in acconti_raw}

    righe: List[Dict[str, Any]] = []
    anomalie: List[Dict[str, Any]] = []

    for dip in dipendenti:
        emp_id = dip.get("id")
        if not emp_id:
            continue

        totali = {stato: 0 for stato in STATI_TOTALI}
        giorni: Dict[str, str] = {}
        protocolli: List[str] = []
        ha_dati_reali = False

        for giorno in range(1, giorni_mese + 1):
            data = f"{anno}-{mese:02d}-{giorno:02d}"
            stato = presenze.get((emp_id, data), "")
            label = STATO_LABEL.get(stato, "")
            giorni[str(giorno)] = label

            if label:
                ha_dati_reali = True
            if label in totali:
                totali[label] += 1

            nota = note.get((emp_id, data))
            if label == "M" and nota and nota.get("protocollo_malattia"):
                protocolli.append(f"{giorno:02d}/{mese:02d}: {nota.get('protocollo_malattia')}")
            if label == "M" and not (nota and nota.get("protocollo_malattia")):
                anomalie.append({
                    "employee_id": emp_id,
                    "dipendente": _nome_dipendente(dip),
                    "data": data,
                    "codice": "M",
                    "messaggio": "Malattia senza protocollo certificato",
                })

        if not ha_dati_reali:
            continue

        giorni_retribuiti = sum(totali[s] for s in STATI_RETRIBUITI)
        giorni_non_retribuiti = sum(totali[s] for s in STATI_NON_RETRIBUITI)

        righe.append({
            "employee_id": emp_id,
            "dipendente": _nome_dipendente(dip),
            "codice_fiscale": dip.get("codice_fiscale") or "",
            "giorni": giorni,
            "totali": totali,
            "giorni_retribuiti": giorni_retribuiti,
            "giorni_non_retribuiti": giorni_non_retribuiti,
            "acconto": acconti.get(emp_id, 0),
            "protocolli_malattia": "; ".join(protocolli),
        })

    return {
        "anno": anno,
        "mese": mese,
        "giorni_mese": giorni_mese,
        "righe": righe,
        "anomalie": anomalie,
    }


@router.get("/export-consulente/preview")
@handle_errors
async def preview_export_consulente(
    anno: int = Query(..., ge=2020, le=2100),
    mese: int = Query(..., ge=1, le=12),
) -> Dict[str, Any]:
    """Preview JSON dell'export mensile prima di scaricare il CSV."""
    data = await _carica_export(anno, mese)
    return {
        "success": True,
        "anno": anno,
        "mese": mese,
        "dipendenti": len(data["righe"]),
        "anomalie_count": len(data["anomalie"]),
        "anomalie": data["anomalie"][:100],
    }


@router.get("/export-consulente/csv")
@handle_errors
async def export_consulente_csv(
    anno: int = Query(..., ge=2020, le=2100),
    mese: int = Query(..., ge=1, le=12),
):
    """Scarica CSV mensile presenze/giustificativi per consulente del lavoro."""
    data = await _carica_export(anno, mese)
    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")

    header = ["Dipendente", "Codice fiscale"]
    header += [str(g) for g in range(1, data["giorni_mese"] + 1)]
    header += STATI_TOTALI
    header += ["Giorni retribuiti", "Giorni non retribuiti", "Acconto EUR", "Protocolli malattia"]
    writer.writerow(header)

    for riga in data["righe"]:
        row = [riga["dipendente"], riga["codice_fiscale"]]
        row += [riga["giorni"].get(str(g), "") for g in range(1, data["giorni_mese"] + 1)]
        row += [riga["totali"].get(stato, 0) for stato in STATI_TOTALI]
        row += [
            riga["giorni_retribuiti"],
            riga["giorni_non_retribuiti"],
            f"{float(riga['acconto']):.2f}".replace(".", ","),
            riga["protocolli_malattia"],
        ]
        writer.writerow(row)

    if data["anomalie"]:
        writer.writerow([])
        writer.writerow(["ANOMALIE"])
        writer.writerow(["Dipendente", "Data", "Codice", "Messaggio"])
        for a in data["anomalie"]:
            writer.writerow([a["dipendente"], a["data"], a["codice"], a["messaggio"]])

    csv_bytes = output.getvalue().encode("utf-8-sig")
    filename = f"presenze_consulente_{anno}_{mese:02d}.csv"
    return StreamingResponse(
        io.BytesIO(csv_bytes),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
