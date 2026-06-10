from fastapi import FastAPI, HTTPException, Depends, File, UploadFile
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
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
import random
import os

from database import Base, engine, SessionLocal
from models import ChatMessage, User, Conversation

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

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# ------------------------
# EMAIL CONFIG
# ------------------------
mail_config = ConnectionConfig(
    MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
    MAIL_FROM=os.getenv("MAIL_FROM"),
    MAIL_PORT=587,
    MAIL_SERVER="smtp.gmail.com",
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True
)

fastmail = FastMail(mail_config)

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
SECRET_KEY = os.getenv("SECRET_KEY", "mysecretkey123")
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
    email: str

class LoginRequest(BaseModel):
    username: str
    password: str

class VerifyRequest(BaseModel):
    username: str
    code: str

class ResendRequest(BaseModel):
    username: str

class ChatRequest(BaseModel):
    message: str
    conversation_id: int | None = None

class SavePartialRequest(BaseModel):
    conversation_id: int
    content: str

# ------------------------
# JWT HELPERS
# ------------------------
def create_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials
    username = verify_token(token)
    if not username:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return username

# ------------------------
# ROOT
# ------------------------
@app.get("/")
def root():
    return {"message": "AI Assistant Backend Running"}

# ------------------------
# REGISTER
# ------------------------
@app.post("/register")
async def register(
    req: RegisterRequest,
    db: Session = Depends(get_db)
):
    # Check username exists
    if db.query(User).filter(User.username == req.username).first():
        return {"error": "Username already exists"}

    # Check email exists
    if db.query(User).filter(User.email == req.email).first():
        return {"error": "Email already registered"}

    # Generate 6 digit code
    code = str(random.randint(100000, 999999))
    expires = datetime.utcnow() + timedelta(minutes=5)

    # Save user as unverified
    new_user = User(
        username=req.username,
        password=pwd_context.hash(req.password),
        email=req.email,
        is_verified=False,
        verification_code=code,
        code_expires_at=expires
    )

    db.add(new_user)
    db.commit()

    # Send verification email
    message = MessageSchema(
        subject="Your Verification Code — AI Assistant",
        recipients=[req.email],
        body=f"""
        <div style="font-family: Arial, sans-serif; max-width: 400px; margin: auto; padding: 30px; background: #1e293b; border-radius: 12px; color: white;">
            <h2 style="color: #3b82f6;">Welcome to AI Assistant!</h2>
            <p>Hi <strong>{req.username}</strong>,</p>
            <p>Your verification code is:</p>
            <h1 style="color: #3b82f6; letter-spacing: 12px; font-size: 40px;">{code}</h1>
            <p>This code expires in <strong>5 minutes</strong>.</p>
            <p style="color: #94a3b8;">If you didn't register, ignore this email.</p>
        </div>
        """,
        subtype="html"
    )

    await fastmail.send_message(message)

    return {"message": "Verification code sent to your email"}

# ------------------------
# VERIFY EMAIL
# ------------------------
@app.post("/verify")
def verify(
    req: VerifyRequest,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.username == req.username).first()

    if not user:
        return {"error": "User not found"}

    if user.is_verified:
        return {"error": "Already verified"}

    if datetime.utcnow() > user.code_expires_at:
        return {"error": "Code expired. Please register again"}

    if user.verification_code != req.code:
        return {"error": "Invalid code"}

    # Activate account
    user.is_verified = True
    user.verification_code = None
    user.code_expires_at = None
    db.commit()

    return {"message": "Account verified successfully!"}

# ------------------------
# RESEND CODE
# ------------------------
@app.post("/resend-code")
async def resend_code(
    req: ResendRequest,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.username == req.username).first()

    if not user:
        return {"error": "User not found"}

    if user.is_verified:
        return {"error": "Already verified"}

    # Generate new code
    code = str(random.randint(100000, 999999))
    expires = datetime.utcnow() + timedelta(minutes=5)

    user.verification_code = code
    user.code_expires_at = expires
    db.commit()

    message = MessageSchema(
        subject="New Verification Code — AI Assistant",
        recipients=[user.email],
        body=f"""
        <div style="font-family: Arial, sans-serif; max-width: 400px; margin: auto; padding: 30px; background: #1e293b; border-radius: 12px; color: white;">
            <h2 style="color: #3b82f6;">New Verification Code</h2>
            <p>Hi <strong>{user.username}</strong>,</p>
            <p>Your new verification code is:</p>
            <h1 style="color: #3b82f6; letter-spacing: 12px; font-size: 40px;">{code}</h1>
            <p>This code expires in <strong>5 minutes</strong>.</p>
        </div>
        """,
        subtype="html"
    )

    await fastmail.send_message(message)

    return {"message": "New code sent to your email"}

# ------------------------
# LOGIN
# ------------------------
@app.post("/login")
def login(
    req: LoginRequest,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.username == req.username).first()

    if not user:
        return {"error": "Invalid username"}

    if not pwd_context.verify(req.password, user.password):
        return {"error": "Invalid password"}

    # ✅ Block unverified users
    if not user.is_verified:
        return {"error": "Please verify your email first"}

    token = create_token({"sub": req.username})

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
    conv = Conversation(user_id=user, title="New Chat")
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return {"conversation_id": conv.id, "title": conv.title}

# ------------------------
# GET CONVERSATIONS
# ------------------------
@app.get("/conversations")
def get_conversations(
    user: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    convs = db.query(Conversation).filter(Conversation.user_id == user).all()
    return [{"id": c.id, "title": c.title} for c in convs]

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
    return [{"role": m.role, "content": m.content} for m in messages]

# ------------------------
# CHAT
# ------------------------
@app.post("/chat")
def chat(
    req: ChatRequest,
    user: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    request_id = str(uuid4())
    active_generations[request_id] = True

    conversation_id = req.conversation_id

    if not conversation_id:
        new_conv = Conversation(user_id=user, title=req.message[:30])
        db.add(new_conv)
        db.commit()
        db.refresh(new_conv)
        conversation_id = new_conv.id

    history = db.query(ChatMessage).filter(
        ChatMessage.conversation_id == conversation_id
    ).all()

    messages = [
        {
            "role": "system",
            "content": """You are an intelligent, helpful AI assistant — similar to Claude or ChatGPT. You are friendly, thoughtful, and adapt naturally to whatever the user needs,your name is Matter AI.

RESPONSE STYLE:
- For casual conversation (greetings, small talk, simple questions) → respond naturally and warmly in plain text, like a human would. No bullet points, no headers, no code.
- For technical questions (coding, debugging, systems) → use markdown, code blocks with language names, and structured explanations.
- For informational questions (history, science, facts) → give clear, well-structured prose. Use bullet points only when listing multiple items makes sense.
- For creative tasks (writing, brainstorming, ideas) → be imaginative and engaging.

RULES:
- NEVER over-format a simple answer. If someone says "hi", just say hi back warmly.
- NEVER use bullet points or headers for conversational replies.
- Match the user's tone — casual if they're casual, professional if they're professional.
- Be concise when the question is simple. Be thorough when the question is complex.
- If you don't know something, say so honestly rather than guessing.
- Be warm, friendly, and genuinely helpful — not robotic."""
        }
    ]

    for msg in history:
        messages.append({"role": msg.role, "content": msg.content})

    messages.append({"role": "user", "content": req.message})

    db.add(ChatMessage(
        user_id=user,
        conversation_id=conversation_id,
        role="user",
        content=req.message
    ))
    db.commit()

    if not active_generations.get(request_id):
        return {"reply": "", "stopped": True}

    completion = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages
    )

    reply = completion.choices[0].message.content

    db.add(ChatMessage(
        user_id=user,
        conversation_id=conversation_id,
        role="assistant",
        content=reply
    ))
    db.commit()

    active_generations.pop(request_id, None)

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
    return {"message": "Generation stopped"}

# ------------------------
# SAVE PARTIAL MESSAGE
# ------------------------
@app.post("/save-partial")
def save_partial(
    req: SavePartialRequest,
    user: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    last_msg = db.query(ChatMessage).filter(
        ChatMessage.conversation_id == req.conversation_id,
        ChatMessage.role == "assistant"
    ).order_by(ChatMessage.id.desc()).first()

    if last_msg:
        last_msg.content = req.content + " [stopped]"
        db.commit()

    return {"message": "Partial saved"}

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
    return {"message": "Chat cleared"}

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
    return {"message": "Conversation deleted"}

# ------------------------
# VOICE TRANSCRIPTION
# ------------------------
@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    user: str = Depends(get_current_user)
):
    audio_bytes = await file.read()
    filename = file.filename or "audio.mp4"

    transcription = client.audio.transcriptions.create(
        file=(filename, audio_bytes, file.content_type),
        model="whisper-large-v3-turbo",
        language="en",
        response_format="json"
    )

    return {"text": transcription.text}