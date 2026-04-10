# F24 Module - Gestione F24 e Riconciliazione
# ============================================
# Router ATTIVI nel main.py:
#   f24_main          → /api/f24/*          (CRUD principale)
#   f24_riconciliazione → /api/f24-riconciliazione/*
#   f24_public        → /api/f24-public/*
#   quietanze         → /api/quietanze-f24/*
#   email_f24         → scarica F24 da email
#   f24_gestione_avanzata → /api/f24-avanzato/* (commentato — da valutare)
#
# Router COMMENTATI nel main (conflitto path con f24_main su /api/f24):
#   f24_tributi       → stessa funzione di f24_main, commentato per evitare collisioni
#   accounting_f24    → stessa funzione di f24_main, commentato per evitare collisioni

from . import f24_main
from . import f24_riconciliazione
from . import f24_tributi        # file presente ma router NON registrato nel main
from . import f24_public
from . import quietanze
from . import email_f24
from . import f24_gestione_avanzata  # file presente ma router NON registrato nel main

__all__ = [
    'f24_main',
    'f24_riconciliazione',
    'f24_public',
    'quietanze',
    'email_f24',
]
