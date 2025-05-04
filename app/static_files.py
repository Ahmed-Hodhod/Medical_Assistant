from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

def mount_static_files(app: FastAPI) -> None:
    """
    Mount the static files directory to the FastAPI app
    """
    # Get the directory of this file
    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Path to the static directory
    static_dir = os.path.join(current_dir, "static")
    
    # Create the static directory if it doesn't exist
    os.makedirs(static_dir, exist_ok=True)
    
    # Mount the static directory
    app.mount("/static", StaticFiles(directory=static_dir), name="static")
    
    # Add a route to serve the index.html file
    @app.get("/", include_in_schema=False)
    async def serve_index():
        return FileResponse(os.path.join(static_dir, "index.html"))