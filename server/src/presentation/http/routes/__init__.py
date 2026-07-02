"""Rotas HTTP."""
from presentation.http.routes.auth import router as auth_router
from presentation.http.routes.users import router as users_router

__all__ = ["auth_router", "users_router"]