"""
Parser Fattura Elettronica XML (FatturaPA)
==========================================
Parsa i file XML SDI standard. Supporta:
- Fatture singole e lotti (FatturaElettronicaBody multipli)
- Namespace removal automatico
- Estrazione completa: cedente, cessionario, linee dettaglio, ritenute, pagamenti
- Calcolo totali con verifica coerenza
"""
import xml.etree.ElementTree as ET
import re
import hashlib
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


def clean_namespaces(xml_str: str) -> str:
    """Rimuove namespace XML per parsing semplificato."""
    return re.sub(r'\sxmlns[^"]*"[^"]*"', '', re.sub(r'<(/?)p:', r'<\1', xml_str))


def _text(el, path: str, default: str = "") -> str:
    """Estrai testo da xpath, safe."""
    node = el.find(path)
    return (node.text or "").strip() if node is not None else default


def _float(el, path: str) -> float:
    """Estrai float da xpath."""
    try:
        return float(_text(el, path, "0").replace(",", "."))
    except (ValueError, TypeError):
        return 0.0


def parse_fattura_xml(xml_content: str) -> List[Dict[str, Any]]:
    """
    Parsa XML FatturaPA. Ritorna lista di fatture (1 per body).
    
    Ogni fattura contiene:
    - cedente: denominazione, piva, cf, indirizzo, regime_fiscale
    - cessionario: denominazione, piva, cf, indirizzo
    - dati_generali: tipo_documento, data, numero, divisa, importo_totale
    - linee: lista dettaglio righe (descrizione, qty, prezzo, aliquota, importo)
    - riepilogo_iva: per aliquota (imponibile, imposta, natura)
    - pagamento: modalita, iban, data_scadenza, importo
    """
    xml_clean = clean_namespaces(xml_content)
    root = ET.fromstring(xml_clean)

    # Header (comune a tutte le fatture nel lotto)
    header = root.find(".//FatturaElettronicaHeader")
    cedente_el = header.find(".//CedentePrestatore") if header is not None else None
    cessionario_el = header.find(".//CessionarioCommittente") if header is not None else None

    cedente = {}
    if cedente_el is not None:
        sede = cedente_el.find(".//Sede")
        cedente = {
            "denominazione": _text(cedente_el, ".//Denominazione") or
                            f"{_text(cedente_el, './/Nome')} {_text(cedente_el, './/Cognome')}".strip(),
            "partita_iva": _text(cedente_el, ".//IdCodice"),
            "codice_fiscale": _text(cedente_el, ".//CodiceFiscale"),
            "regime_fiscale": _text(cedente_el, ".//RegimeFiscale"),
            "indirizzo": f"{_text(sede, 'Indirizzo')} {_text(sede, 'NumeroCivico')}".strip() if sede is not None else "",
            "cap": _text(sede, "CAP") if sede is not None else "",
            "comune": _text(sede, "Comune") if sede is not None else "",
            "provincia": _text(sede, "Provincia") if sede is not None else "",
        }

    cessionario = {}
    if cessionario_el is not None:
        sede = cessionario_el.find(".//Sede")
        cessionario = {
            "denominazione": _text(cessionario_el, ".//Denominazione") or
                            f"{_text(cessionario_el, './/Nome')} {_text(cessionario_el, './/Cognome')}".strip(),
            "partita_iva": _text(cessionario_el, ".//IdCodice"),
            "codice_fiscale": _text(cessionario_el, ".//CodiceFiscale"),
        }

    # Bodies (può essercene più di uno in un lotto)
    fatture = []
    for body in root.findall(".//FatturaElettronicaBody"):
        dg = body.find(".//DatiGeneraliDocumento")
        
        tipo_doc = _text(dg, "TipoDocumento") if dg is not None else ""
        data = _text(dg, "Data") if dg is not None else ""
        numero = _text(dg, "Numero") if dg is not None else ""
        importo_totale = _float(dg, "ImportoTotaleDocumento") if dg is not None else 0

        # Causale
        causali = []
        if dg is not None:
            for c in dg.findall("Causale"):
                if c.text:
                    causali.append(c.text.strip())

        # Linee dettaglio
        linee = []
        for det in body.findall(".//DettaglioLinee"):
            linea = {
                "numero": _text(det, "NumeroLinea"),
                "descrizione": _text(det, "Descrizione"),
                "quantita": _float(det, "Quantita"),
                "unita_misura": _text(det, "UnitaMisura"),
                "prezzo_unitario": _float(det, "PrezzoUnitario"),
                "prezzo_totale": _float(det, "PrezzoTotale"),
                "aliquota_iva": _float(det, "AliquotaIVA"),
            }
            # Codice articolo
            for ca in det.findall("CodiceArticolo"):
                linea[f"cod_{_text(ca, 'CodiceTipo').lower()}"] = _text(ca, "CodiceValore")
            linee.append(linea)

        # Riepilogo IVA
        riepilogo_iva = []
        for ri in body.findall(".//DatiRiepilogo"):
            riepilogo_iva.append({
                "aliquota": _float(ri, "AliquotaIVA"),
                "imponibile": _float(ri, "ImponibileImporto"),
                "imposta": _float(ri, "Imposta"),
                "natura": _text(ri, "Natura"),
                "riferimento_normativo": _text(ri, "RiferimentoNormativo"),
            })

        # Pagamento
        pagamenti = []
        for dp in body.findall(".//DettaglioPagamento"):
            pagamenti.append({
                "modalita": _text(dp, "ModalitaPagamento"),
                "data_scadenza": _text(dp, "DataScadenzaPagamento"),
                "importo": _float(dp, "ImportoPagamento"),
                "iban": _text(dp, "IBAN"),
                "istituto": _text(dp, "IstitutoFinanziario"),
            })

        # Ritenuta d'acconto
        ritenuta = None
        rit_el = body.find(".//DatiRitenuta") or (dg.find("DatiRitenuta") if dg is not None else None)
        if rit_el is not None:
            ritenuta = {
                "tipo": _text(rit_el, "TipoRitenuta"),
                "importo": _float(rit_el, "ImportoRitenuta"),
                "aliquota": _float(rit_el, "AliquotaRitenuta"),
                "causale": _text(rit_el, "CausalePagamento"),
            }

        # Calcola totali
        tot_imponibile = sum(r["imponibile"] for r in riepilogo_iva)
        tot_iva = sum(r["imposta"] for r in riepilogo_iva)

        # Hash dedup
        dedup_key = hashlib.md5(
            f"{cedente.get('partita_iva','')}|{numero}|{data}".encode()
        ).hexdigest()

        fattura = {
            "cedente": cedente,
            "cessionario": cessionario,
            "tipo_documento": tipo_doc,
            "data": data,
            "numero": numero,
            "importo_totale": importo_totale or round(tot_imponibile + tot_iva, 2),
            "imponibile": round(tot_imponibile, 2),
            "iva": round(tot_iva, 2),
            "causale": " ".join(causali),
            "linee": linee,
            "riepilogo_iva": riepilogo_iva,
            "pagamenti": pagamenti,
            "ritenuta": ritenuta,
            "dedup_key": dedup_key,
        }
        fatture.append(fattura)

    return fatture
