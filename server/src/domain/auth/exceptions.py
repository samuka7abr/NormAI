"""Exceções do domínio de autenticação."""


class AuthDomainError(Exception):
    """Classe base para erros do domínio de autenticação."""


class InvalidCredentials(AuthDomainError):
    """Email ou senha inválidos. Mensagem genérica de propósito (segurança)."""


class InvalidToken(AuthDomainError):
    """Token JWT inválido: malformado, assinatura errada, ou tipo errado."""


class TokenExpired(AuthDomainError):
    """Token expirou pelo campo 'exp'."""


class RefreshTokenNotFound(AuthDomainError):
    """Refresh token não existe no banco (foi forjado, ou já foi rotacionado)."""


class RefreshTokenRevoked(AuthDomainError):
    """Refresh token existe mas foi revogado (logout, troca de senha, etc)."""


class RefreshTokenExpired(AuthDomainError):
    """Refresh token existe mas passou da data de expiração."""
