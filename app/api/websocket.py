from fastapi import WebSocket
from ..services.openai_service import connect_to_openai_websocket

async def websocket_proxy_handler(websocket: WebSocket):
    """Proxy WebSocket connections to the OpenAI Realtime API"""
    await websocket.accept()
    
    try:
        # Get configuration from the client
        config = await websocket.receive_json()
        model = config.get("model", "gpt-4o-realtime-preview-2024-12-17")
        system_prompt = config.get("system_prompt")
        
        # Connect to OpenAI Realtime API
        await connect_to_openai_websocket(websocket, model, system_prompt)
        
    except Exception as e:
        await websocket.close(code=1011, reason=f"Error: {str(e)}")