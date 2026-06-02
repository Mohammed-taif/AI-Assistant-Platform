from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class ChatRequest(BaseModel):
    message: str

@app.get("/")
def root():
    return {"message": "AI Assistant Backend Running"}

@app.post("/chat")
def chat(request: ChatRequest):

    msg = request.message.lower()

    if "hello" in msg:
        return {"reply": "Hello! How can I help you today?"}

    elif "bye" in msg:
        return {"reply": "Goodbye! Have a great day."}

    elif "how are you" in msg:
        return {"reply": "I'm doing well, thank you for asking."}

    else:
        return {"reply": "I'm still learning. Can you rephrase that?"}