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

from database import Base, engine, SessionLocal
from models import ChatMessage, User

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

# ------------------------
# APP
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
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ------------------------
# REQUEST MODELS
# ------------------------
class RegisterRequest(BaseModel):
    username: str
    password: str

class ChatRequest(BaseModel):
    message: str

# ------------------------
# JWT
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

# ------------------------
# REGISTER
# ------------------------
@app.post("/register")
def register(request: RegisterRequest, db: Session = Depends(get_db)):

    existing_user = db.query(User).filter(User.username == request.username).first()

    if existing_user:
        return {"error": "Username already exists"}

    hashed_password = pwd_context.hash(request.password)

    user = User(
        username=request.username,
        password=hashed_password
    )

    db.add(user)
    db.commit()

    return {"message": "User registered successfully"}

# ------------------------
# LOGIN
# ------------------------
@app.post("/login")
def login(username: str, password: str, db: Session = Depends(get_db)):

    user = db.query(User).filter(User.username == username).first()

    if not user:
        return {"error": "Invalid username"}

    if not pwd_context.verify(password, user.password):
        return {"error": "Invalid password"}

    token = create_token({"sub": username})

    return {
        "access_token": token,
        "token_type": "bearer"
    }

# ------------------------
# CHAT
# ------------------------
@app.post("/chat")
def chat(
    request: ChatRequest,
    user: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    # get chat history from DB
    history = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == user)
        .all()
    )

    messages = [
        {"role": "system", "content": "You are a helpful AI assistant."}
    ]

    for msg in history:
        messages.append({
            "role": msg.role,
            "content": msg.content
        })

    # add new user message
    messages.append({"role": "user", "content": request.message})

    # save user message
    db.add(ChatMessage(
        user_id=user,
        role="user",
        content=request.message
    ))
    db.commit()

    # AI response
    completion = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages
    )

    reply = completion.choices[0].message.content

    # save assistant message
    db.add(ChatMessage(
        user_id=user,
        role="assistant",
        content=reply
    ))
    db.commit()

    return {"reply": reply}

# ------------------------
# HISTORY
# ------------------------
@app.get("/history/{user_id}")
def get_history(user_id: str, db: Session = Depends(get_db)):

    messages = db.query(ChatMessage).filter(ChatMessage.user_id == user_id).all()

    return [
        {
            "role": msg.role,
            "content": msg.content
        }
        for msg in messages
    ]

# ------------------------
# CLEAR CHAT
# ------------------------
@app.delete("/clear-chat/{user_id}")
def clear_chat(user_id: str, db: Session = Depends(get_db)):

    db.query(ChatMessage).filter(ChatMessage.user_id == user_id).delete()
    db.commit()

    return {"message": f"Chat cleared for {user_id}"}