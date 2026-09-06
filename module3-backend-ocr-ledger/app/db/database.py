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
vitals_baselines_col = None
actions_col = None
persons_col = None

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
    vitals_baselines_col = db["vitals_baselines"]
    actions_col = db["actions"]
    persons_col = db["persons"]
    cbac_surveys_col = db["cbac_surveys"]

    # Setup indexes
    encounters_col.create_index([("visit.visit_id", ASCENDING)], unique=True)
    encounters_col.create_index([("visit.household_id", ASCENDING)])
    encounters_col.create_index([("person.person_id", ASCENDING)])
    encounters_col.create_index([("visit.date", ASCENDING)])
    encounters_col.create_index([("person.person_id", ASCENDING), ("visit.date", -1)])

    households_col.create_index([("id", ASCENDING)], unique=True)
    households_col.create_index([("priority_score", -1)])

    visits_col.create_index([("visit_id", ASCENDING)], unique=True)
    environmental_assessments_col.create_index([("assessment_id", ASCENDING)], unique=True)
    environmental_assessments_col.create_index([("household_id", ASCENDING)])
    environmental_assessments_col.create_index([("timestamp", ASCENDING)])

    vitals_baselines_col.create_index([("person_id", ASCENDING)], unique=True)
    vitals_baselines_col.create_index([("household_id", ASCENDING)])
    vitals_baselines_col.create_index([("latest_delta_analysis.severity", ASCENDING)])
    vitals_baselines_col.create_index([("updated_at", ASCENDING)])

    care_ledgers_col.create_index([("household_id", ASCENDING)], unique=True)
    care_ledgers_col.create_index([("priority_score", -1)])

    actions_col.create_index([("action_id", ASCENDING)], unique=True)
    actions_col.create_index([("household_id", ASCENDING)])

    persons_col.create_index([("person_id", ASCENDING)], unique=True)
    persons_col.create_index([("household_id", ASCENDING)])

    cbac_surveys_col.create_index([("survey_id", ASCENDING)], unique=True)
    cbac_surveys_col.create_index([("beneficiary_id", ASCENDING)])
    cbac_surveys_col.create_index([("household_id", ASCENDING)])
    cbac_surveys_col.create_index([("timestamp", -1)])

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
    vitals_baselines_col = None
    actions_col = None
    persons_col = None
    cbac_surveys_col = None
