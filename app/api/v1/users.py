"""HTTP handlers for user-related endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Body, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db_session
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserRegisterRequest, UserRegisterResponse
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["Users"])

_REGISTER_EXAMPLE = {
    "default": {
        "summary": "Basic registration",
        "value": {
            "system_user_id": "a1b2c3d4-0001-4000-8000-000000000001",
            "full_name": "Ivan Petrov",
            "username": "ipetrov",
            "timezone": "Europe/Moscow",
            "system_uuid": "b2c3d4e5-0002-4000-8000-000000000002",
            "invalidation_reason_uuid": None,
            "is_row_invalid": 0,
        },
    },
    "minimal": {
        "summary": "Only required fields",
        "value": {
            "system_user_id": "a1b2c3d4-0001-4000-8000-000000000001",
            "full_name": "Ivan Petrov",
        },
    },
}


@router.post(
    "/register",
    response_model=UserRegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register user",
    description=(
        "Creates a new user by `system_user_id` "
        "or raises 400 if already exists. "
        "All input fields are validated via Pydantic schemas."
    ),
)
def register_user(
    payload: Annotated[UserRegisterRequest, Body(openapi_examples=_REGISTER_EXAMPLE)],
    session: Annotated[Session, Depends(get_db_session)],
) -> UserRegisterResponse:
    """Register user and return stored record."""
    service = UserService(UserRepository(session))
    user = service.register(payload)
    return UserRegisterResponse.model_validate(user)
