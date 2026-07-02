# Integração Frontend ↔ Backend — Dictionary Page

> Mapeamento entre o que a página `/dictionary` consome hoje (mock + state local) e o que o backend precisa expor para a integração real.
> Data: 2026-05-25

---

## 1. Contrato de dados — `DictEntry`

### Frontend espera (tipo em `/types/dictionary.ts`)

| Campo       | Tipo                        | Obrigatório | Origem no backend              |
|-------------|---------------------------  |-------------|--------------------------------|
| `id`        | `string`                    | Sim         | `dictionary_entries.id` (UUID) |
| `type`      | `"categories"│"context"│"mappings"` | Sim | `kind` → renomear enum        |
| `title`     | `string`                    | Sim         | `name` → alias no schema       |
| `description` | `string`                  | Sim         | coluna a criar (`description`) |
| `usedIn`    | `string[]` (project ids)    | Sim         | agregar via `dictionary_applications` |
| `updatedAt` | `string` (ISO timestamp)    | Sim         | `updated_at` já existe         |
| `items`     | `string[]`                  | Só `type=categories` | `payload.items`   |
| `content`   | `string`                    | Só `type=context`    | `payload.content` |
| `pairs`     | `[string, string][]`        | Só `type=mappings`   | `payload.pairs`   |

### Colunas necessárias na tabela `dictionary_entries`

| Coluna        | Tipo SQL                    | Status    | Ação necessária                     |
|---------------|-----------------------------|-----------|-------------------------------------|
| `id`          | `uuid PK`                   | Existe    | —                                   |
| `user_id`     | `uuid FK`                   | Existe    | —                                   |
| `project_id`  | `uuid FK nullable`          | Existe    | —                                   |
| `kind`        | `enum`                      | Existe    | Renomear valores para slugs frontend |
| `name`        | `varchar(120)`              | Existe    | Expor como `title` via alias Pydantic |
| `description` | `text NOT NULL DEFAULT ''`  | **Falta** | `ALTER TABLE … ADD COLUMN`          |
| `payload`     | `jsonb`                     | Existe    | Extrair `items`/`content`/`pairs` no schema de resposta |
| `updated_at`  | `timestamptz`               | Existe    | —                                   |
| `created_at`  | `timestamptz`               | Existe    | —                                   |

### Nova tabela necessária — `dictionary_applications`

| Coluna        | Tipo SQL                                       |
|---------------|------------------------------------------------|
| `id`          | `uuid PK`                                      |
| `entry_id`    | `uuid FK → dictionary_entries.id ON DELETE CASCADE` |
| `project_id`  | `uuid FK → projects.id ON DELETE CASCADE`      |
| `column_name` | `varchar(80) NOT NULL`                         |
| `applied_at`  | `timestamptz DEFAULT now()`                    |
| **UNIQUE**    | `(entry_id, project_id, column_name)`          |

---

## 2. Endpoints necessários

### 2.1 CRUD global

| Método   | Rota                        | Uso na página           | Status backend  |
|----------|-----------------------------|-------------------------|-----------------|
| `GET`    | `/dictionary`               | Carregar lista inicial  | Existe — falta `?q=` e campo `description` |
| `POST`   | `/dictionary`               | Criar nova entrada      | Existe — falta `description` no body |
| `PATCH`  | `/dictionary/{id}`          | Salvar edições no modal | Existe — falta `description` |
| `DELETE` | `/dictionary/{id}`          | Botão deletar no modal  | Existe          |

#### Query params do `GET /dictionary`

| Param      | Uso na UI                               | Status     |
|------------|-----------------------------------------|------------|
| `kind`     | Filtro por tipo (aba All/Cat/Ctx/Map)   | Existe     |
| `q`        | Campo de busca (título, descrição, payload) | **Falta** |
| `page_size`| Carrega tudo no MVP (`page_size=100`)   | Existe     |

#### Body do `POST /dictionary` e `PATCH /dictionary/{id}`

```json
{
  "kind":        "categories | context | mappings",
  "name":        "string (max 120)",
  "description": "string (max 500)",    ← campo novo
  "items":       ["string"],            ← só para kind=categories
  "content":     "string",              ← só para kind=context
  "pairs":       [["de", "para"]]       ← só para kind=mappings
}
```

#### Resposta de `GET /dictionary` (item da lista)

```json
{
  "id":          "uuid",
  "type":        "categories | context | mappings",   ← alias de kind
  "title":       "string",                            ← alias de name
  "description": "string",
  "usedIn":      ["project-uuid-1", "project-uuid-2"],
  "updatedAt":   "ISO timestamp",
  "items":       ["string"] | null,
  "content":     "string"   | null,
  "pairs":       [["de","para"]] | null
}
```

---

### 2.2 Endpoint de stats (sidebar)

| Método | Rota                  | Status    |
|--------|-----------------------|-----------|
| `GET`  | `/dictionary/stats`   | **Falta** |

A sidebar exibe em tempo real:
- Total de entradas
- Contagem por tipo (categories / context / mappings)
- Total de aplicações
- Entradas sem uso (`unused_count`)
- Top 4 mais reutilizadas

**Resposta esperada:**
```json
{
  "total": 10,
  "by_type": {
    "categories": 4,
    "context":    3,
    "mappings":   3
  },
  "total_applications": 17,
  "unused_count":        2,
  "most_used": [
    { "id": "...", "title": "...", "type": "...", "used_count": 5 }
  ]
}
```

> **Atenção:** registrar `/dictionary/stats` **antes** de `/dictionary/{id}` no router para o FastAPI não confundir `stats` com um UUID.

---

### 2.3 Endpoints de aplicação em coluna (Prioridade 3)

Necessários para fechar o loop da HU-08 — vinculam uma entrada do dicionário a uma coluna de projeto.

| Método   | Rota                                                                      | Status    |
|----------|---------------------------------------------------------------------------|-----------|
| `POST`   | `/projects/{id}/columns/{col}/apply-dictionary`                           | **Falta** |
| `DELETE` | `/projects/{id}/columns/{col}/dictionary-applications/{appId}`            | **Falta** |
| `GET`    | `/projects/{id}/dictionary-suggestions?column=<col>`                      | **Falta** |

---

## 3. Ajuste obrigatório — renomear enum `DictionaryEntryKind`

O frontend usa slugs simples como valor literal do campo `type`:

| Frontend (`type`) | Backend atual (`kind`)       | Migração Alembic                      |
|-------------------|------------------------------|---------------------------------------|
| `categories`      | `CATEGORY_LIST`              | `RENAME VALUE 'CATEGORY_LIST' TO 'categories'` |
| `context`         | `CLASSIFICATION_INSTRUCTION` | `RENAME VALUE 'CLASSIFICATION_INSTRUCTION' TO 'context'` |
| `mappings`        | `NORMALIZATION_PRESET`       | `RENAME VALUE 'NORMALIZATION_PRESET' TO 'mappings'` |

---

## 4. Priorização de implementação

### Prioridade 1 — Para conectar o CRUD básico

- [ ] Renomear enum `DictionaryEntryKind` (+ migração Alembic)
- [ ] Adicionar coluna `description text NOT NULL DEFAULT ''` (+ migração)
- [ ] Alias `name` → `title` no schema Pydantic de resposta
- [ ] Extrair `items` / `content` / `pairs` do `payload` no schema de resposta
- [ ] Adicionar `?q=` ao `GET /dictionary` (ILIKE em `name`, `description` e dentro do JSONB)

### Prioridade 2 — Para a sidebar funcionar

- [ ] Criar tabela `dictionary_applications` (+ migração)
- [ ] Agregar `usedIn` via LEFT JOIN no `list_global`
- [ ] Implementar `GET /dictionary/stats`

### Prioridade 3 — Para fechar o loop HU-08

- [ ] `POST /projects/{id}/columns/{col}/apply-dictionary`
- [ ] `DELETE /projects/{id}/columns/{col}/dictionary-applications/{appId}`
- [ ] `GET /projects/{id}/dictionary-suggestions?column=<col>`

---

## 5. Pontos que o frontend já resolve sozinho

| Item                          | Como funciona                                              |
|-------------------------------|------------------------------------------------------------|
| Timestamp relativo ("há 3 dias") | `updatedAt` vem como ISO; frontend formata com `dayjs`  |
| Busca accent-insensitive      | Normalização NFD já implementada no cliente (não precisa de backend) |
| Paginação no MVP              | `page_size=100` na primeira chamada carrega tudo           |
| IDs de mock (`"dict-" + Date.now()`) | Backend usa UUID; frontend se adapta                |

---

## 6. Arquivos do frontend para integração

| Arquivo                                         | O que precisa mudar                                |
|-------------------------------------------------|----------------------------------------------------|
| `/types/dictionary.ts`                          | Nada — tipos já compatíveis com o contrato acima   |
| `/lib/dict-mock.ts`                             | Remover após integração real                       |
| `/components/dictionary/dictionary-home.tsx`    | Substituir `useState(MOCK_DICTIONARY)` por `useEffect` + fetch |
| `/app/api/dictionary/route.ts`                  | Implementar GET (lista) e POST (criar)             |
| `/app/api/dictionary/[entryId]/route.ts`        | Implementar PATCH (atualizar) e DELETE             |
