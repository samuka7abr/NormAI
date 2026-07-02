"""Schemas HTTP."""
from presentation.http.schemas.auth import (
    AuthenticatedResponse,
    LoginRequest,
    LogoutResponse,
    RegisterRequest,
    ResetForgottenPasswordRequest,
    UserResponse,
)
from presentation.http.schemas.users import (
    ChangePasswordRequest,
    ChangePasswordResponse,
    UpdateProfileRequest,
    UploadAvatarResponse,
)

__all__ = [
    "RegisterRequest",
    "LoginRequest",
    "UserResponse",
    "AuthenticatedResponse",
    "LogoutResponse",
    "ResetForgottenPasswordRequest",
    "ChangePasswordRequest",
    "ChangePasswordResponse",
    "UpdateProfileRequest",
    "UploadAvatarResponse",
]