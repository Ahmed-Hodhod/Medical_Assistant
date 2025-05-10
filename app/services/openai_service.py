import datetime
from typing import Optional
from bson import ObjectId
import httpx
from fastapi import HTTPException, WebSocket
import json
import asyncio
import websockets

from app.endpoints.appoinments_routes import check_doctor_availability, get_doctor_or_404
from ..config import ARABIC_SYSTEM_PROMPT, OPENAI_API_KEY
from app.database import doctors_collection ,appointments_collection

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
    
# Sample data to inject into prompt
doctors = [
    {
        "id": "60d5ec49fbd8621e4023a7b1",
        "name": "دكتور أحمد",
        "specialization": "ORTHODONTICS",
        "availability": [
            {
                "day_of_week": 0,  # Monday
                "time_slots": [
                    {"start_time": "09:00:00", "end_time": "12:00:00"},
                    {"start_time": "13:00:00", "end_time": "17:00:00"}
                ]
            },
            {
                "day_of_week": 2,  # Wednesday
                "time_slots": [
                    {"start_time": "10:00:00", "end_time": "18:00:00"}
                ]
            }
        ]
    },
    {
        "id": "60d5ec49fbd8621e4023a7b2",
        "name": "دكتورة سارة",
        "specialization": "PROSTHODONTICS",
        "availability": [
            {
                "day_of_week": 1,  # Tuesday
                "time_slots": [
                    {"start_time": "08:00:00", "end_time": "16:00:00"}
                ]
            },
            {
                "day_of_week": 4,  # Friday
                "time_slots": [
                    {"start_time": "09:00:00", "end_time": "12:00:00"},
                    {"start_time": "13:00:00", "end_time": "15:00:00"}
                ]
            }
        ]
    },
    {
        "id": "60d5ec49fbd8621e4023a7b3",
        "name": "دكتور محمد",
        "specialization": "ENDODONTICS",
        "availability": [
            {
                "day_of_week": 3,  # Thursday
                "time_slots": [
                    {"start_time": "10:00:00", "end_time": "14:00:00"}
                ]
            },
            {
                "day_of_week": 5,  # Saturday
                "time_slots": [
                    {"start_time": "09:00:00", "end_time": "13:00:00"}
                ]
            }
        ]
    }
]

appointments = [
    # Doctor Ahmed - Monday (Booked)
    {
        "doctor_id": "60d5ec49fbd8621e4023a7b1",
        "patient_email": "john@example.com",
        "appointment_date": "2025-04-07",  # Monday
        "start_time": "10:00:00",
        "end_time": "10:30:00",
        "status": "confirmed"
    },
    # Doctor Sara - Friday (Booked)
    {
        "doctor_id": "60d5ec49fbd8621e4023a7b2",
        "patient_email": "jane@example.com",
        "appointment_date": "2025-04-11",  # Friday
        "start_time": "10:00:00",
        "end_time": "10:30:00",
        "status": "confirmed"
    },
    # Doctor Mohamed - Thursday (Booked)
    {
        "doctor_id": "60d5ec49fbd8621e4023a7b3",
        "patient_email": "mike@example.com",
        "appointment_date": "2025-04-10",  # Thursday
        "start_time": "11:00:00",
        "end_time": "11:30:00",
        "status": "confirmed"
    }
]


ARABIC_SYSTEM_PROMPT = f"""
أنت مساعد طبي ذكي يتحدث باللهجة المصرية العامية، مهمتك هي مساعدة المرضى في حجز المواعيد الطبية بطريقة سهلة وودية. أنت متصل مباشرة بقاعدة بيانات الأطباء والمواعيد المتاحة.

### مهماتك الأساسية:
- فهم اسم الطبيب المفضل من المريض وتاريخ ووقت الحجز المرغوب فيه.
- التحقق من توفر الطبيب في قابة البيانات: إذا كان موجود أم لا.
- عرض الجدول الزمني لكل طبيب بناءً على يوم الحجز.
- إذا كان الوقت متاحًا، اعرض الخيارات للمريض واطلب تأكيد الحجز.
- بعد موافقة المريض، احجز الموعد بشكل رسمي عن طريق تحديث قاعدة البيانات.
- إذا لم يكن هناك وقت متاح أو الطبيب غير موجود، اقترح أطباء آخرين أو أيام أخرى.
- استخدم دائمًا لهجتنا العامية البسيطة مثل: "إزيك"، "عامل إيه"، "إن شاء الله"، "الحمد لله".
- كن لطيفًا ومتعاطفًا مع المرضى، خاصة إذا كانوا قلقين.
- تاكد ان تحجز فقط المواعيد المتاحة و الاطباء المتوفرين في بيانات الاطباء و بيانات المواعيد
### بيانات الأطباء:
{doctors}

### بيانات المواعيد:
{appointments}
"""

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "name": "search_doctor_by_name",
        "description": "ابحث عن الأطباء باستخدام الاسم أو التخصص.",
        "parameters": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "الاسم أو التخصص الذي يبحث عنه المريض"}
            },
            "required": ["name"]
        }
    },
    {
        "type": "function",
        "name": "get_doctor_availability",
        "description": "اعرض الجدول الزمني لطبيب في يوم معين.",
        "parameters": {
            "type": "object",
            "properties": {
                "doctor_id": {"type": "string"},
                "date": {"type": "string", "format": "date"}
            },
            "required": ["doctor_id", "date"]
        }
    },
    {
        "type": "function",
        "name": "book_appointment",
        "description": "احجز موعدًا بعد تأكيد المريض.",
        "parameters": {
            "type": "object",
            "properties": {
              
                "patient_email": {"type": "string"},
                "doctor_id": {"type": "string"},
                "patient_name": {"type": "string"},
                "appointment_date": {"type": "string", "format": "date"},
                "start_time": {"type": "string", "format": "time"},
                "end_time": {"type": "string", "format": "time"}
            },
            "required": ["doctor_id", "patient_email", "appointment_date", "start_time", "end_time"]
        }
    }
]


async def connect_to_openai_websocket(websocket: WebSocket, model: str, system_prompt: Optional[str] = None):
    """Proxy WebSocket connections to the OpenAI Realtime API"""
    openai_ws_url = f"wss://api.openai.com/v1/realtime?model={model}"
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "OpenAI-Beta": "realtime=v1"
    }

    try:
        async with websockets.connect(openai_ws_url, extra_headers=headers) as openai_ws:
            # Step 1: Set session instructions and tools
            session_update = {
                "type": "session.update",
                "session": {
                    "instructions": system_prompt or ARABIC_SYSTEM_PROMPT,
                    "tools": TOOL_DEFINITIONS,
                    "tool_choice": "auto"
                }
            }
            await openai_ws.send(json.dumps(session_update))

            # Step 2: Bi-directional message forwarding
            async def forward_to_client():
                while True:
                    message = await openai_ws.recv()
                    await websocket.send_text(message)

            async def forward_to_openai():
                while True:
                    message = await websocket.receive_text()
                    await openai_ws.send(message)

            # Step 3: Handle tool calls
            async def handle_tool_calls():
                while True:
                    try:
                        message = await openai_ws.recv()
                        data = json.loads(message)
                        
                        if data.get("type") == "tool_call":
                            tool_name = data["name"]
                            tool_params = data["content"]
                            call_id = data["id"]

                            print(f"[Tool Call] {tool_name} with params: {tool_params}")

                            try:
                                if tool_name == "search_doctor_by_name":
                                    name = tool_params["name"]
                                    cursor = doctors_collection.find({"$text": {"$search": name}})
                                    results = [doc async for doc in cursor]
                                    content = {"doctors": results}

                                elif tool_name == "get_doctor_availability":
                                    doctor_id = tool_params["doctor_id"]
                                    date_str = tool_params["date"]
                                    appointment_date = datetime.date.fromisoformat(date_str)
                                    day_of_week = appointment_date.weekday()

                                    doctor = await get_doctor_or_404(doctor_id)
                                    schedule = next((s for s in doctor.get("availability", []) if s["day_of_week"] == day_of_week), None)
                                    
                                    if not schedule:
                                        raise Exception(f"Doctor not available on day {day_of_week}")
                                    
                                    content = {
                                        "available_slots": schedule["time_slots"]
                                    }

                                elif tool_name == "book_appointment":
                                    doctor_id = tool_params["doctor_id"]
                                    patient_email = tool_params["patient_email"]
                                    appointment_date = datetime.date.fromisoformat(tool_params["appointment_date"])
                                    start_time = datetime.strptime(tool_params["start_time"], "%H:%M:%S").time()
                                    end_time = datetime.strptime(tool_params["end_time"], "%H:%M:%S").time()

                                    # Check availability
                                    await check_doctor_availability(doctor_id, appointment_date, start_time, end_time)

                                    # Insert into DB
                                    result = await appointments_collection.insert_one({
                                        "doctor_id": ObjectId(doctor_id),
                                        "patient_email": patient_email,
                                        "appointment_date": appointment_date.isoformat(),
                                        "start_time": start_time.isoformat(),
                                        "end_time": end_time.isoformat(),
                                        "status": "confirmed",
                                        "created_at": datetime.now()
                                    })

                                    content = {"status": "success", "message": "تم الحجز بنجاح!"}

                                else:
                                    content = {"error": "Unknown tool"}

                            except Exception as e:
                                content = {"error": str(e)}

                            # Respond to OpenAI
                            tool_response = {
                                "type": "tool_response",
                                "call_id": call_id,
                                "name": tool_name,
                                "content": content
                            }
                            await openai_ws.send(json.dumps(tool_response))

                    except Exception as e:
                        print(f"[Error in tool handler]: {e}")

            # Step 4: Run tasks concurrently
            forward_client_task = asyncio.create_task(forward_to_client())
            forward_openai_task = asyncio.create_task(forward_to_openai())
            tool_handler_task = asyncio.create_task(handle_tool_calls())

            done, pending = await asyncio.wait(
                [forward_client_task, forward_openai_task, tool_handler_task],
                return_when=asyncio.FIRST_COMPLETED
            )

            for task in pending:
                task.cancel()

    except Exception as e:
        await websocket.close(code=1011, reason=f"Connection error: {str(e)}")