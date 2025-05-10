# from datetime import datetime
# from bson import ObjectId


# fake_doctors = [
#     {
#         "name": "Dr. Alice Johnson",
#         "email": "alice@example.com",
#         "specialization": "General Dentist",
#         "availability": [
#             {
#                 "day_of_week": 0,  # Monday
#                 "time_slots": [
#                     {"start_time": "09:00:00", "end_time": "12:00:00"},
#                     {"start_time": "13:00:00", "end_time": "17:00:00"}
#                 ]
#             },
#             {
#                 "day_of_week": 2,  # Wednesday
#                 "time_slots": [
#                     {"start_time": "10:00:00", "end_time": "18:00:00"}
#                 ]
#             }
#         ],
#         "created_at": datetime.now(),
#         "updated_at": datetime.now()
#     },
#     {
#         "name": "Dr. Bob Smith",
#         "email": "bob@example.com",
#         "specialization": "General Dentist",
#         "availability": [
#             {
#                 "day_of_week": 1,  # Tuesday
#                 "time_slots": [
#                     {"start_time": "08:00:00", "end_time": "16:00:00"}
#                 ]
#             },
#             {
#                 "day_of_week": 4,  # Friday
#                 "time_slots": [
#                     {"start_time": "09:00:00", "end_time": "12:00:00"},
#                     {"start_time": "13:00:00", "end_time": "15:00:00"}
#                 ]
#             }
#         ],
#         "created_at": datetime.now(),
#         "updated_at": datetime.now()
#     }
# ]

# from datetime import date, time
# from bson import ObjectId

# fake_appointments = [
#     {
#         "doctor_id": ObjectId("660000000000000000000001"),  # Replace with actual doctor ObjectId if needed
#         "patient_name": "John Doe",
#         "patient_email": "john.doe@example.com",
#         "appointment_date": date(2025, 4, 3).isoformat(),  # April 3rd, 2025
#         "start_time": time(10, 0, 0).isoformat(),
#         "end_time": time(10, 30, 0).isoformat(),
#         "reason": "Routine checkup",
#         "status": "confirmed",
#         "created_at": datetime.now(),
#         "updated_at": datetime.now()
#     },
#     {
#         "doctor_id": ObjectId("660000000000000000000002"),
#         "patient_name": "Jane Smith",
#         "patient_email": "jane.smith@example.com",
#         "appointment_date": date(2025, 4, 5).isoformat(),
#         "start_time": time(14, 0, 0).isoformat(),
#         "end_time": time(14, 30, 0).isoformat(),
#         "reason": "Tooth extraction",
#         "status": "pending",
#         "created_at": datetime.now(),
#         "updated_at": datetime.now()
#     }
# ]

# from motor.motor_asyncio import AsyncIOMotorClient


# client = AsyncIOMotorClient(DATABASE_HOST)
# # data database
# database = client[DATABASE_NAME]
# appointments_collection = database.appointments
# doctors_collection = database.doctors

# async def insert_fake_data():
#     # Insert doctors
#     await doctors_collection.delete_many({})  # Optional: clear existing
#     print("Inserting fake doctors...")
#     await doctors_collection.insert_many(fake_doctors)
    
#     # Insert appointments
#     await appointments_collection.delete_many({})
#     print("Inserting fake appointments...")
#     await appointments_collection.insert_many(fake_appointments)

#     print("✅ Fake data inserted successfully.")


# import asyncio

# if __name__ == "__main__":
#     asyncio.run(insert_fake_data())