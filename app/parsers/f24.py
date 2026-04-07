"""
Parser F24 (Modello di pagamento unificato)
============================================
Parsa PDF F24 dal commercialista.
Estrae: contribuente, codici tributo con importi, totale, data versamento.
"""
import re
import logging
from typing import Dict, Any, List
from datetime import datetime

logger = logging.getLogger(__name__)

CODICI_TRIBUTO = {
    "1001": "Ritenute IRPEF dipendenti",
    "1002": "Ritenute IRPEF co.co.co",
    "1040": "Ritenute IRPEF professionisti",
    "1712": "Acconto imposta sostitutiva TFR",
    "1713": "Saldo imposta sostitutiva TFR",
    "3812": "IRAP acconto I rata",
    "3813": "IRAP acconto II rata",
    "3800": "IRAP saldo",
    "6001": "IVA gennaio", "6002": "IVA febbraio", "6003": "IVA marzo",
    "6004": "IVA aprile", "6005": "IVA maggio", "6006": "IVA giugno",
    "6007": "IVA luglio", "6008": "IVA agosto", "6009": "IVA settembre",
    "6010": "IVA ottobre", "6011": "IVA novembre", "6012": "IVA dicembre",
    "6099": "IVA annuale",
    "6013": "IVA acconto",
    "3843": "Addizionale comunale IRPEF acconto",
    "3844": "Addizionale comunale IRPEF saldo",
    "3801": "Addizionale regionale IRPEF",
    "4001": "IRPEF saldo",
    "4033": "IRPEF acconto I rata",
    "4034": "IRPEF acconto II rata",
    "DM10": "INPS DM10",
}


def _parse_importo(s: str) -> float:
    try:
        return float(s.replace(".", "").replace(",", "."))
    except (ValueError, TypeError):
        return 0.0


def _parse_data(s: str) -> str:
    try:
        return datetime.strptime(s, "%d/%m/%Y").strftime("%Y-%m-%d")
    except ValueError:
        return s


def parse_f24_pdf(pdf_path: str = None, pdf_bytes: bytes = None) -> Dict[str, Any]:
    """
    Parsa PDF modello F24.
    Ritorna: contribuente, tributi[], inps[], totale, data_versamento.
    """
    import fitz

    if pdf_path:
        doc = fitz.open(pdf_path)
    elif pdf_bytes:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    else:
        raise ValueError("Serve pdf_path o pdf_bytes")

    full_text = ""
    for page in doc:
        full_text += page.get_text() + "\n"
    doc.close()

    result = {
        "contribuente_cf": "",
        "contribuente_denominazione": "",
        "data_versamento": "",
        "anno_riferimento": "",
        "sezione_erario": [],
        "sezione_inps": [],
        "sezione_regioni": [],
        "sezione_ici_imu": [],
        "totale": 0.0,
        "banca": "",
    }

    # Contribuente
    m = re.search(r'(?:CODICE\s+FISCALE|C\.F\.)[:\s]*([A-Z0-9]{11,16})', full_text, re.I)
    if m:
        result["contribuente_cf"] = m.group(1)
    
    m = re.search(r'(?:DENOMINAZIONE|RAGIONE SOCIALE)[:\s]*(.{3,60})', full_text, re.I)
    if m:
        result["contribuente_denominazione"] = m.group(1).strip()

    # Data versamento
    m = re.search(r'(?:DATA\s+DI\s+VERSAMENTO|VERSAMENTO\s+IL)[:\s]*(\d{2}/\d{2}/\d{4})', full_text, re.I)
    if m:
        result["data_versamento"] = _parse_data(m.group(1))

    # Codici tributo Erario — pattern: CODICE RATEAZ ANNO IMPORTO_DEBITO IMPORTO_CREDITO
    tributo_re = re.compile(r'(\d{4})\s+(\d{4})?\s*(\d{4})\s+([\d.]+,\d{2})')
    for m in tributo_re.finditer(full_text):
        codice = m.group(1)
        anno = m.group(3) if m.group(3) else m.group(2) or ""
        importo = _parse_importo(m.group(4))
        if importo > 0:
            result["sezione_erario"].append({
                "codice_tributo": codice,
                "descrizione": CODICI_TRIBUTO.get(codice, f"Tributo {codice}"),
                "anno_riferimento": anno,
                "importo_debito": importo,
                "importo_credito": 0.0,
            })

    # INPS — pattern: CODICE_SEDE CAUSALE MATRICOLA PERIODO IMPORTO
    inps_re = re.compile(r'(\d{3,5})\s+(\w{4})\s+(\d{10})\s+(\d{2}/\d{4})\s+(\d{2}/\d{4})\s+([\d.]+,\d{2})')
    for m in inps_re.finditer(full_text):
        result["sezione_inps"].append({
            "codice_sede": m.group(1),
            "causale": m.group(2),
            "matricola": m.group(3),
            "periodo_da": m.group(4),
            "periodo_a": m.group(5),
            "importo_debito": _parse_importo(m.group(6)),
        })

    # Totale
    m = re.search(r'TOTALE\s*(?:A\s*DEBITO)?[:\s]*([\d.]+,\d{2})', full_text, re.I)
    if m:
        result["totale"] = _parse_importo(m.group(1))
    else:
        result["totale"] = sum(t["importo_debito"] for t in result["sezione_erario"]) + \
                          sum(t["importo_debito"] for t in result["sezione_inps"])

    # Banca
    m = re.search(r'(?:BANCA|ISTITUTO)[:\s]*(.{3,40})', full_text, re.I)
    if m:
        result["banca"] = m.group(1).strip()

    logger.info(f"F24: {len(result['sezione_erario'])} tributi erario, {len(result['sezione_inps'])} INPS, totale {result['totale']}")
    return result
