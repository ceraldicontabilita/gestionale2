"""
Aruba PEC Downloader — Download XML Fatture dalla PEC
======================================================

Scarica direttamente dalla casella PEC Aruba (imaps.pec.aruba.it)
gli allegati XML delle fatture elettroniche SDI.

Flusso:
1. Connessione IMAP a imaps.pec.aruba.it
2. Cerca email da mittenti SDI (pec.fatturapa.gov.it, agenziaentrate.gov.it)
3. Scarica allegati .xml e .p7m (fatture firmate digitalmente)
4. Inserisce le fatture nella collezione 'invoices'
5. Evita duplicati via hash del contenuto XML
"""
import imaplib
import email
import os
import hashlib
import re
import uuid
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from email.header import decode_header
import xml.etree.ElementTree as ET

logger = logging.getLogger(__name__)

# Importa da settings (carica automaticamente /app/backend/.env)
from app.config import settings

# Valori di fallback da .env
PEC_HOST = settings.ARUBA_PEC_HOST
PEC_PORT = settings.ARUBA_PEC_PORT
PEC_USER = settings.ARUBA_PEC_USER or ""
PEC_PASSWORD = settings.ARUBA_PEC_PASSWORD or ""


async def get_pec_credentials(db) -> Dict[str, Any]:
    """
    Legge le credenziali PEC da MongoDB (pec_email_settings).
    Fallback alle variabili d'ambiente se il DB non ha dati.
    """
    try:
        cfg = await db["pec_email_settings"].find_one({}, {"_id": 0})
        if cfg and cfg.get("email") and cfg.get("app_password"):
            return {
                "host": cfg.get("imap_server", PEC_HOST),
                "port": int(cfg.get("imap_port", PEC_PORT)),
                "user": cfg["email"],
                "password": cfg["app_password"],
                "source": "database",
            }
    except Exception as e:
        logger.warning(f"Impossibile leggere credenziali PEC da DB: {e}")

    # Fallback a .env
    return {
        "host": PEC_HOST,
        "port": PEC_PORT,
        "user": PEC_USER,
        "password": PEC_PASSWORD,
        "source": "env",
    }

# Mittenti SDI attesi nella PEC
SDI_SENDERS = [
    "sdi",
    "pec.fatturapa.gov.it",
    "agenziaentrate.gov.it",
    "fatturapa.gov.it",
    "noreply@pec",
]

# Namespace XML FatturaPA
NS = {
    'p': 'http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2',
    'p10': 'http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2',
    'ns': 'http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2',
}

UPLOAD_DIR = "/app/app/uploads/pec_xml"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def decode_mime_header(value: str) -> str:
    if not value:
        return ""
    parts = decode_header(value)
    result = ""
    for part, encoding in parts:
        if isinstance(part, bytes):
            result += part.decode(encoding or "utf-8", errors="replace")
        else:
            result += str(part)
    return result


def is_sdi_sender(from_addr: str) -> bool:
    """Verifica se il mittente è il Sistema di Interscambio."""
    from_lower = from_addr.lower()
    return any(s in from_lower for s in SDI_SENDERS)


def parse_fatturapa_xml(xml_content: bytes) -> Optional[Dict[str, Any]]:
    """
    Parsa un file XML FatturaPA e estrae i dati principali.
    Supporta FatturaPA v1.2 con namespace variabili e encoding windows-1252/UTF-8.
    """
    try:
        # Rimuovi BOM se presente
        content = xml_content
        if content.startswith(b'\xef\xbb\xbf'):
            content = content[3:]

        # Verifica che sia una fattura elettronica (non metadata SDI)
        if b'FatturaElettronica' not in content and b'fatturaelettronica' not in content.lower():
            return None

        # Gestisci encoding windows-1252 (usato da alcuni software di fatturazione)
        # Normalizza l'XML convertendo l'encoding dichiarato
        try:
            # Tenta UTF-8 prima
            root = ET.fromstring(content)
        except ET.ParseError:
            try:
                # Tenta windows-1252
                decoded = content.decode('windows-1252', errors='replace')
                # Rimuovi la dichiarazione di encoding dall'XML per evitare conflitti
                decoded = re.sub(r'encoding=["\'][\w-]+["\']', 'encoding="UTF-8"', decoded)
                root = ET.fromstring(decoded.encode('utf-8'))
            except:
                return None

        # Trova il namespace dinamicamente
        tag = root.tag
        ns_match = re.match(r'\{(.+?)\}', tag)
        ns_uri = ns_match.group(1) if ns_match else ""
        ns = {'n': ns_uri} if ns_uri else {}

        def _find_in_tree(path_parts):
            """Cerca elemento nel tree con qualsiasi namespace."""
            elements = [root]
            for part in path_parts:
                next_els = []
                for el in elements:
                    # Cerca con namespace specifico
                    if ns_uri:
                        found = el.find(f'{{*}}{part}')
                        if found is None:
                            found = el.find(f'{{*}}{part}')
                    else:
                        found = el.find(part)
                    if found is not None:
                        next_els.append(found)
                    # Cerca anche nei figli diretti di tutti gli elementi
                    for child in el:
                        if child.tag.split('}')[-1] == part or child.tag == part:
                            next_els.append(child)
                elements = next_els[:1]  # Prendi solo il primo match
            return elements[0] if elements else None

        def findtext_any(path, default=''):
            """Trova testo con qualsiasi namespace prefix."""
            parts = path.split('/')
            el = _find_in_tree(parts)
            return (el.text or '').strip() if el is not None else default

        def findall_any(path):
            """Trova tutti gli elementi con qualsiasi namespace prefix."""
            parts = path.split('/')
            # Usa iterall per trovare in tutto l'albero
            tag_name = parts[-1]
            return [el for el in root.iter() if el.tag.split('}')[-1] == tag_name]

        # Estrai dati con ricerca per nome tag (ignora namespace)
        def get_by_tag(tag_name):
            for el in root.iter():
                if el.tag.split('}')[-1] == tag_name:
                    return (el.text or '').strip()
            return ''

        # Cedente (fornitore)
        cedente_denominazione = get_by_tag('Denominazione')
        cedente_piva = ''
        cedente_cf = ''

        # Cerca P.IVA e CF del cedente specificatamente
        for el in root.iter():
            tag = el.tag.split('}')[-1]
            if tag == 'CedentePrestatore':
                for sub in el.iter():
                    stag = sub.tag.split('}')[-1]
                    if stag == 'IdCodice' and not cedente_piva:
                        cedente_piva = (sub.text or '').strip()
                    if stag == 'CodiceFiscale' and not cedente_cf:
                        cedente_cf = (sub.text or '').strip()
                    if stag == 'Denominazione' and not cedente_denominazione:
                        cedente_denominazione = (sub.text or '').strip()
                break

        numero_fattura = get_by_tag('Numero')
        data_str = get_by_tag('Data')
        importo_totale = get_by_tag('ImportoTotaleDocumento')
        divisa = get_by_tag('Divisa') or 'EUR'
        tipo_documento = get_by_tag('TipoDocumento')
        modalita_pagamento = get_by_tag('ModalitaPagamento')
        importo_pagamento = get_by_tag('ImportoPagamento')
        data_scadenza = get_by_tag('DataScadenzaPagamento')
        iban = get_by_tag('IBAN')
        imponibile = get_by_tag('ImponibileImporto')
        imposta = get_by_tag('Imposta')
        aliquota_iva = get_by_tag('AliquotaIVA')

        # Descrizioni righe
        descrizioni = [el.text.strip() for el in root.iter()
                       if el.tag.split('}')[-1] == 'Descrizione' and el.text]

        def to_float(s):
            try:
                return float(str(s).replace(',', '.').strip())
            except:
                return 0.0

        total_amount = to_float(importo_totale) or to_float(importo_pagamento)
        imponibile_float = to_float(imponibile)
        imposta_float = to_float(imposta)

        # Validazione: se non c'è né fornitore né importo, non è una fattura valida
        if not cedente_denominazione and total_amount == 0 and not numero_fattura:
            return None

        metodo_map = {
            'MP01': 'contanti', 'MP02': 'assegno', 'MP03': 'assegno_circolare',
            'MP04': 'contanti', 'MP05': 'bonifico', 'MP06': 'vaglia',
            'MP07': 'bollettino', 'MP08': 'carta', 'MP09': 'rid',
            'MP10': 'rid', 'MP11': 'rid', 'MP12': 'rid',
            'MP13': 'rid', 'MP14': 'quiesecentpostale', 'MP15': 'carta',
            'MP16': 'domiciliazione', 'MP17': 'domiciliazione', 'MP18': 'bollettino',
            'MP19': 'sepa', 'MP20': 'sepa', 'MP21': 'sepa', 'MP22': 'sepa',
        }
        metodo_pagamento = metodo_map.get(modalita_pagamento, 'bonifico')

        return {
            "supplier_name": cedente_denominazione or "Fornitore Sconosciuto",
            "supplier_vat": cedente_piva,
            "supplier_cf": cedente_cf,
            "invoice_number": numero_fattura,
            "invoice_date": data_str,
            "due_date": data_scadenza,
            "total_amount": total_amount,
            "taxable_amount": imponibile_float,
            "vat_amount": imposta_float,
            "vat_rate": to_float(aliquota_iva),
            "currency": divisa,
            "document_type": tipo_documento,
            "payment_method_code": modalita_pagamento,
            "payment_method": metodo_pagamento,
            "iban": iban,
            "descrizione": '; '.join(descrizioni[:3]) if descrizioni else "",
            "fonte": "aruba_pec",
        }

    except Exception as e:
        logger.error(f"Errore parse XML FatturaPA: {e}")
        return None


async def download_pec_invoices(
    db,
    since_days: int = 30,
    host: str = None,
    port: int = None,
    user: str = None,
    password: str = None
) -> Dict[str, Any]:
    """
    Scarica e processa le fatture XML dalla casella PEC Aruba.
    Le credenziali vengono lette da MongoDB (pec_email_settings) con fallback a .env.

    Args:
        db: MongoDB database
        since_days: Quanti giorni indietro cercare
        host/port/user/password: Override credenziali esplicito (opzionale)

    Returns:
        Statistiche del download
    """
    # Recupera credenziali da MongoDB o .env
    creds = await get_pec_credentials(db)
    _host = host or creds["host"]
    _port = port or creds["port"]
    _user = user or creds["user"]
    _password = password or creds["password"]

    stats = {
        "emails_checked": 0,
        "xml_found": 0,
        "new_invoices": 0,
        "duplicates_skipped": 0,
        "errors": 0,
        "inserted": [],
        "credentials_source": creds.get("source", "unknown"),
    }

    if not _user or not _password:
        return {"success": False, "error": "Credenziali PEC non configurate (né in DB né in .env)", "stats": stats}

    try:
        logger.info(f"Connessione PEC: {_host}:{_port} come {_user}")
        mail = imaplib.IMAP4_SSL(_host, _port)
        mail.login(_user, _password)
        mail.select("INBOX")
        logger.info("Connessione PEC riuscita!")

        since_date = (datetime.now() - timedelta(days=since_days)).strftime("%d-%b-%Y")
        _, messages = mail.search(None, f'SINCE {since_date}')
        email_ids = messages[0].split() if messages[0] else []
        stats["emails_checked"] = len(email_ids)

        logger.info(f"Email PEC trovate: {len(email_ids)}")

        for eid in email_ids:
            try:
                _, msg_data = mail.fetch(eid, "(RFC822)")
                if not msg_data or not msg_data[0]:
                    continue
                msg = email.message_from_bytes(msg_data[0][1])

                from_addr = decode_mime_header(msg.get("From", ""))
                subject = decode_mime_header(msg.get("Subject", ""))

                # Processa tutte le email (PEC riceve anche non-SDI ma filtriamo per allegati XML)
                for part in msg.walk():
                    content_type = part.get_content_type()
                    filename = decode_mime_header(part.get_filename() or "")

                    # Accetta .xml e .p7m (XML firmato digitalmente)
                    is_xml = (
                        filename.lower().endswith('.xml') or
                        filename.lower().endswith('.p7m') or
                        content_type in ('application/xml', 'text/xml', 'application/pkcs7-mime')
                    )

                    if not is_xml:
                        continue

                    payload = part.get_payload(decode=True)
                    if not payload or len(payload) < 200:
                        continue

                    # Salta file SDI non-fattura (metadata e certificazioni PEC)
                    fname_lower = filename.lower()
                    if (fname_lower.endswith('_mt_001.xml') or
                        fname_lower == 'daticert.xml' or
                        fname_lower == 'smime.p7s' or
                        fname_lower == 'postacert.eml'):
                        continue

                    stats["xml_found"] += 1

                    # Per file .p7m (firma CAdES), estrai il contenuto XML interno
                    xml_content = payload
                    if filename.lower().endswith('.p7m'):
                        # Cerca il marker di inizio XML
                        xml_start = payload.find(b'<?xml')
                        if xml_start == -1:
                            # Cerca apertura tag FatturaElettronica con qualsiasi namespace
                            for marker in [b'<p:FatturaElettronica', b'<FatturaElettronica',
                                           b'<ns2:FatturaElettronica', b'<ns3:FatturaElettronica',
                                           b'<P:FatturaElettronica']:
                                idx = payload.find(marker)
                                if idx >= 0:
                                    xml_start = idx
                                    break
                        if xml_start == -1:
                            logger.warning(f"File .p7m senza XML leggibile: {filename}")
                            stats["errors"] += 1
                            continue
                        
                        # Cerca la fine del documento XML (tag di chiusura)
                        xml_content = payload[xml_start:]
                        for end_marker in [b'</p:FatturaElettronica>',
                                           b'</FatturaElettronica>',
                                           b'</ns2:FatturaElettronica>',
                                           b'</ns3:FatturaElettronica>',
                                           b'</P:FatturaElettronica>']:
                            idx_end = xml_content.rfind(end_marker)
                            if idx_end >= 0:
                                xml_content = xml_content[:idx_end + len(end_marker)]
                                break

                    # Hash per deduplicazione
                    content_hash = hashlib.md5(xml_content).hexdigest()

                    # Controlla duplicato
                    existing = await db["invoices"].find_one({"xml_hash": content_hash}, {"_id": 0, "id": 1})
                    if existing:
                        stats["duplicates_skipped"] += 1
                        logger.debug(f"Duplicato saltato: {filename}")
                        continue

                    # Parsa il contenuto XML
                    invoice_data = parse_fatturapa_xml(xml_content)
                    if not invoice_data:
                        logger.warning(f"Impossibile parsare XML: {filename}")
                        stats["errors"] += 1
                        continue

                    # Salva il file XML fisicamente
                    safe_name = re.sub(r'[^\w\-_.]', '_', filename) or f"fattura_{content_hash[:8]}.xml"
                    file_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4().hex[:8]}_{safe_name}")
                    with open(file_path, 'wb') as f:
                        f.write(xml_content)

                    # Costruisci documento da inserire in 'invoices'
                    invoice_doc = {
                        "id": str(uuid.uuid4()),
                        "xml_hash": content_hash,
                        "xml_filename": filename,
                        "xml_file_path": file_path,
                        "supplier_name": invoice_data["supplier_name"],
                        "cedente_denominazione": invoice_data["supplier_name"],
                        "supplier_vat": invoice_data["supplier_vat"],
                        "supplier_cf": invoice_data["supplier_cf"],
                        "invoice_number": invoice_data["invoice_number"],
                        "invoice_date": invoice_data["invoice_date"],
                        "due_date": invoice_data["due_date"],
                        "total_amount": invoice_data["total_amount"],
                        "taxable_amount": invoice_data["taxable_amount"],
                        "vat_amount": invoice_data["vat_amount"],
                        "vat_rate": invoice_data["vat_rate"],
                        "currency": invoice_data["currency"],
                        "document_type": invoice_data["document_type"],
                        "payment_method": invoice_data["payment_method"],
                        "payment_method_code": invoice_data["payment_method_code"],
                        "iban": invoice_data["iban"],
                        "descrizione": invoice_data["descrizione"],
                        "stato": "importata",
                        "fonte": "aruba_pec",
                        "email_from": from_addr,
                        "email_subject": subject,
                        "pec_email_id": eid.decode() if isinstance(eid, bytes) else str(eid),
                        "imported_at": datetime.now(timezone.utc).isoformat(),
                        "anno": int(invoice_data["invoice_date"][:4]) if invoice_data.get("invoice_date") and len(invoice_data["invoice_date"]) >= 4 else datetime.now().year,
                    }

                    await db["invoices"].insert_one(invoice_doc.copy())
                    stats["new_invoices"] += 1
                    stats["inserted"].append({
                        "fornitore": invoice_data["supplier_name"],
                        "numero": invoice_data["invoice_number"],
                        "data": invoice_data["invoice_date"],
                        "importo": invoice_data["total_amount"],
                        "metodo_pagamento": invoice_data["payment_method"],
                    })
                    logger.info(f"Fattura importata: {invoice_data['supplier_name']} | {invoice_data['invoice_number']} | €{invoice_data['total_amount']}")

            except Exception as e:
                logger.error(f"Errore processamento email PEC {eid}: {e}")
                stats["errors"] += 1

        mail.close()
        mail.logout()
        logger.info(f"PEC completato: {stats['new_invoices']} nuove fatture, {stats['duplicates_skipped']} duplicati saltati")

    except imaplib.IMAP4.error as e:
        error_msg = str(e)
        logger.error(f"Errore IMAP PEC: {error_msg}")
        return {"success": False, "error": f"Errore autenticazione PEC: {error_msg}", "stats": stats}
    except Exception as e:
        logger.error(f"Errore connessione PEC: {e}")
        return {"success": False, "error": str(e), "stats": stats}

    return {"success": True, "stats": stats}


async def test_pec_connection(db=None, host: str = None, port: int = None, user: str = None, password: str = None) -> Dict[str, Any]:
    """Test rapido della connessione PEC. Legge credenziali da MongoDB se db è fornito."""
    if db is not None:
        creds = await get_pec_credentials(db)
        _host = host or creds["host"]
        _port = port or creds["port"]
        _user = user or creds["user"]
        _password = password or creds["password"]
    else:
        _host = host or PEC_HOST
        _port = port or PEC_PORT
        _user = user or PEC_USER
        _password = password or PEC_PASSWORD

    if not _user or not _password:
        return {"success": False, "error": "Credenziali PEC non configurate"}

    try:
        mail = imaplib.IMAP4_SSL(_host, _port)
        result = mail.login(_user, _password)
        mail.select("INBOX")
        _, messages = mail.search(None, 'ALL')
        total = len(messages[0].split()) if messages[0] else 0
        mail.logout()
        return {
            "success": True,
            "message": f"Connessione PEC riuscita! Casella: {_user} | Email totali: {total}",
            "host": _host,
            "user": _user,
            "total_emails": total
        }
    except imaplib.IMAP4.error as e:
        return {"success": False, "error": f"Autenticazione fallita: {e}", "host": _host, "user": _user}
    except Exception as e:
        return {"success": False, "error": str(e), "host": _host, "user": _user}
