"""
Parser Estratto Conto Banco BPM (ex BNL)
=========================================
Parsa PDF estratto conto mensile Banco BPM.
Estrae: movimenti (data, valuta, descrizione, dare, avere), saldo iniziale/finale.

Pattern riconosciuti nella descrizione:
- "VOSTRA DISPOSIZIONE FAVORE [NOME]" → bonifico stipendio
- "ADDEBITO SDD" → domiciliazione
- "COMMISSIONI" → spese bancarie
- "F24" → pagamento F24
- "ACCREDITO BONIFICO" → incasso
"""
import re
import logging
from typing import Dict, Any, List
from datetime import datetime

logger = logging.getLogger(__name__)

IMPORTO_RE = re.compile(r'([\d.]+,\d{2})')
DATA_RE = re.compile(r'(\d{2}/\d{2}/\d{4})')


def _parse_importo(s: str) -> float:
    try:
        return float(s.replace(".", "").replace(",", "."))
    except (ValueError, TypeError):
        return 0.0


def _parse_data(s: str) -> str:
    """Converte DD/MM/YYYY in YYYY-MM-DD."""
    try:
        return datetime.strptime(s, "%d/%m/%Y").strftime("%Y-%m-%d")
    except ValueError:
        return s


def _categorizza(descrizione: str) -> str:
    """Categorizza movimento in base alla descrizione."""
    d = descrizione.upper()
    if "VOSTRA DISPOSIZIONE" in d or "DISP.FAVORE" in d:
        return "bonifico_uscita"
    if "ACCREDITO BONIFICO" in d or "BON.A VS.FAVORE" in d:
        return "bonifico_entrata"
    if "F24" in d:
        return "f24"
    if "ADDEBITO SDD" in d or "DOMICILIAZ" in d:
        return "domiciliazione"
    if "COMMISSIONI" in d or "COMPETENZE" in d or "SPESE" in d:
        return "commissioni"
    if "STIPEND" in d or "EMOLUMENT" in d:
        return "stipendio"
    if "POS" in d or "CARTA" in d or "NEXI" in d:
        return "pos"
    if "MUTUO" in d or "RATA" in d:
        return "mutuo"
    if "ASSEGNO" in d:
        return "assegno"
    if "PRELEVAMENTO" in d or "PRELIEVO" in d:
        return "prelievo"
    return "altro"


def _match_dipendente(descrizione: str) -> str:
    """Estrai nome dipendente da bonifico stipendio."""
    m = re.search(r'(?:FAVORE|A FAVORE DI)\s+([A-Z\' ]{3,40})', descrizione.upper())
    return m.group(1).strip().title() if m else ""


def parse_estratto_conto_pdf(pdf_path: str = None, pdf_bytes: bytes = None) -> Dict[str, Any]:
    """
    Parsa PDF estratto conto Banco BPM.
    Ritorna: saldo_iniziale, saldo_finale, movimenti[], periodo.
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
        "conto": "",
        "iban": "",
        "periodo": "",
        "saldo_iniziale": 0.0,
        "saldo_finale": 0.0,
        "totale_dare": 0.0,
        "totale_avere": 0.0,
        "movimenti": [],
    }

    # IBAN
    m = re.search(r'(IT\d{2}[A-Z]\d{10}[0-9A-Z]{12})', full_text)
    if m:
        result["iban"] = m.group(1)

    # Conto corrente
    m = re.search(r'(?:C/C|CONTO)\s*[N°.:]*\s*(\d{5,12})', full_text, re.I)
    if m:
        result["conto"] = m.group(1)

    # Saldo iniziale
    m = re.search(r'SALDO\s+(?:INIZIALE|PRECEDENTE|AL\s+\d)[^\n]*?([\d.]+,\d{2})', full_text, re.I)
    if m:
        result["saldo_iniziale"] = _parse_importo(m.group(1))

    # Saldo finale
    m = re.search(r'SALDO\s+(?:FINALE|CONTABILE|AL\s+\d)[^\n]*?([\d.]+,\d{2})', full_text, re.I)
    if m:
        result["saldo_finale"] = _parse_importo(m.group(1))

    # Movimenti — pattern: DATA_OP DATA_VAL DESCRIZIONE DARE AVERE
    # Riga tipica: "02/01/2026 03/01/2026 ACCREDITO BONIFICO DA... 1.234,56"
    lines = full_text.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        dates = DATA_RE.findall(line)
        if len(dates) >= 2:
            data_op = _parse_data(dates[0])
            data_val = _parse_data(dates[1])
            
            # Estrai descrizione e importi
            rest = line
            for d in dates[:2]:
                rest = rest.replace(d, "", 1)
            
            # Cerca importi nella riga e nella riga successiva
            importi_text = rest
            if i + 1 < len(lines) and not DATA_RE.search(lines[i + 1]):
                importi_text += " " + lines[i + 1].strip()
                
            importi = IMPORTO_RE.findall(importi_text)
            descrizione = re.sub(r'[\d.]+,\d{2}', '', rest).strip()
            
            # Continua descrizione nelle righe successive senza date
            j = i + 1
            while j < len(lines) and not DATA_RE.search(lines[j]) and len(lines[j].strip()) > 2:
                extra = lines[j].strip()
                if not IMPORTO_RE.match(extra):
                    descrizione += " " + extra
                j += 1

            descrizione = re.sub(r'\s+', ' ', descrizione).strip()
            
            if importi and descrizione:
                importo = _parse_importo(importi[0])
                # Determinare dare/avere è complesso senza formato esatto
                # Euristicaa: se la posizione nella riga è a sinistra = dare, destra = avere
                categoria = _categorizza(descrizione)
                is_dare = categoria in ("bonifico_uscita", "f24", "domiciliazione", "commissioni", "mutuo", "stipendio", "prelievo")
                
                mov = {
                    "data_operazione": data_op,
                    "data_valuta": data_val,
                    "descrizione": descrizione,
                    "dare": importo if is_dare else 0.0,
                    "avere": importo if not is_dare else 0.0,
                    "importo": -importo if is_dare else importo,
                    "categoria": categoria,
                    "dipendente": _match_dipendente(descrizione) if categoria == "bonifico_uscita" else "",
                }
                result["movimenti"].append(mov)
        i += 1

    result["totale_dare"] = round(sum(m["dare"] for m in result["movimenti"]), 2)
    result["totale_avere"] = round(sum(m["avere"] for m in result["movimenti"]), 2)
    
    logger.info(f"EC parsato: {len(result['movimenti'])} movimenti, saldo {result['saldo_finale']}")
    return result
