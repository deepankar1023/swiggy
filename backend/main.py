from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
from google.api_core.exceptions import GoogleAPIError

import uuid
from dotenv import load_dotenv
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

# --- Configuration ---

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY not set")

genai.configure(api_key=GEMINI_API_KEY)
print("ENV LOADED:", os.getenv("GEMINI_API_KEY") is not None)
# Store active chat sessions
active_sessions = {}

app = FastAPI()

# --- CORS Settings ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- System Instruction ---
SYSTEM_INSTRUCTION = (
    "You are an imaginative, friendly, and kind storyteller writing a "
    "choose your own adventure story for children aged 6-10. "
    "Your language must be simple, positive, and fun. "
    "After each story segment, provide exactly two choices labeled "
    "A. and B. on a new line. "
    "If the user sends 'FINISH_STORY', write a complete happy ending."
)

# --- Pydantic Models ---
class StartStoryRequest(BaseModel):
    prompt: str

class ContinueStoryRequest(BaseModel):
    session_id: str
    choice: str

class StoryResponse(BaseModel):
    session_id: str
    story_segment: str
    is_final: bool = False

# --- API Endpoints ---

@app.post("/start_story", response_model=StoryResponse)
def start_story(request: StartStoryRequest):
    try:
        session_id = str(uuid.uuid4())

        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            system_instruction=SYSTEM_INSTRUCTION
        )

        chat = model.start_chat(history=[])
        active_sessions[session_id] = chat

        response = chat.send_message(request.prompt)

        print("RAW RESPONSE:", response)
        print("TEXT:", response.text)

        if not response.text:
            raise RuntimeError("Empty response from Gemini")

        return StoryResponse(
            session_id=session_id,
            story_segment=response.text
        )

    except Exception as e:
        print("ERROR IN /start_story:", repr(e))
        raise HTTPException(status_code=500, detail=str(e))



@app.post("/continue_story", response_model=StoryResponse)
def continue_story(request: ContinueStoryRequest):
    chat = active_sessions.get(request.session_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Story session not found")

    is_final = request.choice == "FINISH"
    message = "FINISH_STORY" if is_final else request.choice

    try:
        response = chat.send_message(message)

        if is_final:
            del active_sessions[request.session_id]

        return StoryResponse(
            session_id=request.session_id,
            story_segment=response.text,
            is_final=is_final
        )

    except GoogleAPIError as e:
        raise HTTPException(status_code=500, detail=f"Gemini API Error: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
