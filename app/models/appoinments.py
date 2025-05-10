from typing import List, Optional, Dict, Any
from datetime import datetime, time, date
from pydantic import BaseModel, Field, EmailStr, validator
from enum import Enum
from bson import ObjectId





# Specialization Enum for Dentists
class DentalSpecialization(str, Enum):
    GENERAL_DENTIST = "General Dentist"
    ORAL_SURGEON = "Oral Surgeon"
    PEDIATRIC_DENTIST = "Pediatric Dentist"


# Appointment Status Enum
class AppointmentStatus(str, Enum):
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"

# Base models
class TimeSlot(BaseModel):
    start_time: time
    end_time: time
    
    @validator('end_time')
    def end_time_must_be_after_start_time(cls, v, values):
        if 'start_time' in values and v <= values['start_time']:
            raise ValueError('end_time must be after start_time')
        return v

class AvailabilitySchedule(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6)  # 0 for Monday, 6 for Sunday
    time_slots: List[TimeSlot]

# Doctor Models
class DoctorBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(..., pattern=r"^\+?[0-9]{10,15}$")
    specialization: DentalSpecialization
    qualifications: List[str] = Field(default_factory=list)
    years_of_experience: int = Field(..., ge=0)
    bio: Optional[str] = None
    availability: List[AvailabilitySchedule] = Field(default_factory=list)

class DoctorCreate(DoctorBase):
    pass

class DoctorUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, pattern=r"^\+?[0-9]{10,15}$")
    specialization: Optional[DentalSpecialization] = None
    qualifications: Optional[List[str]] = None
    years_of_experience: Optional[int] = Field(None, ge=0)
    bio: Optional[str] = None
    availability: Optional[List[AvailabilitySchedule]] = None

class DoctorDB(DoctorBase):
    # id: str = Field(default_factory=ObjectId, alias="_id")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        # json_encoders = {
        #     ObjectId: str,
        #     datetime: lambda dt: dt.isoformat(),
        #     date: lambda d: d.isoformat(),
        #     time: lambda t: t.isoformat()
        # }

class DoctorResponse(DoctorBase):
    # id: ObjectId
    created_at: datetime
    updated_at: datetime

    # class Config:
    #     json_encoders = {
    #         datetime: lambda dt: dt.isoformat(),
    #         date: lambda d: d.isoformat(),
    #         time: lambda t: t.isoformat()
    #     }

# Appointment Models
class AppointmentBase(BaseModel):
    # doctor_id: ObjectId
    patient_name: str = Field(..., min_length=2, max_length=100)
    patient_email: EmailStr
    patient_phone: str = Field(..., pattern=r"^\+?[0-9]{10,15}$")
    appointment_date: date
    start_time: time
    end_time: time
    reason: str = Field(..., min_length=5, max_length=500)
    status: AppointmentStatus = Field(default=AppointmentStatus.SCHEDULED)
    notes: Optional[str] = None

    @validator('end_time')
    def end_time_must_be_after_start_time(cls, v, values):
        if 'start_time' in values and v <= values['start_time']:
            raise ValueError('end_time must be after start_time')
        return v

class AppointmentCreate(AppointmentBase):
    pass

class AppointmentUpdate(BaseModel):
    patient_name: Optional[str] = Field(None, min_length=2, max_length=100)
    patient_email: Optional[EmailStr] = None
    patient_phone: Optional[str] = Field(None, pattern=r"^\+?[0-9]{10,15}$")
    appointment_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    reason: Optional[str] = Field(None, min_length=5, max_length=500)
    status: Optional[AppointmentStatus] = None
    notes: Optional[str] = None

class AppointmentDB(AppointmentBase):
    # id: str = Field(default_factory=ObjectId, alias="_id")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        # json_encoders = {
        #     ObjectId: str,
        #     datetime: lambda dt: dt.isoformat(),
        #     date: lambda d: d.isoformat(),
        #     time: lambda t: t.isoformat()
        # }

class AppointmentResponse(AppointmentBase):
    # id: str
    created_at: datetime
    updated_at: datetime
    doctor: Optional[Dict[str, Any]] = None

    # class Config:
    #     json_encoders = {
    #         datetime: lambda dt: dt.isoformat(),
    #         date: lambda d: d.isoformat(),
    #         time: lambda t: t.isoformat()
    #     }