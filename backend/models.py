from sqlalchemy import Column, Integer, String, Text, ForeignKey, Boolean, DateTime
from database import Base

# ------------------------
# USERS
# ------------------------
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password = Column(String)
    email = Column(String, unique=True, index=True)        # ✅ NEW
    is_verified = Column(Boolean, default=False)           # ✅ NEW
    verification_code = Column(String, nullable=True)      # ✅ NEW
    code_expires_at = Column(DateTime, nullable=True)      # ✅ NEW

# ------------------------
# CONVERSATIONS
# ------------------------
class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    title = Column(String, default="New Chat")

# ------------------------
# CHAT MESSAGES
# ------------------------
class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    conversation_id = Column(
        Integer,
        ForeignKey("conversations.id"),
        index=True
    )
    role = Column(String)
    content = Column(Text)