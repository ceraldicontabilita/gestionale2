"""
Services — Gestionale Ceraldi Group
=====================================
Servizi core condivisi da tutti i router.
Ogni servizio ha una responsabilità singola.

- event_bus: orchestra la comunicazione tra moduli
- alert_engine: generazione/risoluzione alert centralizzata
- audit_logger: log unificato di ogni cambio stato
- deduplica: funzioni di verifica duplicati
- partite_aperte_engine: scadenziario materializzato
- riconciliazione_engine: scoring match mov↔partite
"""
