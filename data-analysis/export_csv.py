from pymongo import MongoClient
import pandas as pd

DATABASE_ADDRESS = "localhost"
DATABASE_NAME = "test"
COLLECTION_NAMES = ["leaderboardapps", "matchapps", "pitapps", "superapps"]


# Create a MongoDB database client
client = MongoClient(f"mongodb://{DATABASE_ADDRESS}:27017")

# Connect to our database
db = client[DATABASE_NAME]

# Extract data from each of our collections
for c in COLLECTION_NAMES:
    # Pull data from the collection
    mongo_collection = db[c]

    # Normalize the JSON from the MongoDB database into a sheets-like table
    df = pd.json_normalize(mongo_collection.find())

    # Export the sheets-like table as a CSV file
    df.to_csv(f"{c}.csv")

    print(f"Generated file '{__file__}' successfully!")
