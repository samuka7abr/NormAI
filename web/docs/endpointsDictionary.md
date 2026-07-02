# Relatório: Backend vs. Protótipo — Dicionário Global (HU-08)

> Comparação entre o que o protótipo frontend especifica e o que o backend já implementa.
> Data: 2026-05-22

---

## TL;DR

O CRUD básico está **completo e testado**. Mas há **quatro gaps reais** que impedem a integração direta com o protótipo:

1. Os nomes dos tipos (`kind`) não batem com os slugs do frontend.
2. Falta o campo `description` na entidade.
3. Não existe rastreamento de `usedIn` (tabela `dictionary_applications`).
4. Faltam três endpoints especiais: `stats`, `apply-dictionary` e `dictionary-suggestions`.

---

## 1. O que já temos

### 1.1 CRUD global (`/dictionary`)

| Endpoint | Status |
|---|---|
| `POST /dictionary` | Implementado |
| `GET /dictionary` | Implementado — suporta `?kind=` e paginação |
| `GET /dictionary/{id}` | Implementado |
| `PATCH /dictionary/{id}` | Implementado — atualiza `name` e `payload` |
| `DELETE /dictionary/{id}` | Implementado — com cascade |

### 1.2 CRUD escopado por projeto (`/projects/{id}/dictionary`)

| Endpoint | Status |
|---|---|
| `POST /projects/{id}/dictionary` | Implementado |
| `GET /projects/{id}/dictionary` | Implementado |
| `GET /projects/{id}/dictionary/{entry_id}` | Implementado |
| `PATCH /projects/{id}/dictionary/{entry_id}` | Implementado |
| `DELETE /projects/{id}/dictionary/{entry_id}` | Implementado |
| `GET /projects/{id}/dictionary` (merged global+projeto) | Implementado via `list_merged` no repositório |

### 1.3 Infraestrutura

- Modelo SQLAlchemy com `JSONB` para payload, índices em `user_id`, `project_id`.
- Migração Alembic `4ec107f5c802` criando `dictionary_entries`.
- Isolamento por `user_id` em todas as queries.
- Unicidade por `(user_id, kind, name)` no escopo global.
- 13 testes unitários (fake repository) + 12 testes de integração (Postgres real).

---

## 2. O que está diferente / incompatível

### 2.1 Nomes dos tipos (crítico)

O protótipo usa três slugs fixos que aparecem como `type` na URL, nas classes CSS e como valor gravado:

| Frontend (`type`) | Backend (`kind`) | Equivalência |
|---|---|---|
| `categories` | `CATEGORY_LIST` | Listas de categorias (chips) |
| `context` | `CLASSIFICATION_INSTRUCTION` | Instruções textuais para a IA |
| `mappings` | `NORMALIZATION_PRESET` | Pares determinísticos de → para |

**Problema:** O enum `DictionaryEntryKind` usa nomes conceituais, enquanto o frontend espera slugs simples. Além disso, o mapeamento semântico não é direto — `NORMALIZATION_PRESET` corresponde a `mappings` (pares de/para), não a uma predefinição genérica.

**O que precisa mudar:** Renomear o enum para `categories | context | mappings`, ajustar a migração com um `ALTER TYPE` e atualizar todos os arquivos que referenciam os valores antigos.

---

### 2.2 Campo `description` ausente (crítico)

O protótipo exibe uma descrição abaixo do título em cada card:

```ts
type DictEntry = {
  title: string;       // → backend tem "name"
  description: string; // → NÃO EXISTE no backend
  ...
}
```

**O que precisa mudar:** Adicionar coluna `description: text` (opcional, máx 500 chars) ao modelo, DTO, schema e migração. O campo `name` do backend pode ser exposto como `title` via alias no schema Pydantic — sem renomear a coluna no banco.

---

### 2.3 Campos específicos por tipo vs. `payload` genérico

O protótipo espera campos tipados na resposta:

```ts
items?: string[];            // categories
content?: string;            // context
pairs?: [string, string][];  // mappings
```

O backend usa um único `payload: dict` que pode conter qualquer coisa.

**Impacto:** Não é bloqueador — o frontend pode ler `payload.items`, `payload.content`, `payload.pairs`. Mas o contrato fica obscuro e sem validação estrutural por tipo.

**O que precisa mudar (recomendado):** O schema de resposta deve expor os campos tipados extraídos do `payload`. A validação de `POST/PATCH` deve rejeitar payload incompatível com o `kind` declarado.

---

### 2.4 `usedIn` — rastreamento de aplicações (crítico para o painel lateral)

O protótipo exibe em cada card:

```
N projetos  •  Projeto A, Projeto B  •  há 3 dias
```

E o painel lateral mostra "Mais reutilizadas" (top 4 por projetos vinculados) e "Aplicações totais".

Isso exige a tabela `dictionary_applications`:

```sql
dictionary_applications (
  id          uuid PK,
  entry_id    uuid FK → dictionary_entries.id ON DELETE CASCADE,
  project_id  uuid FK → projects.id ON DELETE CASCADE,
  column_name varchar(80),
  applied_at  timestamptz,
  UNIQUE (entry_id, project_id, column_name)
)
```

**Hoje no backend:** Não existe. O campo `usedIn` não é persistido em lugar nenhum.

**Impacto direto no GET /dictionary:** A listagem precisará agregar `usedIn` via JOIN nessa tabela.

---

### 2.5 Endpoint `GET /dictionary/stats` ausente

O painel lateral ("Resumo" e "Mais reutilizadas") consome um endpoint dedicado:

```
GET /api/dictionary/stats
→ {
    total: number,
    by_type: { categories: N, context: N, mappings: N },
    total_applications: number,
    unused_count: number,
    most_used: DictEntry[]   // top 4
  }
```

**Hoje no backend:** Não existe. Sem esse endpoint, o frontend teria que calcular no cliente a partir da listagem — funciona no MVP mas não escala.

---

### 2.6 Endpoints de aplicação em coluna ausentes

Para fechar o loop da HU-08, o protótipo especifica:

| Endpoint | Função |
|---|---|
| `POST /projects/{id}/columns/{col}/apply-dictionary` | Vincula entry à coluna e aplica conteúdo no `ColumnConfig` |
| `DELETE /projects/{id}/columns/{col}/dictionary-applications/{appId}` | Desfaz o vínculo |
| `GET /projects/{id}/dictionary-suggestions?column=<col>` | Sugestões de entradas compatíveis com a coluna |

**Hoje no backend:** Nenhum dos três existe. Há documentação em `.claude/commands/dictionary-apply.md` sinalizando que `apply-dictionary` é o próximo passo, mas não foi implementado.

---

### 2.7 Busca por texto livre ausente

O toolbar do protótipo tem um campo de busca que casa contra título, descrição, conteúdo, items e pares de mapeamento.

**Hoje no backend:** `GET /dictionary` aceita apenas `?kind=`. Não há `?q=<termo>`.

**O que precisa mudar:** Adicionar parâmetro `?q=` com filtro ILIKE em `name`, `description` e dentro do JSONB.

---

## 3. Diferenças que o frontend resolve sozinho

| Item | Como funciona |
|---|---|
| `updatedAt` relativo ("há 3 dias") | Backend retorna ISO timestamp; frontend formata com `dayjs`. |
| Paginação vs. carga total | O protótipo carrega tudo em memória. `page_size=100` na primeira chamada cobre o MVP. |
| `id` como `"dict-" + Date.now()` no mock | O banco usa UUID. O frontend se adapta — é detalhe do mock. |

---

## 4. Mapa completo do gap

```
PROTÓTIPO ESPERA            BACKEND HOJE              AÇÃO
──────────────────────      ──────────────────        ─────────────────────────
type: "categories"     ←→   kind: CATEGORY_LIST       renomear enum
type: "context"        ←→   kind: CLASSIF_INSTR        renomear enum
type: "mappings"       ←→   kind: NORM_PRESET          renomear enum
title: string          ←→   name: string              alias no schema Pydantic
description: string    ←→   (não existe)              adicionar coluna + migração
items / content / pairs←→   payload: dict (genérico)  tipar no schema
usedIn: string[]       ←→   (não existe)              nova tabela + join na listagem
?q= (busca livre)      ←→   (não existe)              filtro no repositório
GET /stats             ←→   (não existe)              novo use case + rota
apply-dictionary       ←→   (não existe)              novo use case + rota
dictionary-suggestions ←→   (não existe)              novo use case + rota
```

---

## 5. Como implementar

### Prioridade 1 — Para integrar o CRUD básico

**1. Renomear o enum**

```python
# domain/dictionary/entities.py
class DictionaryEntryKind(str, Enum):
    categories = "categories"
    context    = "context"
    mappings   = "mappings"
```

Migração Alembic (renomear valores do tipo enum no Postgres):
```sql
ALTER TYPE dictionaryentrykind RENAME VALUE 'CATEGORY_LIST'              TO 'categories';
ALTER TYPE dictionaryentrykind RENAME VALUE 'CLASSIFICATION_INSTRUCTION' TO 'context';
ALTER TYPE dictionaryentrykind RENAME VALUE 'NORMALIZATION_PRESET'       TO 'mappings';
```

---

**2. Adicionar campo `description`**

```python
# domain/dictionary/entities.py
@dataclass
class DictionaryEntry:
    ...
    description: str = ""   # novo campo
```

```sql
-- nova migração Alembic
ALTER TABLE dictionary_entries
  ADD COLUMN description text NOT NULL DEFAULT '';
```

No schema Pydantic, adicionar `description: str = ""` em `CreateDictionaryEntryRequest`, `UpdateDictionaryEntryRequest` e `DictionaryEntryResponse`.

---

**3. Alias `name` → `title` no contrato HTTP**

```python
# schemas/dictionary.py
class DictionaryEntryResponse(BaseModel):
    title: str = Field(alias="name")   # expõe "title" sem mudar o banco
    ...
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)
```

O frontend passa a usar `entry.title`. Alternativa: manter `name` e o frontend se adapta — decisão de equipe.

---

**4. Tipar o payload por kind**

```python
# schemas/dictionary.py
from pydantic import model_validator

class CreateDictionaryEntryRequest(BaseModel):
    kind: DictionaryEntryKind
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=500)
    items:   list[str]              | None = None  # kind=categories
    content: str                    | None = None  # kind=context
    pairs:   list[tuple[str, str]]  | None = None  # kind=mappings

    @model_validator(mode="after")
    def validate_payload_for_kind(self):
        if self.kind == "categories" and self.items is None:
            raise ValueError("items é obrigatório para kind=categories")
        if self.kind == "context" and self.content is None:
            raise ValueError("content é obrigatório para kind=context")
        if self.kind == "mappings" and self.pairs is None:
            raise ValueError("pairs é obrigatório para kind=mappings")
        return self

    @property
    def as_payload(self) -> dict:
        if self.kind == "categories": return {"items": self.items}
        if self.kind == "context":    return {"content": self.content}
        if self.kind == "mappings":   return {"pairs": self.pairs}
```

No response, extrair do `payload`:
```python
class DictionaryEntryResponse(BaseModel):
    ...
    items:   list[str]             | None = None
    content: str                   | None = None
    pairs:   list[list[str]]       | None = None

    @classmethod
    def from_entity(cls, e: DictionaryEntryOutput):
        return cls(
            **e.__dict__,
            items   = e.payload.get("items"),
            content = e.payload.get("content"),
            pairs   = e.payload.get("pairs"),
        )
```

---

**5. Busca por texto (`?q=`)**

```python
# repositories/dictionary_repository.py  — dentro de list_global
if q := filters.q:
    term = f"%{q}%"
    stmt = stmt.where(
        or_(
            DictionaryEntryModel.name.ilike(term),
            DictionaryEntryModel.description.ilike(term),
            cast(DictionaryEntryModel.payload["content"].astext, String).ilike(term),
            cast(DictionaryEntryModel.payload["items"].astext,   String).ilike(term),
            cast(DictionaryEntryModel.payload["pairs"].astext,   String).ilike(term),
        )
    )
```

Adicionar `q: str | None = None` em `ListDictionaryEntriesInput` e ao query param da rota.

---

### Prioridade 2 — Para o painel lateral funcionar

**6. Tabela `dictionary_applications`**

```python
# infrastructure/persistence/models/dictionary_application.py
class DictionaryApplicationModel(Base):
    __tablename__ = "dictionary_applications"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    entry_id    = Column(UUID(as_uuid=True), ForeignKey("dictionary_entries.id", ondelete="CASCADE"), nullable=False)
    project_id  = Column(UUID(as_uuid=True), ForeignKey("projects.id",           ondelete="CASCADE"), nullable=False)
    column_name = Column(String(80), nullable=False)
    applied_at  = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("entry_id", "project_id", "column_name", name="uq_dict_application"),
        Index("idx_da_project", "project_id"),
        Index("idx_da_entry",   "entry_id"),
    )
```

---

**7. Agregar `usedIn` na listagem**

A query de `list_global` passa a usar subquery:
```sql
SELECT de.*,
       COUNT(da.id)                        AS used_count,
       array_agg(DISTINCT da.project_id)   AS used_in
FROM dictionary_entries de
LEFT JOIN dictionary_applications da ON da.entry_id = de.id
WHERE de.user_id = :user_id AND de.project_id IS NULL
GROUP BY de.id
ORDER BY de.updated_at DESC
```

Adicionar `used_count: int` e `used_in: list[UUID]` ao DTO `DictionaryEntryOutput`.

---

**8. Endpoint `GET /dictionary/stats`**

```python
# application/dictionary/get_stats.py
class GetDictionaryStatsUseCase:
    async def execute(self, user_id: UUID) -> DictionaryStatsOutput:
        return await self._repo.get_stats(user_id)
```

Query no repositório (única ida ao banco):
```sql
SELECT
  COUNT(*)                                    AS total,
  COUNT(*) FILTER (WHERE kind = 'categories') AS categories_count,
  COUNT(*) FILTER (WHERE kind = 'context')    AS context_count,
  COUNT(*) FILTER (WHERE kind = 'mappings')   AS mappings_count,
  COUNT(DISTINCT da.entry_id)                 AS entries_applied,
  COUNT(da.id)                                AS total_applications,
  COUNT(*) FILTER (WHERE da.id IS NULL)       AS unused_count
FROM dictionary_entries de
LEFT JOIN dictionary_applications da ON da.entry_id = de.id
WHERE de.user_id = :user_id AND de.project_id IS NULL
```

Top 4 mais reutilizadas: query separada com `ORDER BY used_count DESC LIMIT 4`.

Rota:
```python
@router.get("/dictionary/stats", response_model=DictionaryStatsResponse)
async def get_stats(user_id = Depends(get_current_user_id), ...):
    ...
```

> **Atenção:** `/dictionary/stats` deve ser registrado **antes** de `/dictionary/{entry_id}` no router para o FastAPI não interpretar `stats` como um UUID.

---

### Prioridade 3 — Para fechar o loop HU-08

**9. Apply dictionary**

Detalhes completos em `.claude/commands/dictionary-apply.md`. Resumo da lógica:

```
POST /projects/{project_id}/columns/{column_name}/apply-dictionary
Body: { entry_id: UUID }

1. Buscar entry por id + user_id → DictionaryEntryNotFound se ausente
2. Buscar ColumnConfig por project_id + column_name → ColumnConfigNotFound se ausente
3. Verificar que entry.user_id == dono do projeto → 403 se não
4. Aplicar conforme kind:
   - categories → column_config.categories = payload["items"], classify=True
   - context    → column_config.normalizations["ai_context"] = payload["content"]
   - mappings   → column_config.normalizations["canonical_map"] = payload["pairs"]
5. INSERT INTO dictionary_applications (entry_id, project_id, column_name)
   ON CONFLICT (entry_id, project_id, column_name) DO NOTHING
6. Retornar ColumnConfig atualizado
```

**10. Desfazer aplicação**

```
DELETE /projects/{project_id}/columns/{column_name}/dictionary-applications/{application_id}

1. Buscar DictionaryApplication + verificar que entry.user_id == current user
2. Reverter o ColumnConfig (remover categorias / context / mapeamentos aplicados)
3. DELETE FROM dictionary_applications WHERE id = :id
```

**11. Sugestões**

```
GET /projects/{project_id}/dictionary-suggestions?column=<col>

Heurística MVP:
- Buscar todas as entries globais do usuário
- Filtrar por compatibilidade de tipo com o ColumnConfig existente:
  * Se a coluna tem classify=True → sugerir kind=categories
  * Se a coluna tem normalizations → sugerir kind=mappings
  * Sempre sugerir kind=context
- Excluir entries já aplicadas nessa coluna
- Retornar ordenado por used_count DESC (entradas mais populares primeiro)
```

---

## 6. O que NÃO precisa mudar

- Arquitetura em camadas — está correta, não precisa de refatoração.
- Isolamento por `user_id` — já funciona conforme o spec.
- Paginação — o frontend pode usar `page_size=100` para o MVP.
- Cascade delete de projeto → aplicações — já modelado corretamente com FK `ON DELETE CASCADE`.
- Unicidade por escopo — a constraint `(user_id, kind, name)` é exatamente o que a spec pede.
- Testes existentes — continuarão válidos após renomear o enum, com ajuste nos valores literais.
