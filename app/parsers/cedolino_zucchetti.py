"""
Parser Cedolini Zucchetti (Paghe Web / CSC Napoli)
===================================================
Parsa PDF multi-dipendente con split per Nr. progressivo INAIL.
Ogni cedolino = 2 pagine: foglio presenze (Aut. 301) + busta paga (Aut. 299).

Struttura riconosciuta:
- Nr. XXXXX = chiave di split per dipendente
- Codice dipendente: 0X00XXX
- Mese/Anno: dal periodo competenza
- Netto: ultima riga dopo "NETTO IN BUSTA" o "NETTO DA PAGARE"
- Lordo: "TOTALE COMPETENZE" 
- Trattenute: "TOTALE TRATTENUTE"
- IBAN: pattern IT[0-9]{2}[A-Z][0-9]{10}[0-9A-Z]{12}
"""
import re
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

# Pattern per split cedolini
SPLIT_PATTERN = re.compile(r'Nr\.\s*(\d{5,6})')
CF_PATTERN = re.compile(r'([A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z])')
IBAN_PATTERN = re.compile(r'(IT\d{2}[A-Z]\d{10}[0-9A-Z]{12})')
COD_DIP_PATTERN = re.compile(r'(?:Cod\.\s*Dip\.|Matr\.)\s*(\d{7})')
IMPORTO_PATTERN = re.compile(r'([\d.]+,\d{2})')

MESI_IT = {
    'gennaio': 1, 'febbraio': 2, 'marzo': 3, 'aprile': 4,
    'maggio': 5, 'giugno': 6, 'luglio': 7, 'agosto': 8,
    'settembre': 9, 'ottobre': 10, 'novembre': 11, 'dicembre': 12,
}


def _parse_importo(s: str) -> float:
    """Converte '1.234,56' in 1234.56"""
    try:
        return float(s.replace(".", "").replace(",", "."))
    except (ValueError, TypeError):
        return 0.0


def _extract_nome_cognome(text: str) -> tuple:
    """Estrae nome e cognome dal blocco anagrafica."""
    # Pattern: COGNOME NOME su riga dopo codice dipendente
    m = re.search(r'(?:Cod\.\s*Dip\.\s*\d+\s+)([A-ZÀÈÌÒÙ\' ]+)\s+([A-ZÀÈÌÒÙ][a-zàèìòù]+(?:\s+[A-ZÀÈÌÒÙ][a-zàèìòù]+)*)', text)
    if m:
        return m.group(1).strip().title(), m.group(2).strip().title()
    # Fallback: cerca pattern COGNOME\nNOME
    m = re.search(r'\n([A-Z\' ]{3,30})\s*\n\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)', text)
    if m:
        return m.group(1).strip().title(), m.group(2).strip()
    return "", ""


def _extract_periodo(text: str) -> tuple:
    """Estrae mese e anno dal periodo competenza."""
    # Pattern: "GENNAIO 2026" o "01/2026" o "Periodo: Gennaio 2026"
    for m_name, m_num in MESI_IT.items():
        if m_name.upper() in text.upper():
            anno_match = re.search(rf'{m_name}\s+(\d{{4}})', text, re.I)
            if anno_match:
                return m_num, int(anno_match.group(1))
    # Pattern numerico: 01/2026
    m = re.search(r'(\d{2})/(\d{4})', text)
    if m:
        return int(m.group(1)), int(m.group(2))
    return 0, 0


def parse_cedolino_pdf(pdf_path: str = None, pdf_bytes: bytes = None) -> List[Dict[str, Any]]:
    """
    Parsa PDF cedolini multi-dipendente.
    Ritorna lista di cedolini, uno per dipendente.
    """
    import fitz  # PyMuPDF

    if pdf_path:
        doc = fitz.open(pdf_path)
    elif pdf_bytes:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    else:
        raise ValueError("Serve pdf_path o pdf_bytes")

    # Estrai testo da tutte le pagine
    full_text = ""
    pages_text = []
    for page in doc:
        t = page.get_text()
        pages_text.append(t)
        full_text += t + "\n\f\n"
    doc.close()

    # Split per Nr. progressivo
    blocks = re.split(r'(?=Nr\.\s*\d{5,6})', full_text)
    blocks = [b for b in blocks if b.strip() and SPLIT_PATTERN.search(b)]

    if not blocks:
        # Fallback: tratta tutto come un singolo cedolino
        blocks = [full_text]

    cedolini = []
    for block in blocks:
        ced = _parse_block(block)
        if ced and (ced.get("codice_fiscale") or ced.get("codice_dipendente")):
            cedolini.append(ced)

    logger.info(f"Parsati {len(cedolini)} cedolini da {len(pages_text)} pagine")
    return cedolini


def _parse_block(text: str) -> Optional[Dict[str, Any]]:
    """Parsa un singolo blocco cedolino."""
    result: Dict[str, Any] = {
        "nr_progressivo": "",
        "codice_dipendente": "",
        "cognome": "",
        "nome": "",
        "codice_fiscale": "",
        "mese": 0,
        "anno": 0,
        "qualifica": "",
        "livello": "",
        "iban": "",
        # Importi
        "lordo": 0.0,
        "netto": 0.0,
        "totale_competenze": 0.0,
        "totale_trattenute": 0.0,
        "contributi_inps": 0.0,
        "irpef": 0.0,
        "addizionale_regionale": 0.0,
        "addizionale_comunale": 0.0,
        "tfr_maturato": 0.0,
        # Presenze
        "ore_ordinarie": 0.0,
        "ore_straordinario": 0.0,
        "giorni_lavorati": 0,
        "giorni_ferie": 0,
        "giorni_malattia": 0,
        "giorni_permesso": 0,
    }

    # Nr. progressivo
    m = SPLIT_PATTERN.search(text)
    if m:
        result["nr_progressivo"] = m.group(1)

    # Codice dipendente
    m = COD_DIP_PATTERN.search(text)
    if m:
        result["codice_dipendente"] = m.group(1)

    # CF
    ceraldi_cf = "04523831214"
    for m in CF_PATTERN.finditer(text):
        cf = m.group(1)
        if ceraldi_cf not in cf and cf != "04523831214":
            result["codice_fiscale"] = cf
            break

    # Nome/Cognome
    result["cognome"], result["nome"] = _extract_nome_cognome(text)

    # Periodo
    result["mese"], result["anno"] = _extract_periodo(text)

    # IBAN
    m = IBAN_PATTERN.search(text)
    if m:
        result["iban"] = m.group(1)

    # Importi chiave
    importi_map = {
        r'NETTO\s+(?:IN\s+BUSTA|DA\s+PAGARE)\s+([\d.]+,\d{2})': "netto",
        r'TOTALE\s+COMPETENZE\s+([\d.]+,\d{2})': "totale_competenze",
        r'TOTALE\s+TRATTENUTE\s+([\d.]+,\d{2})': "totale_trattenute",
        r'(?:CONTRIB|INPS)\s+(?:C/DIP|DIPENDENTE)\s+([\d.]+,\d{2})': "contributi_inps",
        r'(?:I\.?R\.?P\.?E\.?F\.?|IMP\.IRPEF)\s+([\d.]+,\d{2})': "irpef",
        r'ADD\.?\s*REG\.?\s+([\d.]+,\d{2})': "addizionale_regionale",
        r'ADD\.?\s*COM\.?\s+([\d.]+,\d{2})': "addizionale_comunale",
        r'T\.?F\.?R\.?\s+(?:MATUR|ACCANT)\s+([\d.]+,\d{2})': "tfr_maturato",
        r'ORE\s+ORDIN\w*\s+([\d.]+,\d{2})': "ore_ordinarie",
        r'ORE\s+STRAORD\w*\s+([\d.]+,\d{2})': "ore_straordinario",
    }

    text_upper = text.upper()
    for pattern, field in importi_map.items():
        m = re.search(pattern, text_upper)
        if m:
            result[field] = _parse_importo(m.group(1))

    # Lordo = competenze se disponibile
    if result["totale_competenze"] > 0:
        result["lordo"] = result["totale_competenze"]

    # Giorni lavorati
    m = re.search(r'GG\.\s*LAV\w*\s+(\d+)', text_upper)
    if m:
        result["giorni_lavorati"] = int(m.group(1))

    # Qualifica/livello
    m = re.search(r'(?:QUALIFICA|MANSIONE)[:\s]+(.{3,40})', text, re.I)
    if m:
        result["qualifica"] = m.group(1).strip()
    m = re.search(r'(?:LIVELLO|LIV\.)[:\s]+(\S+)', text, re.I)
    if m:
        result["livello"] = m.group(1).strip()

    # Dedup key
    result["dedup_key"] = f"{result['codice_fiscale']}_{result['mese']:02d}_{result['anno']}"

    return result
