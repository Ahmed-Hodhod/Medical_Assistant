
from typing import List, Optional, Dict, Any
from datetime import datetime, time, date
from fastapi import Body, HTTPException, APIRouter, Path, Query
from pydantic import BaseModel, Field, EmailStr, validator
from app.models.appoinments import AppointmentCreate, AppointmentResponse, AppointmentStatus, AppointmentUpdate, DentalSpecialization, DoctorResponse, DoctorUpdate
from bson import ObjectId
from app.database import appointments_collection ,doctors_collection



# Initialize router
router = APIRouter()

# Helper functions
async def get_doctor_or_404(doctor_id: str):
    doctor = await doctors_collection.find_one({"_id": ObjectId(doctor_id)})
    if doctor is None:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return doctor

async def get_appointment_or_404(appointment_id: str):
    appointment = await appointments_collection.find_one({"_id": ObjectId(appointment_id)})
    if appointment is None:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appointment

async def check_doctor_availability(doctor_id: str, appointment_date: date, start_time: time, end_time: time):
    # Check if the doctor exists
    doctor = await get_doctor_or_404(doctor_id)
    
    # Check if the appointment date falls on one of the doctor's available days
    day_of_week = appointment_date.weekday()  # 0 is Monday, 6 is Sunday
    
    doctor_available_on_day = False
    doctor_available_at_time = False
    
    for schedule in doctor.get("availability", []):
        if schedule["day_of_week"] == day_of_week:
            doctor_available_on_day = True
            for slot in schedule["time_slots"]:
                slot_start = datetime.strptime(slot["start_time"], "%H:%M:%S").time()
                slot_end = datetime.strptime(slot["end_time"], "%H:%M:%S").time()
                
                if slot_start <= start_time and end_time <= slot_end:
                    doctor_available_at_time = True
                    break
    
    if not doctor_available_on_day:
        raise HTTPException(
            status_code=400, 
            detail=f"Doctor is not available on this day (day {day_of_week})"
        )
    
    if not doctor_available_at_time:
        raise HTTPException(
            status_code=400, 
            detail="Doctor is not available during this time slot"
        )
    
    # Check for overlapping appointments
    existing_appointment = await appointments_collection.find_one({
        "doctor_id": ObjectId(doctor_id),
        "appointment_date": appointment_date.isoformat(),
        "status": {"$nin": [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW]},
        "$or": [
            # New appointment starts during an existing appointment
            {"start_time": {"$lte": start_time.isoformat()}, "end_time": {"$gt": start_time.isoformat()}},
            # New appointment ends during an existing appointment
            {"start_time": {"$lt": end_time.isoformat()}, "end_time": {"$gte": end_time.isoformat()}},
            # New appointment contains an existing appointment
            {"start_time": {"$gte": start_time.isoformat()}, "end_time": {"$lte": end_time.isoformat()}}
        ]
    })
    
    if existing_appointment:
        raise HTTPException(
            status_code=400,
            detail="This time slot is already booked"
        )
    
    return True

# API Endpoints for Doctors
@router.post("/doctors/", response_model=DoctorResponse, status_code=201)
async def create_doctor(doctor: str= Body(...)):
    doctor_dict = doctor.dict()
    
    # Check if a doctor with the same email already exists
    existing_doctor = await doctors_collection.find_one({"email": doctor_dict["email"]})
    if existing_doctor:
        raise HTTPException(
            status_code=400,
            detail="A doctor with this email already exists"
        )
    
    # Add timestamps
    doctor_dict["created_at"] = datetime.now()
    doctor_dict["updated_at"] = datetime.now()
    
    # Insert into database
    result = await doctors_collection.insert_one(doctor_dict)
    
    # Return created doctor
    created_doctor = await doctors_collection.find_one({"_id": result.inserted_id})
    created_doctor["id"] = str(created_doctor["_id"])
    
    return created_doctor

@router.get("/doctors/", response_model=List[DoctorResponse])
async def list_doctors(
    specialization: Optional[DentalSpecialization] = None,
    skip: int = 0,
    limit: int = 100
):
    query = {}
    if specialization:
        query["specialization"] = specialization
    
    doctors = []
    cursor = doctors_collection.find(query).skip(skip).limit(limit)
    async for doctor in cursor:
        doctor["id"] = str(doctor["_id"])
        doctors.append(doctor)
    
    return doctors

@router.get("/doctors/{doctor_id}", response_model=DoctorResponse)
async def get_doctor(doctor_id: str = Path(...)):
    doctor = await get_doctor_or_404(doctor_id)
    doctor["id"] = str(doctor["_id"])
    return doctor

@router.patch("/doctors/{doctor_id}", response_model=DoctorResponse)
async def update_doctor(
    doctor_id: str = Path(...),
    doctor_update: DoctorUpdate = Body(...)
):
    # Check if doctor exists
    await get_doctor_or_404(doctor_id)
    
    # Filter out None values
    update_data = {k: v for k, v in doctor_update.dict().items() if v is not None}
    
    # If there's nothing to update, return the doctor as is
    if not update_data:
        doctor = await get_doctor_or_404(doctor_id)
        doctor["id"] = str(doctor["_id"])
        return doctor
    
    # Add updated_at timestamp
    update_data["updated_at"] = datetime.now()
    
    # Update doctor
    await doctors_collection.update_one(
        {"_id": ObjectId(doctor_id)},
        {"$set": update_data}
    )
    
    # Return updated doctor
    updated_doctor = await get_doctor_or_404(doctor_id)
    updated_doctor["id"] = str(updated_doctor["_id"])
    
    return updated_doctor

@router.delete("/doctors/{doctor_id}", status_code=204)
async def delete_doctor(doctor_id: str = Path(...)):
    # Check if doctor exists
    await get_doctor_or_404(doctor_id)
    
    # Check if doctor has any associated appointments
    appointment_count = await appointments_collection.count_documents({"doctor_id": ObjectId(doctor_id)})
    
    if appointment_count > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete doctor with existing appointments"
        )
    
    # Delete doctor
    await doctors_collection.delete_one({"_id": ObjectId(doctor_id)})
    
    return None

# API Endpoints for Appointments
@router.post("/appointments/", response_model=AppointmentResponse, status_code=201)
async def create_appointment(appointment: AppointmentCreate = Body(...)):
    appointment_dict = appointment.dict()
    
    # Convert doctor_id to ObjectId
    doctor_id = str(appointment_dict["doctor_id"])
    appointment_dict["doctor_id"] = ObjectId(doctor_id)
    
    # Check doctor availability
    await check_doctor_availability(
        doctor_id=doctor_id,
        appointment_date=appointment_dict["appointment_date"],
        start_time=appointment_dict["start_time"],
        end_time=appointment_dict["end_time"]
    )
    
    # Add timestamps
    appointment_dict["created_at"] = datetime.now()
    appointment_dict["updated_at"] = datetime.now()
    
    # Insert into database
    result = await appointments_collection.insert_one(appointment_dict)
    
    # Return created appointment
    created_appointment = await appointments_collection.find_one({"_id": result.inserted_id})
    created_appointment["id"] = str(created_appointment["_id"])
    
    # Add doctor information
    doctor = await get_doctor_or_404(doctor_id)
    created_appointment["doctor"] = {
        "id": doctor_id,
        "name": doctor["name"],
        "specialization": doctor["specialization"]
    }
    
    return created_appointment

@router.get("/appointments/", response_model=List[AppointmentResponse])
async def list_appointments(
    doctor_id: Optional[str] = None,
    patient_email: Optional[str] = None,
    appointment_date: Optional[date] = None,
    status: Optional[AppointmentStatus] = None,
    skip: int = 0,
    limit: int = 100
):
    query = {}
    
    if doctor_id:
        query["doctor_id"] = ObjectId(doctor_id)
    
    if patient_email:
        query["patient_email"] = patient_email
    
    if appointment_date:
        query["appointment_date"] = appointment_date.isoformat()
    
    if status:
        query["status"] = status
    
    appointments = []
    cursor = appointments_collection.find(query).skip(skip).limit(limit)
    
    async for appointment in cursor:
        appointment["id"] = str(appointment["_id"])
        
        # Add doctor information
        doctor = await doctors_collection.find_one({"_id": appointment["doctor_id"]})
        if doctor:
            appointment["doctor"] = {
                "id": str(doctor["_id"]),
                "name": doctor["name"],
                "specialization": doctor["specialization"]
            }
        
        appointments.append(appointment)
    
    return appointments

@router.get("/appointments/{appointment_id}", response_model=AppointmentResponse)
async def get_appointment(appointment_id: str = Path(...)):
    appointment = await get_appointment_or_404(appointment_id)
    appointment["id"] = str(appointment["_id"])
    
    # Add doctor information
    doctor = await doctors_collection.find_one({"_id": appointment["doctor_id"]})
    if doctor:
        appointment["doctor"] = {
            "id": str(doctor["_id"]),
            "name": doctor["name"],
            "specialization": doctor["specialization"]
        }
    
    return appointment

@router.patch("/appointments/{appointment_id}", response_model=AppointmentResponse)
async def update_appointment(
    appointment_id: str = Path(...),
    appointment_update: AppointmentUpdate = Body(...)
):
    # Check if appointment exists
    appointment = await get_appointment_or_404(appointment_id)
    
    # Filter out None values
    update_data = {k: v for k, v in appointment_update.dict().items() if v is not None}
    
    # If there's nothing to update, return the appointment as is
    if not update_data:
        appointment = await get_appointment_or_404(appointment_id)
        appointment["id"] = str(appointment["_id"])
        return appointment
    
    # Check availability if appointment time is being updated
    if "appointment_date" in update_data or "start_time" in update_data or "end_time" in update_data:
        appointment_date = update_data.get("appointment_date", appointment["appointment_date"])
        start_time = update_data.get("start_time", appointment["start_time"])
        end_time = update_data.get("end_time", appointment["end_time"])
        
        if isinstance(appointment_date, str):
            appointment_date = date.fromisoformat(appointment_date)
        
        if isinstance(start_time, str):
            start_time = datetime.strptime(start_time, "%H:%M:%S").time()
        
        if isinstance(end_time, str):
            end_time = datetime.strptime(end_time, "%H:%M:%S").time()
        
        # Only check availability if the appointment is still active
        if appointment["status"] not in [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW]:
            await check_doctor_availability(
                doctor_id=str(appointment["doctor_id"]),
                appointment_date=appointment_date,
                start_time=start_time,
                end_time=end_time
            )
    
    # Add updated_at timestamp
    update_data["updated_at"] = datetime.now()
    
    # Update appointment
    await appointments_collection.update_one(
        {"_id": ObjectId(appointment_id)},
        {"$set": update_data}
    )
    
    # Return updated appointment
    updated_appointment = await get_appointment_or_404(appointment_id)
    updated_appointment["id"] = str(updated_appointment["_id"])
    
    # Add doctor information
    doctor = await doctors_collection.find_one({"_id": updated_appointment["doctor_id"]})
    if doctor:
        updated_appointment["doctor"] = {
            "id": str(doctor["_id"]),
            "name": doctor["name"],
            "specialization": doctor["specialization"]
        }
    
    return updated_appointment

@router.delete("/appointments/{appointment_id}", status_code=204)
async def delete_appointment(appointment_id: str = Path(...)):
    # Check if appointment exists
    await get_appointment_or_404(appointment_id)
    
    # Delete appointment
    await appointments_collection.delete_one({"_id": ObjectId(appointment_id)})
    
    return None

# API Endpoint for doctor availability
@router.get("/doctors/{doctor_id}/availability", response_model=List[Dict[str, Any]])
async def get_doctor_availability(
    doctor_id: str = Path(...),
    start_date: date = Query(...),
    end_date: date = Query(...)
):
    # Check if doctor exists
    doctor = await get_doctor_or_404(doctor_id)
    
    # Calculate number of days
    delta = end_date - start_date
    
    availability_slots = []
    
    # For each day in the range
    for day in range(delta.days + 1):
        current_date = start_date + datetime.timedelta(days=day)
        day_of_week = current_date.weekday()
        
        # Find if the doctor works on this day
        day_schedule = None
        for schedule in doctor.get("availability", []):
            if schedule["day_of_week"] == day_of_week:
                day_schedule = schedule
                break
        
        if day_schedule:
            # Get all appointments for this doctor on this day
            appointments = []
            cursor = appointments_collection.find({
                "doctor_id": ObjectId(doctor_id),
                "appointment_date": current_date.isoformat(),
                "status": {"$nin": [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW]}
            })
            
            async for appointment in cursor:
                appointments.append({
                    "start_time": appointment["start_time"],
                    "end_time": appointment["end_time"]
                })
            
            # For each time slot, calculate available slots
            for slot in day_schedule["time_slots"]:
                slot_start = datetime.strptime(slot["start_time"], "%H:%M:%S").time()
                slot_end = datetime.strptime(slot["end_time"], "%H:%M:%S").time()
                
                # Default slot is available
                available_slot = {
                    "date": current_date.isoformat(),
                    "start_time": slot_start.isoformat(),
                    "end_time": slot_end.isoformat(),
                    "is_available": True
                }
                
                # Check if any appointment overlaps with this slot
                for appointment in appointments:
                    appt_start = datetime.strptime(appointment["start_time"], "%H:%M:%S").time()
                    appt_end = datetime.strptime(appointment["end_time"], "%H:%M:%S").time()
                    
                    # Check if appointment overlaps with the slot
                    if not (appt_end <= slot_start or appt_start >= slot_end):
                        available_slot["is_available"] = False
                        break
                
                availability_slots.append(available_slot)
    
    return availability_slots
