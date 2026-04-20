"""
Common utilities and constants for suppliers module.
"""
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

# Cache key per suppliers
SUPPLIERS_CACHE_KEY = "suppliers_list"
SUPPLIERS_CACHE_TTL = 300  # 5 minuti per performance migliori

# Metodi di pagamento disponibili — SOLO questi 6
PAYMENT_METHODS = {
    "contanti": {"label": "Contanti", "prima_nota": "cassa"},
    "assegno": {"label": "Assegno", "prima_nota": "banca"},
    "bonifico": {"label": "Bonifico", "prima_nota": "banca"},
    "misto": {"label": "Misto", "prima_nota": "provvisorio"},
    "rid": {"label": "R.I.D.", "prima_nota": "banca"},
    "carta": {"label": "Carta", "prima_nota": "banca"},
}

# Termini di pagamento predefiniti
PAYMENT_TERMS = [
    {"code": "VISTA", "days": 0, "label": "A vista"},
    {"code": "30GG", "days": 30, "label": "30 giorni"},
    {"code": "30GGDFM", "days": 30, "label": "30 giorni data fattura fine mese"},
    {"code": "60GG", "days": 60, "label": "60 giorni"},
    {"code": "60GGDFM", "days": 60, "label": "60 giorni data fattura fine mese"},
    {"code": "90GG", "days": 90, "label": "90 giorni"},
    {"code": "120GG", "days": 120, "label": "120 giorni"},
]

# Metodi bancari che richiedono IBAN
METODI_BANCARI = ["bonifico", "assegno", "rid", "carta"]


def clean_mongo_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Rimuove _id da documento MongoDB."""
    if doc and "_id" in doc:
        doc.pop("_id", None)
    return doc
