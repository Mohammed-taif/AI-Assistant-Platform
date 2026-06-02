from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import Groq
from datetime import datetime
import os

# Load environment variables
load_dotenv()

# Groq client
client = Groq(
    api_key=os.getenv("GROQ_API_KEY")
)

# FastAPI app
app = FastAPI()

# Store conversation history in memory
chat_history = []

# Request model
class ChatRequest(BaseModel):
    message: str

@app.get("/")
def root():
    return {
        "message": "AI Assistant Backend Running"
    }

@app.post("/chat")
def chat(request: ChatRequest):
    try:
        # Save user message
        chat_history.append(
            {
                "role": "user",
                "content": request.message
            }
        )

        # Send history to AI
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": """
                    You are a helpful, accurate, and friendly AI assistant.

                    Provide clear and concise answers.
                    Explain concepts when needed.
                    Be honest when you do not know something.
                    Format longer answers in a readable way.
                    """
                }
            ] + chat_history
        )

        reply = completion.choices[0].message.content

        # Save AI reply
        chat_history.append(
            {
                "role": "assistant",
                "content": reply
            }
        )

        # Log chat to file
        with open("chat_logs.txt", "a") as f:
            f.write(
                f"{datetime.now()} | User: {request.message} | AI: {reply}\n\n"
            )

        return {
            "reply": reply
        }

    except Exception:
        return {
            "error": "The AI service is temporarily unavailable."
        }