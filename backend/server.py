"""
Azienda in Cloud ERP - Backend Server Entry Point
This imports the FastAPI app from /app/app/main.py
"""
import sys
import os
sys.path.insert(0, '/app')

# Carica .env prima di tutto così os.environ.get("DB_NAME") funziona
# anche nei router che creano connessioni MongoDB proprie
try:
    from dotenv import load_dotenv
    load_dotenv('/app/backend/.env', override=False)
except ImportError:
    pass

from app.main import app

# Export app for uvicorn
__all__ = ['app']


# deploy trigger 2026-04-24T14:19:18Z
