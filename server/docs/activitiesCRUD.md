# NormAI — Activity Log: Especificação Backend

> Documento de requisitos para implementar o sistema de notificações/atividades do NormAI.
> O frontend já tem o componente `NotificationBell` pronto — ele consome `GET /activities` assim que o endpoint existir.
> Data: 2026-06-01

---

## TL;DR

O frontend tem um sininho de notificações na página `/projects` que exibe as últimas atividades do usuário. Hoje os dados são mockados em `lib/activity-data.ts`. Para funcionar de verdade, o backend precisa de:

1. **Tabela `activities`** — gravada automaticamente pelo backend em cada evento relevante.
2. **Um endpoint**: `GET /activities` — retorna os eventos do usuário autenticado, ordenados por data.
3. **Auto-log nos eventos existentes** — o backend grava na tabela nos use cases já existentes (criação de projeto, upload, processamento).

Nenhuma rota de criação manual de atividade é necessária. O frontend não escreve atividades — só lê.

---

## 1. Tipos de evento

```python
class ActivityType(str, Enum):
    project_created  = "project_created"   # projeto criado
    upload           = "upload"            # arquivo CSV/XLSX enviado
    processing_start = "processing_start"  # processamento iniciado
    processing_done  = "processing_done"   # processamento concluído
    needs_action     = "needs_action"      # processamento falhou / requer intervenção
```

---

## 2. Tabela `activities`

### 2.1 Schema SQL

```sql
CREATE TABLE activities (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id  UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    type        TEXT        NOT NULL,                          -- ActivityType enum
    project_name TEXT       NOT NULL,                          -- snapshot do nome no momento do evento
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activities_user_id    ON activities (user_id, created_at DESC);
CREATE INDEX idx_activities_project_id ON activities (project_id);
```

> `project_name` é um snapshot — se o projeto for renomeado depois, a notificação ainda mostra o nome correto da época.

### 2.2 Modelo SQLAlchemy

```python
# infrastructure/persistence/models/activity.py
from uuid import uuid4
from sqlalchemy import Column, String, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from infrastructure.persistence.models.base import Base

class ActivityModel(Base):
    __tablename__ = "activities"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id      = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    project_id   = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    type         = Column(String(40), nullable=False)
    project_name = Column(String(200), nullable=False)
    created_at   = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_activities_user_created", "user_id", created_at.desc()),
        Index("idx_activities_project_id",   "project_id"),
    )
```

### 2.3 Migração Alembic

```python
# alembic/versions/xxxx_create_activities.py
def upgrade():
    op.create_table(
        "activities",
        sa.Column("id",           postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id",      postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id",     ondelete="CASCADE"), nullable=False),
        sa.Column("project_id",   postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id",  ondelete="CASCADE"), nullable=False),
        sa.Column("type",         sa.String(40),  nullable=False),
        sa.Column("project_name", sa.String(200), nullable=False),
        sa.Column("created_at",   sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("idx_activities_user_created", "activities", ["user_id", sa.text("created_at DESC")])
    op.create_index("idx_activities_project_id",   "activities", ["project_id"])

def downgrade():
    op.drop_table("activities")
```

---

## 3. Endpoint

### `GET /activities`

Retorna as atividades do usuário autenticado, as mais recentes primeiro.

**Query params:**

| Param | Tipo | Default | Descrição |
|---|---|---|---|
| `limit` | int | `20` | Máximo de eventos retornados (max: 50) |
| `offset` | int | `0` | Paginação por offset |

**Response `200`:**

```json
{
  "items": [
    {
      "id": "uuid",
      "type": "processing_done",
      "project_id": "uuid",
      "project_name": "Maus Tratos a Animais",
      "created_at": "2026-06-01T19:45:00Z"
    }
  ],
  "total": 42
}
```

**Schema Pydantic:**

```python
# schemas/activity.py
from pydantic import BaseModel
from uuid import UUID
from datetime import datetime

class ActivityResponse(BaseModel):
    id:           UUID
    type:         str
    project_id:   UUID
    project_name: str
    created_at:   datetime

    model_config = ConfigDict(from_attributes=True)

class ActivityListResponse(BaseModel):
    items: list[ActivityResponse]
    total: int
```

**Rota FastAPI:**

```python
# routes/activities.py
@router.get("/activities", response_model=ActivityListResponse)
async def list_activities(
    limit:   int = Query(default=20, ge=1, le=50),
    offset:  int = Query(default=0,  ge=0),
    user_id: UUID = Depends(get_current_user_id),
    repo:    ActivityRepository = Depends(get_activity_repo),
):
    items, total = await repo.list_by_user(user_id, limit=limit, offset=offset)
    return ActivityListResponse(items=items, total=total)
```

**Query no repositório:**

```sql
SELECT id, type, project_id, project_name, created_at
FROM activities
WHERE user_id = :user_id
ORDER BY created_at DESC
LIMIT :limit OFFSET :offset;

-- total separado (ou COUNT(*) OVER() na mesma query):
SELECT COUNT(*) FROM activities WHERE user_id = :user_id;
```

---

## 4. Auto-log nos use cases existentes

Nenhuma rota nova de criação é necessária. O log é gravado internamente nos use cases já existentes. Todos os pontos abaixo precisam chamar `ActivityRepository.create(...)` após a ação principal ter sucesso.

### 4.1 Projeto criado → `project_created`

**Onde:** `application/projects/create_project.py` (use case de criação), após o `INSERT` no banco.

```python
await activity_repo.create(
    user_id      = command.user_id,
    project_id   = new_project.id,
    type         = ActivityType.project_created,
    project_name = new_project.name,
)
```

---

### 4.2 Upload de arquivo → `upload`

**Onde:** `application/reports/create_report.py` (ou equivalente de upload), após salvar o arquivo.

```python
await activity_repo.create(
    user_id      = command.user_id,
    project_id   = command.project_id,
    type         = ActivityType.upload,
    project_name = project.name,  # buscar nome do projeto antes de gravar
)
```

---

### 4.3 Processamento iniciado → `processing_start`

**Onde:** `application/projects/start_processing.py` (use case que dispara a task Celery), antes ou logo após o `task.delay(...)`.

```python
await activity_repo.create(
    user_id      = command.user_id,
    project_id   = command.project_id,
    type         = ActivityType.processing_start,
    project_name = project.name,
)
```

---

### 4.4 Processamento concluído → `processing_done`

**Onde:** Task Celery de processamento, no bloco de sucesso (após gravar o arquivo normalizado).

Como a task Celery roda fora do request HTTP, o log deve ser gravado diretamente via SQLAlchemy (sessão síncrona ou `asyncio.run()`), ou via Redis pub/sub que um worker separado consome e grava.

```python
# celery_tasks/process_project.py
@celery.task
def process_project(project_id: str, user_id: str):
    try:
        # ... lógica de processamento ...
        with SyncSession() as session:
            activity_repo = SyncActivityRepository(session)
            activity_repo.create(
                user_id      = UUID(user_id),
                project_id   = UUID(project_id),
                type         = ActivityType.processing_done,
                project_name = project.name,
            )
    except Exception:
        # falhou → gravar needs_action
        with SyncSession() as session:
            activity_repo = SyncActivityRepository(session)
            activity_repo.create(
                user_id      = UUID(user_id),
                project_id   = UUID(project_id),
                type         = ActivityType.needs_action,
                project_name = project.name,
            )
        raise
```

> **Alternativa com Redis:** A task Celery publica `RPUSH activity_queue <json>` e um worker separado (ou o próprio backend na inicialização) consome a fila e grava no Postgres. Isola a task de falhas de banco.

---

### 4.5 Processamento falhou → `needs_action`

**Onde:** bloco `except` da task Celery (ver 4.4 acima) ou no handler de erro do use case de processamento.

---

## 5. Repositório de atividades

```python
# domain/activity/repository.py
from abc import ABC, abstractmethod
from uuid import UUID
from domain.activity.entities import ActivityType

class ActivityRepository(ABC):

    @abstractmethod
    async def create(
        self,
        user_id:      UUID,
        project_id:   UUID,
        type:         ActivityType,
        project_name: str,
    ) -> None: ...

    @abstractmethod
    async def list_by_user(
        self,
        user_id: UUID,
        limit:   int = 20,
        offset:  int = 0,
    ) -> tuple[list, int]: ...
```

---

## 6. Redis / Celery — considerações

O backend já usa Celery com Redis como broker. Para o log de `processing_done` e `needs_action`:

**Opção A — Gravar direto na task (mais simples):**
A task cria uma sessão SQLAlchemy síncrona e grava antes de terminar. Funciona se a task já tem acesso à connection string.

**Opção B — Fila dedicada no Redis (mais resiliente):**
```
task Celery  →  RPUSH normiai:activity_queue <json>
               ↓
          consumer (FastAPI lifespan / worker separado)
               ↓
          INSERT INTO activities
```
Garante que uma falha de banco não derruba o resultado do processamento.

**Recomendação:** Opção A para o MVP (menos infraestrutura). Migrar para Opção B se os logs começarem a impactar tempo de processamento.

---

## 7. O que o frontend precisa

Após o endpoint estar no ar, o frontend:

1. Remove `lib/activity-data.ts` (mock estático).
2. Cria `lib/activities.ts` com `fetchActivities()` via axios.
3. Cria hook `useActivities()` que chama o endpoint.
4. `NotificationBell` troca `ACTIVITY` (mock) pelo resultado do hook.

O contrato de resposta que o frontend espera:

```typescript
interface ActivityEvent {
  id:           string;
  type:         "project_created" | "upload" | "processing_start" | "processing_done" | "needs_action";
  project_id:   string;
  project_name: string;  // o frontend usa esse campo como "project" na UI
  created_at:   string;  // ISO 8601
}
```

---

## 8. O que NÃO precisa mudar

- Nenhuma rota de `POST /activities` — o frontend nunca escreve atividades.
- Nenhuma rota de `DELETE /activities` — atividades são imutáveis.
- Nenhuma rota de `PATCH /activities` — idem.
- Isolamento por `user_id` — já está modelado na tabela; a query filtra por `user_id` do token JWT.
- Arquitetura em camadas — segue o mesmo padrão do dicionário (entity → use case → repository → route).

---

## 9. Mapa de gaps

```
FRONTEND ESPERA               BACKEND HOJE              AÇÃO
────────────────────────      ──────────────────        ─────────────────────────────
GET /activities          ←→   (não existe)              nova rota + repositório
tabela activities        ←→   (não existe)              migração Alembic
log em create_project    ←→   (não existe)              1 linha no use case existente
log em create_report     ←→   (não existe)              1 linha no use case existente
log em start_processing  ←→   (não existe)              1 linha no use case existente
log em task Celery done  ←→   (não existe)              bloco de sucesso/erro na task
```
