import os
from qdrant_client import QdrantClient
from openai import OpenAI
from dotenv import load_dotenv
import json

# Editable settings
gpt_version = 3.5
gpt_tokens = 512
gpt_temperature = 1
response_num = 7

# Gets settings from settings.json file
settings_path = os.path.expanduser("~/ProctorPath/settings.json")
with open(settings_path, 'r') as f:
    settings = json.load(f)
    database_ip = settings.get("database_ip")
    database_name = settings.get("database_name")

# Import hidden data from .env
load_dotenv()
YOUR_API_KEY = os.environ["OPENAI_API_KEY"]
admin_key = os.environ["admin_key"]

# Initialize clients
oclient = OpenAI(api_key=YOUR_API_KEY)
qclient = QdrantClient(database_ip, port=6333)
embeddings_model = oclient.embeddings.create

# Initilize lists/variables/session states 
filtered = []





# Temporary query input
query=input("Query:")

# Converts database query to vector 
embedded_query = embeddings_model(input = [query], model="text-embedding-3-large").data[0].embedding

# Get database output
database_response = qclient.search( 
    collection_name=database_name, query_vector=embedded_query, limit=response_num
)

# Filter database response (replace with valid json implimentation eventually)
def filtering(response):
    split_response = str(response).split(":")
    split_response = str(split_response[1]).split("}")
    return split_response[0].replace("\n", "")

for i in range(response_num):
    filtered.append(filtering(str(database_response[i])))

# Sets ChatGPT version
if gpt_version == 3.5:
    gpt_version = "gpt-3.5-turbo-0125"
elif gpt_version == 4:
    gpt_version = "gpt-4-turbo-preview"
elif str(gpt_version) == "4o":
    gpt_version = "gpt-4o"


# Gives ChatGPT api input from user, results from database, and context
messages = [{"role": "system", "content": f"""You are an assistant designed to answer questions about Proctor Academy. 
             It is ok if you cannot answer a question with the data given, but DO NOT make up answers when the information was not given to you in the context.
             Include only the parts of the context that are relevant to the user question. DO NOT answer questions that aren't about Proctor."""}, 
             {"role": "user", "content": f"""Here is some potentially relevant information, but not all of it will be usefull. 
             Generally, the infromation that comes earlier will be more relevant: {str(filtered)}. Here is the user query: {str(query)}"""}]

# Gets ChatGPT api response
streaming_reply = oclient.chat.completions.create(
    model = gpt_version, 
    messages = messages, 
    max_tokens = gpt_tokens, 
    temperature = gpt_temperature,
    stream = True
)

# Prints ChatGPT api response
print(streaming_reply)