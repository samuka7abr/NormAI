"""Implementação concreta de PasswordHasher usando Argon2 via pwdlib."""
from pwdlib import PasswordHash

from application.auth.services import PasswordHasher


class Argon2PasswordHasher(PasswordHasher):
    """Hash de senha usando Argon2 (algoritmo recomendado pelo OWASP)."""

    def __init__(self) -> None:
        self._hasher = PasswordHash.recommended()

    def hash(self, password: str) -> str:
        return self._hasher.hash(password)

    def verify(self, password: str, hashed: str) -> bool:
        return self._hasher.verify(password, hashed)
