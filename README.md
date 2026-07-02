# NormAI

SPRINT IDP -- JusBrasil. Monorepo com o backend (`server/`) e o frontend (`web/`) do Normalizador.

## Estrutura

```text
server/   # API - FastAPI + Uvicorn (Python, dependencias via uv)
web/      # Frontend - Next.js
```

## Server (API)

Backend do Normalizador JusBrasil usando FastAPI + Uvicorn, com dependencias gerenciadas por `uv`.

### Rodar com Docker

```bash
cd server
make build
make up
```

Aplique as migrations:

```bash
make migrate
```

Health check:

```bash
make health
```

Comandos uteis:

```bash
make help                       # lista todos os comandos
make logs                       # acompanha logs da API
make ps                         # ve status dos containers
make test                       # roda os testes no Docker
make restart                    # reinicia a API
make rebuild                    # reconstroi e sobe do zero
make down                       # derruba a API
make migrate                    # aplica migrations pendentes
make migration MSG="add_foo"    # gera nova migration
make shell-db                   # abre psql no banco
```

### Rodar localmente

```bash
cd server
uv sync --dev
uv run uvicorn main:app --app-dir src --reload
```

### Estrutura

```text
server/src/
  domain/          # entidades e regras de negocio
  application/     # casos de uso
  infrastructure/  # configuracoes e adapters externos (DB, auth, storage)
  presentation/    # camada HTTP
```

### Modulos

| Modulo  | Endpoints | Detalhes |
|---|---|---|
| Auth    | `POST /auth/{register,login,refresh,logout}` | JWT em cookies HTTP-only. Ver [server/docs/auth-user-crud.md](server/docs/auth-user-crud.md). |
| Users   | `GET /users/me`, `PATCH /users/me/password`  | Requer cookie `access_token` valido. |
| Projects| `POST/GET/PATCH/DELETE /projects`            | CRUD com paginacao. Ver [server/docs/CrudProjectsChangeLog.md](server/docs/CrudProjectsChangeLog.md). |
| Health  | `GET /health`                                 | Status da API. |

Swagger UI em `http://localhost:8000/docs`.

## Web (Frontend)

Aplicacao [Next.js](https://nextjs.org) bootstrapped com [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

### Rodar localmente

```bash
cd web
npm run dev
# ou
yarn dev
# ou
pnpm dev
# ou
bun dev
```

Abra [http://localhost:3000](http://localhost:3000) para ver o resultado. A pagina pode ser editada em `web/app/page.tsx` e atualiza automaticamente.

Usa [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) para otimizar e carregar [Geist](https://vercel.com/font).

### Rodar com Docker

```bash
cd web
make build
make up
```

## Licenca

Ver [LICENSE](LICENSE).
