"""Exceções do domínio de usuários lançadas pelos casos de uso quando regras de negócio são violadas."""


class UserDomainError(Exception):
    """Classe base para todas as exceções do domínio de usuários."""


class EmailAlreadyExists(UserDomainError):
    """Lançada quando se tenta criar usuário com email já cadastrado."""


class UserNotFound(UserDomainError):
    """Lançada quando um usuário esperado não é encontrado."""


class WeakPassword(UserDomainError):
    """Lançada quando a senha não atende aos requisitos mínimos."""


class SamePassword(UserDomainError):
    """Lançada quando a nova senha é igual à senha atual."""


class InvalidFileType(UserDomainError):
    """Lançada quando o arquivo enviado não é JPG, JPEG, PNG ou WebP."""


class FileTooLarge(UserDomainError):
    """Lançada quando o arquivo excede o tamanho máximo permitido."""
