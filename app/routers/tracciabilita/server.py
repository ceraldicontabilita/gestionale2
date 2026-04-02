"""Bridge DB: permette ai router tracciabilita di fare 'from server import db'"""
class DbProxy:
    """Lazy proxy che delega al database del gestionale al momento della chiamata."""
    def __getattr__(self, name):
        from app.database import Database
        return getattr(Database.get_db(), name)
    def __getitem__(self, name):
        from app.database import Database
        return Database.get_db()[name]

db = DbProxy()
