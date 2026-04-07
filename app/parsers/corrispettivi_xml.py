"""
Parser Corrispettivi Telematici XML
====================================
Parsa XML corrispettivi giornalieri (DatiCorrispettivi).
Estrae: data, matricola RT, totali per aliquota IVA, numero documenti.
"""
import xml.etree.ElementTree as ET
import re
import hashlib
import logging
from typing import Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)


def clean_namespaces(xml_str: str) -> str:
    return re.sub(r'\sxmlns[^"]*"[^"]*"', '', xml_str)


def _text(el, path, default=""):
    node = el.find(path)
    return (node.text or "").strip() if node is not None else default


def _float(el, path):
    try:
        return float(_text(el, path, "0").replace(",", "."))
    except (ValueError, TypeError):
        return 0.0


def parse_corrispettivo_xml(xml_content: str) -> Dict[str, Any]:
    """
    Parsa XML corrispettivo giornaliero.
    Ritorna: data, piva, matricola, totali per aliquota, numero_documenti.
    """
    xml_clean = clean_namespaces(xml_content)
    root = ET.fromstring(xml_clean)

    result = {
        "partita_iva": "",
        "data": "",
        "matricola_rt": "",
        "numero_chiusura": "",
        "totale_corrispettivi": 0.0,
        "totale_non_riscosso": 0.0,
        "dettaglio_iva": [],
        "numero_documenti_commerciali": 0,
        "dedup_key": "",
    }

    # P.IVA trasmittente
    result["partita_iva"] = _text(root, ".//IdCodice") or _text(root, ".//CodiceFiscale")

    # Dati corrispettivi
    dc = root.find(".//DatiCorrispettivi") or root
    result["data"] = _text(dc, ".//DataRiferimento") or _text(dc, ".//Data")
    result["matricola_rt"] = _text(dc, ".//MatricolaDispositivo") or _text(dc, ".//Matricola")
    result["numero_chiusura"] = _text(dc, ".//NumeroChiusura")
    result["numero_documenti_commerciali"] = int(_text(dc, ".//NumeroDocCommerciali") or "0")

    # Dettaglio per aliquota IVA
    for da in root.findall(".//DatiFatturaBodyDTE") or root.findall(".//Riepilogo") or root.findall(".//DatiIVA"):
        aliquota = _float(da, "Aliquota") or _float(da, "AliquotaIVA")
        imponibile = _float(da, "Ammontare") or _float(da, "ImponibileImporto")
        imposta = _float(da, "Imposta")
        natura = _text(da, "Natura")
        
        if imponibile > 0 or imposta > 0:
            result["dettaglio_iva"].append({
                "aliquota": aliquota,
                "imponibile": imponibile,
                "imposta": imposta,
                "natura": natura,
            })

    # Totali — cerca in vari posti
    tot = _float(root, ".//Totale") or _float(root, ".//ImportoTotale")
    if not tot and result["dettaglio_iva"]:
        tot = sum(d["imponibile"] + d["imposta"] for d in result["dettaglio_iva"])
    result["totale_corrispettivi"] = round(tot, 2)

    result["totale_non_riscosso"] = _float(root, ".//NonRiscossoTotale") or _float(root, ".//TotaleNonRiscosso")

    # Dedup
    result["dedup_key"] = hashlib.md5(
        f"{result['partita_iva']}|{result['data']}|{result['matricola_rt']}|{result['numero_chiusura']}".encode()
    ).hexdigest()

    return result
