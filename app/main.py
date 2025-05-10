from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import os
import uvicorn
import sys
from pathlib import Path

# # Add the parent directory to the path if running directly
# if __name__ == "__main__":
#     # Get the directory containing this file
#     file_path = Path(__file__).resolve()
#     # Add the parent directory of the 'app' directory to the Python path
#     parent_dir = file_path.parent.parent
#     sys.path.append(str(parent_dir))
from app.api.routes import router
from app.api.websocket import websocket_proxy_handler
from app.endpoints.appoinments_routes import router as appointments_router


# Create FastAPI application
app = FastAPI(title="OpenAI Realtime API Server")

# Configure CORS properly - this is important!
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development - replace with specific origins in production
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods including OPTIONS
    allow_headers=["*"],  # Allow all headers including Authorization, Content-Type, etc.
)

# Include routers
app.include_router(router, tags=["general"])
app.include_router(appointments_router, prefix="/api/v1", tags=["appointments and doctors"])

# WebSocket endpoint
@app.websocket("/ws/proxy")
async def websocket_proxy(websocket: WebSocket):
    await websocket_proxy_handler(websocket)

# Add this block to enable direct execution of this file
if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)