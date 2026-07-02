# Módulo de Autenticação e CRUD de Usuários

Implementação da Issue #1 (JWT Auth and User CRUD).

Este documento descreve **o que foi feito**, **como funciona** e **o que ainda está pendente** para a entrega final do módulo.

---

## 📌 Status da entrega

- ✅ Domínio, casos de uso e camada HTTP completos
- ✅ Autenticação via JWT em cookies HTTP-only
- ✅ Fluxo completo funcional ponta a ponta (testado manualmente via `/docs`)
- ✅ Persistência em Postgres via SQLAlchemy async + Alembic
- ⏳ Testes automatizados
- ✅ Atualização do README principal

---

## ✅ O que foi feito

### 1. Estrutura em camadas (Clean Architecture)

```
src/
├── domain/                      # Regras de negócio puras (sem libs externas)
│   ├── users/
│   │   ├── entities.py          # Entidade User
│   │   ├── exceptions.py        # EmailAlreadyExists, UserNotFound, WeakPassword, SamePassword
│   │   └── repositories.py      # Interface UserRepository (Protocol)
│   └── auth/
│       ├── entities.py          # Entidade RefreshToken
│       ├── exceptions.py        # InvalidCredentials, InvalidToken, TokenExpired, ...
│       └── repositories.py      # Interface RefreshTokenRepository (Protocol)
│
├── application/                 # Casos de uso (orquestram o domínio)
│   ├── auth/
│   │   ├── services.py          # Interfaces PasswordHasher e TokenService
│   │   ├── dtos.py              # Commands e resultados (entrada/saída)
│   │   ├── register_user.py     # RegisterUserUseCase
│   │   ├── login_user.py        # LoginUserUseCase
│   │   ├── refresh_session.py   # RefreshSessionUseCase (com rotação)
│   │   └── logout_user.py       # LogoutUserUseCase
│   └── users/
│       ├── dtos.py              # UserView, ChangePasswordCommand
│       ├── get_current_user.py  # GetCurrentUserUseCase
│       └── change_password.py   # ChangePasswordUseCase
│
├── infrastructure/              # Implementações concretas (libs externas)
│   ├── auth/
│   │   ├── password_hasher.py   # Argon2PasswordHasher (via pwdlib)
│   │   └── token_service.py     # JwtTokenService (via pyjwt + hashlib)
│   ├── persistence/
│   │   ├── base.py              # Base declarativa + TimestampMixin
│   │   ├── database.py          # Engine async + get_db() (commit/rollback)
│   │   ├── models/              # UserModel, RefreshTokenModel, ProjectModel
│   │   └── repositories/        # SqlAlchemyUserRepository, SqlAlchemyRefreshTokenRepository
│   └── settings.py              # Settings (pydantic-settings, lê .env)
│
└── presentation/                # Camada HTTP (FastAPI)
    └── http/
        ├── app.py               # Montagem do app FastAPI
        ├── cookies.py           # Helpers de cookies HTTP-only
        ├── error_handlers.py    # Conversão de exceções → HTTPException
        ├── schemas/             # Schemas Pydantic (validação de entrada/saída)
        ├── dependencies/
        │   ├── auth.py          # get_current_user_id (lê cookie + decodifica JWT)
        │   └── container.py     # Composition root (DI manual)
        └── routes/
            ├── auth.py          # POST /auth/{register,login,refresh,logout}
            └── users.py         # GET /users/me, PATCH /users/me/password
```

### 2. Entidades de domínio

- **`User`**: id (UUID), email (normalizado em lowercase), password_hash, created_at, updated_at.
- **`RefreshToken`**: id, user_id, token_hash (nunca o valor puro), expires_at, revoked_at, created_at. Métodos: `is_active()`, `is_expired()`, `is_revoked()`, `revoke()`.

### 3. Casos de uso

| Caso de uso | Responsabilidade |
|---|---|
| `RegisterUserUseCase` | Valida email único, valida senha mínima, gera hash, cria usuário, emite tokens, persiste refresh hash |
| `LoginUserUseCase` | Busca usuário, valida senha, emite tokens, persiste refresh hash. Mensagem genérica em falha (segurança) |
| `RefreshSessionUseCase` | Valida refresh token (existência, revogação, expiração), revoga o antigo, emite par novo (rotação) |
| `LogoutUserUseCase` | Revoga o refresh token atual. Idempotente |
| `GetCurrentUserUseCase` | Retorna dados públicos do usuário autenticado |
| `ChangePasswordUseCase` | Valida senha atual, valida nova (mínimo, diferente da atual), atualiza hash, revoga todos os refresh tokens |

### 4. Endpoints HTTP

| Método | Rota | Descrição |
|---|---|---|
| `GET`  | `/health` | Retorna status da aplicação (pré-existente) |
| `POST` | `/auth/register` | Cria usuário, define cookies de sessão. Status `201` |
| `POST` | `/auth/login` | Autentica usuário, define cookies de sessão. Status `200` |
| `POST` | `/auth/refresh` | Renova access token via refresh cookie (com rotação). Status `200` |
| `POST` | `/auth/logout` | Revoga refresh token e limpa cookies. Status `200` |
| `GET`  | `/users/me` | Retorna usuário autenticado. Requer cookie válido |
| `PATCH`| `/users/me/password` | Troca senha do usuário autenticado, revoga sessões |

### 5. Variáveis de ambiente adicionadas no `.env.example`

```env
JWT_SECRET_KEY=trocar-em-producao-com-string-aleatoria-longa
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
COOKIE_SECURE=false
COOKIE_SAMESITE=lax
```

### 6. Dependências adicionadas

- `pyjwt` — geração e validação de JWT.
- `pwdlib[argon2]` — hash de senha com Argon2 (recomendado pelo OWASP).
- `pydantic[email]` — validação de formato de email.
- `httpx` (dev) — cliente HTTP para testes de integração com o app FastAPI.
- `pytest-asyncio` (dev) — suporte a testes async.

---

## ⚙️ Como funciona

### Fluxo de autenticação

1. **Registro / Login**
   - Cliente envia email + senha.
   - Servidor valida, gera **access token** (JWT, 15 min) e **refresh token** (random 32 bytes, 7 dias).
   - Ambos são enviados via cookies `HttpOnly`, `Secure` (em prod), `SameSite=Lax`.
   - O **hash SHA-256** do refresh token é salvo no banco; o valor puro nunca é persistido.

2. **Acesso a endpoint protegido (`GET /users/me`)**
   - Navegador envia automaticamente o cookie `access_token`.
   - Dependência `get_current_user_id` decodifica o JWT, valida assinatura/expiração/tipo, extrai `sub`.
   - Caso falhe: `401 Unauthorized` com mensagem genérica.

3. **Renovação (`POST /auth/refresh`)**
   - Navegador envia o cookie `refresh_token`.
   - Servidor hasheia, busca no banco, valida estado (não revogado, não expirado).
   - **Rotação**: revoga o refresh token atual e emite um novo par (access + refresh).
   - Se o token vazado for usado, o legítimo recebe falha — sinal de comprometimento.

4. **Logout**
   - Servidor revoga o refresh token atual e limpa os cookies.
   - Idempotente: chamar logout sem cookie ou com token já revogado retorna sucesso.

5. **Troca de senha**
   - Valida senha atual, valida nova (≥ 8 chars, diferente da atual).
   - Atualiza o hash da senha.
   - **Revoga todos os refresh tokens ativos do usuário** — força re-login em todos os dispositivos.
   - Limpa os cookies da sessão atual.

### Segurança aplicada

- Senha armazenada com **Argon2** (algoritmo vencedor do Password Hashing Competition).
- Refresh token armazenado como **hash SHA-256**; valor puro só existe no momento da emissão.
- Cookies `HttpOnly` (não acessíveis por JS) e `Secure` em produção.
- Diferenciação entre tipos de token (`access` vs futuro `refresh JWT`) via campo `type` no payload.
- Mensagens genéricas em falhas de autenticação (sem distinguir "email não existe" de "senha errada"), evitando enumeração de usuários.
- Senhas validadas em duas camadas: Pydantic (HTTP) e caso de uso (domain).
- Rotação de refresh token a cada uso.

### Arquitetura

- **Domain** não importa nada externo (sem FastAPI, sem SQLAlchemy, sem pyjwt).
- **Application** depende apenas do domain e das interfaces que define (`PasswordHasher`, `TokenService`).
- **Infrastructure** implementa as interfaces.
- **Presentation** monta as dependências (composition root em `dependencies/container.py`) e expõe HTTP.

Os repositórios SQLAlchemy são injetados em `container.py` via `Depends(get_db)`, que abre uma `AsyncSession` por request com commit no sucesso e rollback em exceção.

---

## ⏳ O que está faltando

### 1. Testes automatizados

A issue lista os seguintes cenários como obrigatórios:

- [ ] Cadastro com sucesso retorna dados públicos e define cookies.
- [ ] Cadastro com email duplicado retorna erro adequado.
- [ ] Login com sucesso retorna dados públicos e define cookies.
- [ ] Login com senha inválida retorna erro genérico.
- [ ] `GET /users/me` autenticado retorna o usuário.
- [ ] `GET /users/me` sem autenticação retorna `401`.
- [ ] Refresh token válido renova o access token (rotação).
- [ ] Refresh token expirado ou revogado é rejeitado.
- [ ] Logout revoga o refresh token atual.
- [ ] Senha é armazenada como hash, nunca em texto puro.
- [ ] Alteração de senha com sucesso atualiza o hash.
- [ ] Alteração de senha com senha atual incorreta é rejeitada.
- [ ] Alteração de senha sem autenticação é rejeitada.
- [ ] Alteração de senha revoga refresh tokens ativos.

A arquitetura permite testes de integração contra o Postgres do compose (com truncate entre testes, como já feito em `tests/integration/test_projects_api.py`).

---

## 🚀 Como rodar localmente

```bash
# 1. Cria .env (e edite JWT_SECRET_KEY com uma string aleatória forte)
cp .env.example .env

# 2. Sobe API + Postgres
make up

# 3. Aplica migrations
make migrate
```

Acesse `http://localhost:8000/docs` para a documentação interativa (Swagger UI) e teste o fluxo completo:

1. `POST /auth/register` — cria um usuário.
2. `GET /users/me` — confirma sessão ativa.
3. `PATCH /users/me/password` — troca a senha.
4. `POST /auth/login` — re-login com a senha nova.
5. `POST /auth/logout` — encerra sessão.

> Gere uma `JWT_SECRET_KEY` forte com: `python -c "import secrets; print(secrets.token_urlsafe(64))"`
