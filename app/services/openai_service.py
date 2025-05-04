import httpx
from fastapi import HTTPException
import json
import asyncio
import websockets
from ..config import OPENAI_API_KEY

async def create_openai_session(model, voice, system_prompt=None):
    """Create an ephemeral session token for WebRTC client use"""
    try:
        # Prepare request payload
        payload = {
            "model": model,
            "voice": voice
        }
        
        # Add system prompt if provided
        if system_prompt:
            payload["instructions"] = system_prompt
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/realtime/sessions",
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=response.text)
                
            return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def connect_to_openai_websocket(websocket, model, system_prompt=None):
    """Proxy WebSocket connections to the OpenAI Realtime API"""
    try:
        # Connect to OpenAI Realtime API
        openai_ws_url = f"wss://api.openai.com/v1/realtime?model={model}"
        
        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "OpenAI-Beta": "realtime=v1"
        }
        
        async with websockets.connect(
            openai_ws_url,
            extra_headers=headers
        ) as openai_ws:
            # If system prompt provided, send session.update
            if system_prompt:
                session_update = {
                    "type": "session.update",
                    "session": {
                        "instructions": system_prompt
                    }
                }
                await openai_ws.send(json.dumps(session_update))
            
            # Bi-directional proxy between client and OpenAI
            async def forward_to_client():
                while True:
                    message = await openai_ws.recv()
                    await websocket.send_text(message)
            
            async def forward_to_openai():
                while True:
                    message = await websocket.receive_text()
                    await openai_ws.send(message)
            
            # Run both forwarding tasks concurrently
            forward_client_task = asyncio.create_task(forward_to_client())
            forward_openai_task = asyncio.create_task(forward_to_openai())
            
            # Wait for either task to complete (which likely means a disconnect)
            done, pending = await asyncio.wait(
                [forward_client_task, forward_openai_task],
                return_when=asyncio.FIRST_COMPLETED
            )
            
            # Cancel the remaining task
            for task in pending:
                task.cancel()
                
    except Exception as e:
        await websocket.close(code=1011, reason=f"Error: {str(e)}")