
from motor.motor_asyncio import AsyncIOMotorClient # type: ignore
# from app.utils.load_helper import DATABASE_HOST,DATABASE_NAME
from app.config import DATABASE_HOST,DATABASE_NAME


print("Connecting to MongoDB database...")
print(f"Host: {DATABASE_HOST}"
      f"Database: {DATABASE_NAME}")
# Create a MongoDB client   
client = AsyncIOMotorClient(DATABASE_HOST)
# data database
database = client[DATABASE_NAME]
appointments_collection = database.appointments
doctors_collection = database.doctors

async def check_connection():
    try:
        await client.admin.command('ping')
        print("Connection to mongodb database!")
        return True
    except Exception as e:
        print("Failed to connect to MongoDB:", e)
        return False
    