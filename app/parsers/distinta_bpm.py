"""
Parser Distinta Pagamento Banco BPM
====================================
Parsa PDF distinta di pagamento stipendi/bonifici.
Estrae: lista beneficiari con importo, IBAN, causale.
"""
import re
import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)


def _parse_importo(s: str) -> float:
    try:
        return float(s.replace(".", "").replace(",", "."))
    except (ValueError, TypeError):
        return 0.0


def _normalize_name(name: str) -> str:
    return re.sub(r'\s+', ' ', name).strip().title()


def parse_distinta_pdf(pdf_path: str = None, pdf_bytes: bytes = None) -> Dict[str, Any]:
    """
    Parsa PDF distinta pagamento Banco BPM.
    Ritorna: data, totale, lista bonifici con beneficiario/IBAN/importo.
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
        "data_disposizione": "",
        "conto_ordinante": "",
        "iban_ordinante": "",
        "totale": 0.0,
        "numero_bonifici": 0,
        "bonifici": [],
    }

    # Data disposizione
    m = re.search(r'(?:DATA\s+DISPOSIZIONE|DATA\s+ESECUZIONE|DEL)\s*[:\s]*(\d{2}/\d{2}/\d{4})', full_text, re.I)
    if m:
        from datetime import datetime
        try:
            result["data_disposizione"] = datetime.strptime(m.group(1), "%d/%m/%Y").strftime("%Y-%m-%d")
        except ValueError:
            result["data_disposizione"] = m.group(1)

    # IBAN ordinante
    m = re.search(r'(?:ORDINANTE|C/C)[^\n]*(IT\d{2}[A-Z]\d{10}[0-9A-Z]{12})', full_text)
    if m:
        result["iban_ordinante"] = m.group(1)

    # Bonifici — cerca pattern: BENEFICIARIO / IBAN / IMPORTO
    iban_re = re.compile(r'(IT\d{2}[A-Z]\d{10}[0-9A-Z]{12})')
    importo_re = re.compile(r'([\d.]+,\d{2})')
    
    # Split per IBAN (ogni IBAN = un bonifico)
    lines = full_text.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        iban_match = iban_re.search(line)
        if iban_match:
            iban = iban_match.group(1)
            if iban == result.get("iban_ordinante"):
                i += 1
                continue
            
            # Cerca nome beneficiario nelle righe precedenti
            nome = ""
            for back in range(max(0, i - 3), i):
                candidate = lines[back].strip()
                if candidate and not iban_re.search(candidate) and not importo_re.match(candidate):
                    if len(candidate) > 3 and not candidate.startswith(("IBAN", "BANCA", "DATA")):
                        nome = _normalize_name(candidate)
            
            # Cerca importo nelle righe vicine
            importo = 0.0
            for fwd in range(i, min(len(lines), i + 3)):
                m = importo_re.search(lines[fwd])
                if m:
                    importo = _parse_importo(m.group(1))
                    if importo > 50:  # Skip numeri piccoli (date, codici)
                        break

            if importo > 0:
                result["bonifici"].append({
                    "beneficiario": nome,
                    "iban": iban,
                    "importo": importo,
                    "causale": "stipendio",
                })
        i += 1

    result["numero_bonifici"] = len(result["bonifici"])
    result["totale"] = round(sum(b["importo"] for b in result["bonifici"]), 2)

    # Totale dalla distinta stessa
    m = re.search(r'TOTALE[:\s]*([\d.]+,\d{2})', full_text, re.I)
    if m:
        result["totale_distinta"] = _parse_importo(m.group(1))

    return result
