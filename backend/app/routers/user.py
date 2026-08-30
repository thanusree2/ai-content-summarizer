from typing import Annotated
from fastapi import APIRouter, Depends
from app.models.user import User
from app.schemas.user import UserResponse
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/user", tags=["user"])


@router.get("/me", response_model=UserResponse)
def get_profile(current_user: Annotated[User, Depends(get_current_user)]):
    return UserResponse.model_validate(current_user)
