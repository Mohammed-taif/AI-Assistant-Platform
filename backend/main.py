from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import Groq
from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from uuid import uuid4

from database import Base, engine, SessionLocal
from models import ChatMessage, User, Conversation

import os

# ------------------------
# DB INIT
# ------------------------
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ------------------------
# ENV + AI CLIENT
# ------------------------
load_dotenv()

client = Groq(
    api_key=os.getenv("GROQ_API_KEY")
)

# ACTIVE AI REQUESTS
active_generations = {}

# ------------------------
# APP SETUP
# ------------------------
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------
# AUTH CONFIG
# ------------------------
SECRET_KEY = "mysecretkey123"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

security = HTTPBearer()

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)

# ------------------------
# REQUEST MODELS
# ------------------------
class RegisterRequest(BaseModel):
    username: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class ChatRequest(BaseModel):
    message: str

# ------------------------
# JWT HELPERS
# ------------------------
def create_token(data: dict):

    to_encode = data.copy()

    expire = datetime.utcnow() + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    to_encode.update({
        "exp": expire
    })

    return jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

def verify_token(token: str):

    try:

        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        return payload.get("sub")

    except JWTError:
        return None

def get_current_user(
    credentials: HTTPAuthorizationCredentials =
    Depends(security)
):

    token = credentials.credentials

    username = verify_token(token)

    if not username:

        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )

    return username

# ------------------------
# ROOT
# ------------------------
@app.get("/")
def root():

    return {
        "message": "AI Assistant Backend Running"
    }

# ------------------------
# REGISTER
# ------------------------
@app.post("/register")
def register(
    req: RegisterRequest,
    db: Session = Depends(get_db)
):

    user = db.query(User).filter(
        User.username == req.username
    ).first()

    if user:

        return {
            "error": "Username already exists"
        }

    new_user = User(
        username=req.username,
        password=pwd_context.hash(req.password)
    )

    db.add(new_user)

    db.commit()

    return {
        "message": "User registered successfully"
    }

# ------------------------
# LOGIN
# ------------------------
@app.post("/login")
def login(
    req: LoginRequest,
    db: Session = Depends(get_db)
):

    user = db.query(User).filter(
        User.username == req.username
    ).first()

    if not user:

        return {
            "error": "Invalid username"
        }

    if not pwd_context.verify(
        req.password,
        user.password
    ):

        return {
            "error": "Invalid password"
        }

    token = create_token({
        "sub": req.username
    })

    return {
        "access_token": token,
        "token_type": "bearer"
    }

# ------------------------
# CREATE CONVERSATION
# ------------------------
@app.post("/conversation/new")
def create_conversation(
    user: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    conv = Conversation(
        user_id=user,
        title="New Chat"
    )

    db.add(conv)

    db.commit()

    db.refresh(conv)

    return {
        "conversation_id": conv.id,
        "title": conv.title
    }

# ------------------------
# GET CONVERSATIONS
# ------------------------
@app.get("/conversations")
def get_conversations(
    user: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    convs = db.query(Conversation).filter(
        Conversation.user_id == user
    ).all()

    return [
        {
            "id": c.id,
            "title": c.title
        }
        for c in convs
    ]

# ------------------------
# GET SINGLE CONVERSATION
# ------------------------
@app.get("/conversation/{conversation_id}")
def get_messages(
    conversation_id: int,
    db: Session = Depends(get_db)
):

    messages = db.query(ChatMessage).filter(
        ChatMessage.conversation_id == conversation_id
    ).all()

    return [
        {
            "role": m.role,
            "content": m.content
        }
        for m in messages
    ]

# ------------------------
# CHAT
# ------------------------
@app.post("/chat")
def chat(
    req: ChatRequest,
    conversation_id: int | None = None,
    user: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    request_id = str(uuid4())

    active_generations[request_id] = True

    # CREATE CONVERSATION
    if not conversation_id:

        new_conv = Conversation(
            user_id=user,
            title=req.message[:30]
        )

        db.add(new_conv)

        db.commit()

        db.refresh(new_conv)

        conversation_id = new_conv.id

    # GET HISTORY
    history = db.query(ChatMessage).filter(
        ChatMessage.conversation_id == conversation_id
    ).all()

    messages = [
        {
            "role": "system",
            "content": """
You are an advanced AI assistant.

Rules:
- Give clear, clean, and structured responses
- Use markdown formatting properly
- Use code blocks with language names
- Explain concepts professionally
- Adapt naturally to user requests
"""
        }
    ]

    for msg in history:

        messages.append({
            "role": msg.role,
            "content": msg.content
        })

    messages.append({
        "role": "user",
        "content": req.message
    })

    # SAVE USER MESSAGE
    db.add(ChatMessage(
        user_id=user,
        conversation_id=conversation_id,
        role="user",
        content=req.message
    ))

    db.commit()

    # CHECK STOP
    if not active_generations.get(request_id):

        return {
            "reply": "",
            "stopped": True
        }

    # AI RESPONSE
    completion = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages
    )

    reply = completion.choices[0].message.content

    # SAVE AI MESSAGE
    db.add(ChatMessage(
        user_id=user,
        conversation_id=conversation_id,
        role="assistant",
        content=reply
    ))

    db.commit()

    # CLEAN MEMORY
    active_generations.pop(
        request_id,
        None
    )

    return {
        "reply": reply,
        "conversation_id": conversation_id,
        "request_id": request_id
    }

# ------------------------
# STOP AI GENERATION
# ------------------------
@app.post("/stop/{request_id}")
def stop_generation(request_id: str):

    active_generations[request_id] = False

    return {
        "message": "Generation stopped"
    }

# ------------------------
# CLEAR CHAT
# ------------------------
@app.delete("/clear-chat/{conversation_id}")
def clear_chat(
    conversation_id: int,
    db: Session = Depends(get_db)
):

    db.query(ChatMessage).filter(
        ChatMessage.conversation_id == conversation_id
    ).delete()

    db.commit()

    return {
        "message": "Chat cleared"
    }

# ------------------------
# DELETE CONVERSATION
# ------------------------
@app.delete("/conversation/{conversation_id}")
def delete_conversation(
    conversation_id: int,
    db: Session = Depends(get_db)
):

    db.query(ChatMessage).filter(
        ChatMessage.conversation_id == conversation_id
    ).delete()

    db.query(Conversation).filter(
        Conversation.id == conversation_id
    ).delete()

    db.commit()

    return {
        "message": "Conversation deleted"
    }