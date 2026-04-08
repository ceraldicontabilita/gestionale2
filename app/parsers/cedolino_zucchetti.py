"""
Parser Cedolini Zucchetti (Paghe Web / CSC Napoli)
===================================================
Parsa PDF multi-dipendente con split per Nr. progressivo INAIL.
Ogni cedolino = 2 pagine: foglio presenze (Aut. 301) + busta paga (Aut. 299).

Struttura riconosciuta:
- Nr. XXXXX = chiave di split per dipendente
- Codice dipendente: 0X00XXX
- Mese/Anno: dal periodo competenza
- Netto: "NETTO IN BUSTA" o "NETTO DA PAGARE"
- Lordo: "TOTALE COMPETENZE"
- Trattenute: "TOTALE TRATTENUTE"
- IBAN: pattern IT[0-9]{2}[A-Z][0-9]{10}[0-9A-Z]{12}

Tipo erogazione (campo tipo_erogazione):
- "normale"  → cedolino mensile ordinario
- "acconto"  → acconto stipendio (presenza di ACCONTO o A CONTO)
- "saldo"    → saldo dopo acconto (presenza di SALDO)
- "tredicesima" → mensilità aggiuntiva
- "quattordicesima" → mensilità aggiuntiva

Trattenute dettagliate estratte:
- irpef_acconto, irpef_saldo, irpef_addizionale_regionale, irpef_addizionale_comunale
- contributi_inps (quota dipendente)
- anticipi_tfr (eventuali anticipazioni)
- detrazioni_lavoro_dipendente, detrazioni_familiari
- assegno_nucleo_familiare
- altre_trattenute (lista voci residue con etichetta e importo)
"""
import re
import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime

logger = logging.getLogger(__name__)

# ── Pattern base ────────────────────────────────────────────────────────────
SPLIT_PATTERN   = re.compile(r'Nr\.\s*(\d{5,6})')
CF_PATTERN      = re.compile(r'([A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z])')
IBAN_PATTERN    = re.compile(r'(IT\d{2}[A-Z]\d{10}[0-9A-Z]{12})')
COD_DIP_PATTERN = re.compile(r'(?:Cod\.\s*Dip\.|Matr\.)\s*(\d{7})')
IMPORTO_RE      = re.compile(r'([\d.]+,\d{2})')

MESI_IT = {
    'gennaio': 1, 'febbraio': 2, 'marzo': 3, 'aprile': 4,
    'maggio': 5, 'giugno': 6, 'luglio': 7, 'agosto': 8,
    'settembre': 9, 'ottobre': 10, 'novembre': 11, 'dicembre': 12,
}

# P.IVA Ceraldi — esclusa dalla ricerca CF dipendenti
_CERALDI_PIVA = "04523831214"


def _parse_importo(s: str) -> float:
    try:
        return float(s.replace(".", "").replace(",", "."))
    except (ValueError, TypeError):
        return 0.0


def _extract_nome_cognome(text: str) -> Tuple[str, str]:
    m = re.search(
        r'(?:Cod\.\s*Dip\.\s*\d+\s+)([A-ZÀÈÌÒÙ\' ]+)\s+([A-ZÀÈÌÒÙ][a-zàèìòù]+(?:\s+[A-ZÀÈÌÒÙ][a-zàèìòù]+)*)',
        text)
    if m:
        return m.group(1).strip().title(), m.group(2).strip().title()
    m = re.search(r'\n([A-Z\' ]{3,30})\s*\n\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)', text)
    if m:
        return m.group(1).strip().title(), m.group(2).strip()
    return "", ""


def _extract_periodo(text: str) -> Tuple[int, int]:
    tu = text.upper()
    for m_name, m_num in MESI_IT.items():
        if m_name.upper() in tu:
            am = re.search(rf'{m_name.upper()}\s+(\d{{4}})', tu)
            if am:
                return m_num, int(am.group(1))
    m = re.search(r'(\d{2})/(\d{4})', text)
    if m:
        return int(m.group(1)), int(m.group(2))
    return 0, 0


def _detect_tipo_erogazione(text: str) -> str:
    """Distingue cedolino ordinario da acconto, saldo, tredicesima, ecc."""
    tu = text.upper()
    if "TREDICESIMA" in tu or "13" in tu and "MENSILIT" in tu:
        return "tredicesima"
    if "QUATTORDICESIMA" in tu or "14" in tu and "MENSILIT" in tu:
        return "quattordicesima"
    # Acconto: la parola ACCONTO o A CONTO vicino a STIPENDIO/RETRIBUZIONE/NETTO
    if re.search(r'\bACCONTO\b|\bA\s+CONTO\b', tu):
        return "acconto"
    if re.search(r'\bSALDO\b\s+(?:STIPENDIO|RETRIBUZIONE|NETTO)', tu):
        return "saldo"
    return "normale"


def _extract_importi(text: str) -> Dict[str, Any]:
    """
    Estrae tutti gli importi dal blocco cedolino.
    Ritorna dizionario con campi fissi + lista altre_trattenute.
    """
    tu = text.upper()

    result = {
        # ── Totali principali ──────────────────────────
        "lordo": 0.0,
        "netto": 0.0,
        "totale_competenze": 0.0,
        "totale_trattenute": 0.0,

        # ── IRPEF ─────────────────────────────────────
        "irpef": 0.0,            # totale ritenuta IRPEF (acconto + saldo)
        "irpef_acconto": 0.0,    # acconto IRPEF (primo acconto novembre)
        "irpef_saldo": 0.0,      # saldo IRPEF conguaglio
        "irpef_addizionale_regionale": 0.0,
        "irpef_addizionale_comunale": 0.0,
        "irpef_addizionale_comunale_acconto": 0.0,

        # ── Contributi ────────────────────────────────
        "contributi_inps": 0.0,

        # ── TFR ───────────────────────────────────────
        "tfr_maturato": 0.0,
        "anticipi_tfr": 0.0,

        # ── Detrazioni (riducono le trattenute nette) ─
        "detrazioni_lavoro_dipendente": 0.0,
        "detrazioni_familiari": 0.0,
        "assegno_nucleo_familiare": 0.0,

        # ── Presenze ──────────────────────────────────
        "ore_ordinarie": 0.0,
        "ore_straordinario": 0.0,
        "giorni_lavorati": 0,
        "giorni_ferie": 0,
        "giorni_malattia": 0,
        "giorni_permesso": 0,

        # ── Voci residue non classificate ─────────────
        "altre_trattenute": [],   # [{voce, importo}]
        "altre_competenze": [],   # [{voce, importo}]
    }

    # ── Mappa pattern → campo ──────────────────────────────────────────────
    importi_map = [
        # Netto
        (r'NETTO\s+(?:IN\s+BUSTA|DA\s+PAGARE)\s+([\d.]+,\d{2})',       "netto"),
        (r'NETTO\s+EROGATO\s+([\d.]+,\d{2})',                           "netto"),
        # Totali
        (r'TOTALE\s+COMPETENZE\s+([\d.]+,\d{2})',                       "totale_competenze"),
        (r'TOTALE\s+TRATTENUTE\s+([\d.]+,\d{2})',                       "totale_trattenute"),
        # IRPEF — prima l'acconto (più specifico), poi il generico
        (r'IRPEF\s+ACCONTO\s+([\d.]+,\d{2})',                           "irpef_acconto"),
        (r'ACCONTO\s+IRPEF\s+([\d.]+,\d{2})',                           "irpef_acconto"),
        (r'IRPEF\s+SALDO\s+([\d.]+,\d{2})',                             "irpef_saldo"),
        (r'SALDO\s+IRPEF\s+([\d.]+,\d{2})',                             "irpef_saldo"),
        (r'(?:IMP\.?\s*IRPEF|RITENUTA\s+IRPEF|IRPEF)\s+([\d.]+,\d{2})(?!\s*ACCONTO|\s*SALDO)',
                                                                         "irpef"),
        # Addizionali
        (r'ADD\.?\s*REG(?:IONALE)?\s+([\d.]+,\d{2})',                   "irpef_addizionale_regionale"),
        (r'ADDIZIONALE\s+REGIONALE\s+([\d.]+,\d{2})',                   "irpef_addizionale_regionale"),
        (r'ADD\.?\s*COM(?:UNALE)?\s+ACCONTO\s+([\d.]+,\d{2})',          "irpef_addizionale_comunale_acconto"),
        (r'ACCONTO\s+ADD\.?\s*COM(?:UNALE)?\s+([\d.]+,\d{2})',          "irpef_addizionale_comunale_acconto"),
        (r'ADD\.?\s*COM(?:UNALE)?\s+([\d.]+,\d{2})',                    "irpef_addizionale_comunale"),
        (r'ADDIZIONALE\s+COMUNALE\s+([\d.]+,\d{2})',                    "irpef_addizionale_comunale"),
        # Contributi INPS
        (r'(?:CONTRIB|INPS)\s+(?:C/DIP|DIPENDENTE|PREV\.?)\s+([\d.]+,\d{2})',  "contributi_inps"),
        (r'CONTRIBUTI\s+(?:A\s+CARICO\s+)?DIPENDENTE\s+([\d.]+,\d{2})', "contributi_inps"),
        # TFR
        (r'T\.?F\.?R\.?\s+(?:MATUR|ACCANT)\w*\s+([\d.]+,\d{2})',       "tfr_maturato"),
        (r'ANTICIPO\s+T\.?F\.?R\.?\s+([\d.]+,\d{2})',                   "anticipi_tfr"),
        (r'ANTICIPAZIONE\s+T\.?F\.?R\.?\s+([\d.]+,\d{2})',              "anticipi_tfr"),
        # Detrazioni
        (r'DETR\.?\s+LAV\.?\s+DIP\.?\w*\s+([\d.]+,\d{2})',             "detrazioni_lavoro_dipendente"),
        (r'DETRAZIONI?\s+LAVORO\s+DIPENDENTE\s+([\d.]+,\d{2})',         "detrazioni_lavoro_dipendente"),
        (r'DETR\.?\s+FAMI\w*\s+([\d.]+,\d{2})',                        "detrazioni_familiari"),
        (r'DETRAZIONI?\s+FAMILIAR\w*\s+([\d.]+,\d{2})',                 "detrazioni_familiari"),
        (r'(?:ASSEGNO\s+)?NUCLEO\s+FAMILIARE\s+([\d.]+,\d{2})',         "assegno_nucleo_familiare"),
        (r'ANF\s+([\d.]+,\d{2})',                                        "assegno_nucleo_familiare"),
        # Presenze
        (r'ORE\s+ORDIN\w*\s+([\d.]+,\d{2})',                            "ore_ordinarie"),
        (r'ORE\s+STRAORD\w*\s+([\d.]+,\d{2})',                          "ore_straordinario"),
    ]

    matched_spans = set()  # traccia posizioni già matchate per non duplicare

    for pattern, field in importi_map:
        m = re.search(pattern, tu)
        if m and m.start() not in matched_spans:
            result[field] = _parse_importo(m.group(1))
            matched_spans.add(m.start())

    # Giorni
    m = re.search(r'GG\.\s*LAV\w*\s+(\d+)', tu)
    if m:
        result["giorni_lavorati"] = int(m.group(1))
    m = re.search(r'GG\.\s*FER\w*\s+(\d+)', tu)
    if m:
        result["giorni_ferie"] = int(m.group(1))
    m = re.search(r'GG\.\s*MAL\w*\s+(\d+)', tu)
    if m:
        result["giorni_malattia"] = int(m.group(1))
    m = re.search(r'GG\.\s*PERM\w*\s+(\d+)', tu)
    if m:
        result["giorni_permesso"] = int(m.group(1))

    # Lordo = competenze se disponibile
    if result["totale_competenze"] > 0:
        result["lordo"] = result["totale_competenze"]

    # IRPEF totale = somma acconto + saldo + irpef generica
    if result["irpef"] == 0.0:
        result["irpef"] = result["irpef_acconto"] + result["irpef_saldo"]

    # ── Voci residue: scandisce le righe per trovare importi non classificati ──
    # Pattern tipico riga cedolino: "VOCE DESCRIZIONE    123,45    456,78"
    # Le righe con importi nella colonna trattenute (destra) non ancora mappate
    righe_re = re.compile(
        r'^([A-Z][A-Z\s\./\-]{3,35}?)\s{2,}([\d.]+,\d{2})(?:\s+([\d.]+,\d{2}))?',
        re.MULTILINE
    )
    # Voci da ignorare (già mappate o non interessanti)
    skip_voci = {
        "TOTALE COMPETENZE", "TOTALE TRATTENUTE", "NETTO IN BUSTA", "NETTO DA PAGARE",
        "NETTO EROGATO", "IRPEF", "IRPEF ACCONTO", "IRPEF SALDO",
        "ADD REG", "ADD COM", "ADDIZIONALE REGIONALE", "ADDIZIONALE COMUNALE",
        "CONTRIBUTI", "INPS", "TFR", "ANF", "NUCLEO FAMILIARE",
        "DETR LAV", "DETRAZIONI LAVORO", "ORE ORD", "ORE STRAORD",
        "GG LAV", "GG FER", "GG MAL",
    }

    for m in righe_re.finditer(tu):
        voce = m.group(1).strip()
        if any(skip in voce for skip in skip_voci):
            continue
        imp1 = _parse_importo(m.group(2))
        imp2 = _parse_importo(m.group(3)) if m.group(3) else 0.0
        # Se ha due colonne → competenza + trattenuta
        if imp2 > 0:
            result["altre_trattenute"].append({"voce": voce.title(), "importo": imp2})
        # Una sola colonna — difficile sapere se è competenza o trattenuta senza layout
        # Aggiungiamo solo voci con importo significativo (>0) non già catturate

    return result


def parse_cedolino_pdf(pdf_path: str = None, pdf_bytes: bytes = None) -> List[Dict[str, Any]]:
    """
    Parsa PDF cedolini multi-dipendente Zucchetti.
    Ritorna lista di cedolini, uno per dipendente.
    """
    import fitz  # PyMuPDF

    if pdf_path:
        doc = fitz.open(pdf_path)
    elif pdf_bytes:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    else:
        raise ValueError("Serve pdf_path o pdf_bytes")

    pages_text = []
    full_text = ""
    for page in doc:
        t = page.get_text()
        pages_text.append(t)
        full_text += t + "\n\f\n"
    doc.close()

    # Split per Nr. progressivo INAIL
    blocks = re.split(r'(?=Nr\.\s*\d{5,6})', full_text)
    blocks = [b for b in blocks if b.strip() and SPLIT_PATTERN.search(b)]

    if not blocks:
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
        "tipo_erogazione": "normale",
    }

    # Nr. progressivo
    m = SPLIT_PATTERN.search(text)
    if m:
        result["nr_progressivo"] = m.group(1)

    # Codice dipendente
    m = COD_DIP_PATTERN.search(text)
    if m:
        result["codice_dipendente"] = m.group(1)

    # Codice fiscale (escludo P.IVA Ceraldi)
    for m in CF_PATTERN.finditer(text):
        cf = m.group(1)
        if _CERALDI_PIVA not in cf:
            result["codice_fiscale"] = cf
            break

    # Nome / Cognome
    result["cognome"], result["nome"] = _extract_nome_cognome(text)

    # Periodo
    result["mese"], result["anno"] = _extract_periodo(text)

    # IBAN
    m = IBAN_PATTERN.search(text)
    if m:
        result["iban"] = m.group(1)

    # Tipo erogazione
    result["tipo_erogazione"] = _detect_tipo_erogazione(text)

    # Qualifica / livello
    m = re.search(r'(?:QUALIFICA|MANSIONE)[:\s]+(.{3,40})', text, re.I)
    if m:
        result["qualifica"] = m.group(1).strip()
    m = re.search(r'(?:LIVELLO|LIV\.)[:\s]+(\S+)', text, re.I)
    if m:
        result["livello"] = m.group(1).strip()

    # Tutti gli importi (incluse trattenute dettagliate)
    importi = _extract_importi(text)
    result.update(importi)

    # Dedup key
    result["dedup_key"] = f"{result['codice_fiscale']}_{result['mese']:02d}_{result['anno']}"

    return result
