"""
Azienda in Cloud ERP - Backend Server Entry Point
This imports the FastAPI app from /app/app/main.py
"""
import sys
sys.path.insert(0, '/app')

from app.main import app

# Export app for uvicorn
__all__ = ['app']
# trigger reload Wed Feb 25 03:47:48 UTC 2026
