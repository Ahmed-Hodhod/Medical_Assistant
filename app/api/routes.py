from fastapi import APIRouter
from ..models.schemas import SessionRequest
from ..services.openai_service import create_openai_session

router = APIRouter()

@router.post("/api/sessions")
async def create_session(session_request: SessionRequest):
    """Create an ephemeral session token for WebRTC client use"""
    return await create_openai_session(
        session_request.model, 
        session_request.voice,
        session_request.system_prompt
    )

# Add a simple health check endpoint
@router.get("/api/health")
async def health_check():
    return {"status": "ok"}