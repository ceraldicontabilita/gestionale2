"""
Parser Verbali (CdS, Bollo auto, PagoPA)
==========================================
Parsa PDF/testo verbali contravvenzione e avvisi bollo.
Estrae: numero verbale, targa, importo, data, ente.
"""
import re
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


def _parse_importo(s: str) -> float:
    try:
        return float(s.replace(".", "").replace(",", "."))
    except (ValueError, TypeError):
        return 0.0


def parse_verbale_pdf(pdf_path: str = None, pdf_bytes: bytes = None) -> Dict[str, Any]:
    """Parsa PDF verbale CdS / avviso bollo auto."""
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

    return parse_verbale_text(full_text)


def parse_verbale_text(text: str) -> Dict[str, Any]:
    """Parsa testo verbale."""
    result = {
        "tipo": "",  # cds, bollo, multa
        "numero_verbale": "",
        "data_verbale": "",
        "data_notifica": "",
        "targa": "",
        "importo": 0.0,
        "importo_ridotto": 0.0,
        "importo_maggiorato": 0.0,
        "ente": "",
        "articolo_cds": "",
        "luogo_violazione": "",
        "iuv": "",  # per PagoPA
        "scadenza_pagamento": "",
        "intestatario": "",
        "codice_fiscale": "",
    }

    text_upper = text.upper()

    # Tipo
    if "CODICE DELLA STRADA" in text_upper or "C.D.S." in text_upper:
        result["tipo"] = "cds"
    elif "BOLLO" in text_upper or "TASSA AUTOMOBILISTICA" in text_upper:
        result["tipo"] = "bollo"
    else:
        result["tipo"] = "verbale"

    # Numero verbale
    for pattern in [
        r'(?:VERBALE|N\.\s*VERB\.|PROTOCOLLO)[:\s]*(\d[\d/\-\.]{4,25})',
        r'N\.\s*(\d{8,20})',
    ]:
        m = re.search(pattern, text, re.I)
        if m:
            result["numero_verbale"] = m.group(1).strip()
            break

    # Targa
    m = re.search(r'(?:TARGA|VEICOLO)[:\s]*([A-Z]{2}\s*\d{3}\s*[A-Z]{2})', text_upper)
    if m:
        result["targa"] = m.group(1).replace(" ", "")
    else:
        m = re.search(r'([A-Z]{2}\d{3}[A-Z]{2})', text_upper)
        if m:
            result["targa"] = m.group(1)

    # Importo
    for pattern in [
        r'(?:IMPORTO\s+(?:DA\s+)?PAGARE|TOTALE\s+DA\s+PAGARE|SOMMA\s+DOVUTA)[:\s]*€?\s*([\d.]+,\d{2})',
        r'€\s*([\d.]+,\d{2})',
    ]:
        m = re.search(pattern, text, re.I)
        if m:
            result["importo"] = _parse_importo(m.group(1))
            break

    # Importo ridotto (pagamento entro 5gg)
    m = re.search(r'(?:MISURA\s+RIDOTTA|ENTRO\s+5\s+GIORNI)[:\s]*€?\s*([\d.]+,\d{2})', text, re.I)
    if m:
        result["importo_ridotto"] = _parse_importo(m.group(1))

    # Date
    data_re = re.compile(r'(\d{2}/\d{2}/\d{4})')
    m = re.search(r'(?:DATA\s+(?:DELLA\s+)?VIOLAZIONE|ACCERTAMENTO)[:\s]*(\d{2}/\d{2}/\d{4})', text, re.I)
    if m:
        result["data_verbale"] = m.group(1)
    
    m = re.search(r'(?:DATA\s+NOTIFICA|NOTIFICATO\s+IL)[:\s]*(\d{2}/\d{2}/\d{4})', text, re.I)
    if m:
        result["data_notifica"] = m.group(1)

    # Articolo CdS
    m = re.search(r'(?:ART\.?|ARTICOLO)\s*(\d{1,3})\s*(?:COMMA\s*(\d+))?', text, re.I)
    if m:
        result["articolo_cds"] = f"Art. {m.group(1)}" + (f" comma {m.group(2)}" if m.group(2) else "")

    # Ente
    for keyword, ente in [("POLIZIA MUNICIPALE", "Polizia Municipale"), ("POLIZIA LOCALE", "Polizia Locale"),
                          ("CARABINIERI", "Carabinieri"), ("POLIZIA STRADALE", "Polizia Stradale"),
                          ("COMUNE DI", "Comune"), ("REGIONE", "Regione")]:
        if keyword in text_upper:
            m = re.search(rf'{keyword}\s+(?:DI\s+)?(\w+(?:\s+\w+)?)', text_upper)
            result["ente"] = f"{ente} {m.group(1).title()}" if m else ente
            break

    # IUV PagoPA
    m = re.search(r'(?:IUV|CODICE\s+AVVISO)[:\s]*(\d{15,25})', text)
    if m:
        result["iuv"] = m.group(1)

    # Scadenza
    m = re.search(r'(?:SCADENZA|ENTRO\s+IL|PAGARE\s+ENTRO)[:\s]*(\d{2}/\d{2}/\d{4})', text, re.I)
    if m:
        result["scadenza_pagamento"] = m.group(1)

    # CF
    cf_re = re.compile(r'([A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z])')
    m = cf_re.search(text)
    if m:
        result["codice_fiscale"] = m.group(1)

    return result
