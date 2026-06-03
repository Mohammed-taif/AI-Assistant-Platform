from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from httpx import request
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import Groq
from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from database import Base, engine, SessionLocal
from models import ChatMessage, User
from models import User, ChatMessage
import os
import json

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

app = FastAPI()
from fastapi.middleware.cors import CORSMiddleware

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

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

fake_users = {
    "taif": {
        "username": "taif",
        "password": "1234"
    }
}

# ------------------------
# MEMORY STORAGE
# ------------------------
try:
    with open("conversations.json", "r") as f:
        conversations = json.load(f)
except:
    conversations = {}

# ------------------------
# REQUEST MODEL
# ------------------------

class RegisterRequest(BaseModel):
    username: str
    password: str

class ChatRequest(BaseModel):
    message: str

# ------------------------
# JWT FUNCTIONS
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

# ------------------------
# AUTH DEPENDENCY (FIXED)
# ------------------------
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):

    token = credentials.credentials
    username = verify_token(token)

    if not username:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return username

# ------------------------
# ROUTES
# ------------------------
@app.get("/")
def root():
    return {"message": "AI Assistant Backend Running"}

# LOGIN
@app.post("/login")
def login(
    username: str,
    password: str,
    db: Session = Depends(get_db)
):

    user = (
        db.query(User)
        .filter(User.username == username)
        .first()
    )

    if not user:
        return {"error": "Invalid username"}

    if not pwd_context.verify(password, user.password):
        return {"error": "Invalid password"}

    token = create_token({"sub": username})

    return {
        "access_token": token,
        "token_type": "bearer"
    }
@app.post("/register")
def register(
    request: RegisterRequest,
    db: Session = Depends(get_db)
):

    existing_user = (
        db.query(User)
        .filter(User.username == request.username)
        .first()
    )

    if existing_user:
        return {"error": "Username already exists"}

    hashed_password = pwd_context.hash(request.password)

    user = User(
        username=request.username,
        password=hashed_password
    )

    db.add(user)
    db.commit()

    return {
        "message": "User registered successfully"
    }
# CHAT (PROTECTED - FIXED)
@app.post("/chat")
def chat(
    request: ChatRequest,
    user: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    user_id = user

    if user_id not in conversations:
        conversations[user_id] = []

    conversations[user_id].append({
        "role": "user",
        "content": request.message
    })

    db.add(
        ChatMessage(
            user_id=user_id,
            role="user",
            content=request.message
        )
    )
    db.commit()

    completion = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "system",
                "content": "You are a helpful AI assistant."
            }
        ] + conversations[user_id]
    )

    reply = completion.choices[0].message.content

    conversations[user_id].append({
        "role": "assistant",
        "content": reply
    })

    db.add(
        ChatMessage(
            user_id=user_id,
            role="assistant",
            content=reply
        )
    )
    db.commit()

    with open("conversations.json", "w") as f:
        json.dump(conversations, f, indent=4)

    return {
        "reply": reply
    }
# HISTORY
@app.get("/history/{user_id}")
def get_history(
    user_id: str,
    db: Session = Depends(get_db)
):

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == user_id)
        .all()
    )

    return messages
# CLEAR CHAT
@app.delete("/clear-chat/{user_id}")
def clear_chat(
    user_id: str,
    db: Session = Depends(get_db)
):

    db.query(ChatMessage).filter(
        ChatMessage.user_id == user_id
    ).delete()

    db.commit()

    if user_id in conversations:
        del conversations[user_id]

        with open("conversations.json", "w") as f:
            json.dump(conversations, f, indent=4)

    return {
        "message": f"Chat cleared for {user_id}"
    }