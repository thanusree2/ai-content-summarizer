from datetime import datetime, timedelta, timezone
from typing import Annotated
import logging
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from app.config import get_settings
from app.database import get_db
from app.models.user import User

logger = logging.getLogger(__name__)
settings = get_settings()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        logger.info("Decoding token: %s...", token[:30] if token else "NONE")
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        logger.info("Token payload: %s", payload)
        user_id = payload.get("sub")
        if user_id is None:
            logger.warning("No 'sub' in token payload")
            raise credentials_exception
        user_id = int(user_id)
        logger.info("Looking up user_id: %s", user_id)
    except JWTError as e:
        logger.error("JWT decode error: %s", e)
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        logger.warning("No user found with id: %s", user_id)
        raise credentials_exception
    logger.info("Authenticated user: %s", user.email)
    return user
