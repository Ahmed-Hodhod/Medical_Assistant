from pydantic import BaseModel

class SessionRequest(BaseModel):
    model: str = "gpt-4o-realtime-preview-2024-12-17"
    voice: str = "verse"
    system_prompt: str = None