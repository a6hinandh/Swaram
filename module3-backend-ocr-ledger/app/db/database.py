import os
from pathlib import Path
from dotenv import load_dotenv
from pymongo import MongoClient, ASCENDING
from pymongo.errors import ConnectionFailure, OperationFailure

# Load .env from module dir or root project dir
env_path_root = Path(__file__).resolve().parent.parent.parent.parent / ".env"
env_path_module = Path(__file__).resolve().parent.parent.parent / ".env"

if env_path_root.exists():
    load_dotenv(dotenv_path=env_path_root)
elif env_path_module.exists():
    load_dotenv(dotenv_path=env_path_module)
else:
    load_dotenv()

MONGO_URI = os.getenv("MONGODB_URL") or os.getenv("MONGO_URI") or "mongodb://localhost:27017"

client = None
db = None
encounters_col = None
households_col = None
visits_col = None
care_ledgers_col = None
environmental_assessments_col = None

try:
    print(f"[MongoDB] Initializing connection to: {MONGO_URI.split('@')[-1] if '@' in MONGO_URI else MONGO_URI}...")
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    # Check connection
    client.admin.command('ping')
    db = client["swaram_db"]

    encounters_col = db["clinical_encounters"]
    households_col = db["households"]
    visits_col = db["visits"]
    care_ledgers_col = db["care_ledgers"]
    environmental_assessments_col = db["environmental_assessments"]

    # Setup indexes
    encounters_col.create_index([("visit.visit_id", ASCENDING)], unique=True)
    encounters_col.create_index([("visit.household_id", ASCENDING)])
    encounters_col.create_index([("person.person_id", ASCENDING)])
    encounters_col.create_index([("visit.date", ASCENDING)])

    households_col.create_index([("id", ASCENDING)], unique=True)
    visits_col.create_index([("visit_id", ASCENDING)], unique=True)
    environmental_assessments_col.create_index([("assessment_id", ASCENDING)], unique=True)
    environmental_assessments_col.create_index([("household_id", ASCENDING)])
    environmental_assessments_col.create_index([("timestamp", ASCENDING)])

    print("[MongoDB] Successfully connected to MongoDB database 'swaram_db' with all indexes ready.")
except (ConnectionFailure, OperationFailure, Exception) as e:
    print(f"[MongoDB] Warning: Could not connect to live MongoDB ({e}). Running with in-memory fallback store.")
    client = None
    db = None
    encounters_col = None
    households_col = None
    visits_col = None
    care_ledgers_col = None
    environmental_assessments_col = None
