"""
Admin router - Administrative operations and system management
"""

from fastapi import APIRouter, HTTPException, Request
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/gmail/import-documents")
async def trigger_document_import(request: Request):
    """
    Manually trigger email/document import from Gmail
    
    Returns:
        dict: Import results with processed count and errors
    """
    try:
        # Get scheduler instance from app state
        if not hasattr(request.app.state, 'scheduler'):
            raise HTTPException(status_code=500, detail="Scheduler not initialized")
        
        scheduler = request.app.state.scheduler
        
        # Trigger manual import
        result = await scheduler.trigger_email_import(username="admin_manual")
        
        return result
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error triggering document import: {e}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


@router.post("/gmail/import-f24")
async def trigger_f24_import(request: Request):
    """
    Manually trigger F24 import from Gmail
    
    Returns:
        dict: Import results with processed count and errors
    """
    try:
        # Get scheduler instance from app state
        if not hasattr(request.app.state, 'scheduler'):
            raise HTTPException(status_code=500, detail="Scheduler not initialized")
        
        scheduler = request.app.state.scheduler
        
        # Trigger manual import
        result = await scheduler.trigger_f24_import(username="admin_manual")
        
        return result
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error triggering F24 import: {e}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")
