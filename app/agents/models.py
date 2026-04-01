from pydantic import BaseModel
from typing import Optional, Dict, Any
from enum import Enum


class TipoSegnalazione(str, Enum):
    INFO = "info"
    AVVISO = "avviso"
    URGENTE = "urgente"
    ANOMALIA = "anomalia"
    SUGGERIMENTO = "suggerimento"
