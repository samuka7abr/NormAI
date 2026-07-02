# Resumo do Backend — Integração com Frontend

Guia prático para o frontend consumir a API Normalizador JusBrasil.

---

## Autenticação

A API usa **cookies HttpOnly** com JWT. O frontend **não acessa os tokens diretamente** — o browser os envia automaticamente em cada requisição. Nunca tente ler ou armazenar os tokens no JavaScript.

### Cookies definidos pelo backend

| Cookie | Conteúdo | Duração padrão | HttpOnly |
|---|---|---|---|
| `access_token` | JWT de acesso (curta duração) | 15 minutos | Sim |
| `refresh_token` | Token de renovação | 7 dias | Sim |

Ambos são definidos com `SameSite=lax` e `Secure=false` em desenvolvimento (`Secure=true` em produção).

---

## Fluxo de autenticação

### 1. Cadastro

```http
POST /register
Content-Type: application/json

{
  "email": "usuario@exemplo.com",
  "password": "minimo8chars"
}
```

**Resposta 201:**
```json
{ "id": "uuid", "email": "usuario@exemplo.com" }
```
Os cookies `access_token` e `refresh_token` são definidos automaticamente. O usuário já está autenticado.

**Erro 409** — e-mail já cadastrado.

---

### 2. Login

```http
POST /login
Content-Type: application/json

{
  "email": "usuario@exemplo.com",
  "password": "minhasenha"
}
```

**Resposta 200:**
```json
{ "id": "uuid", "email": "usuario@exemplo.com" }
```
Cookies definidos automaticamente.

**Erro 401** — credenciais inválidas.

---

### 3. Renovar sessão (refresh)

Quando o `access_token` expirar (15 min), o backend responde `401`. O frontend deve chamar `/refresh` para obter um novo `access_token` sem exigir novo login.

```http
POST /refresh
```
Sem body — o `refresh_token` do cookie é lido automaticamente.

**Resposta 200:**
```json
{ "authenticated": true }
```
Um novo `access_token` é definido no cookie. O `refresh_token` também é rotacionado (novo cookie).

**Erro 401** — refresh token expirado ou inválido → redirecionar para login.

---

### 4. Logout

```http
POST /logout
```

**Resposta 200:**
```json
{ "authenticated": false }
```
Ambos os cookies são removidos. Refresh token revogado no banco.

---

## Como fazer requisições autenticadas

Como os cookies são `HttpOnly`, o browser os envia automaticamente. A única configuração necessária é `credentials: "include"` (fetch) ou `withCredentials: true` (axios):

```js
// fetch
fetch("/projects", {
  credentials: "include"
})

// axios (configuração global recomendada)
axios.defaults.withCredentials = true
```

Sem essa configuração, os cookies não são enviados em requisições cross-origin e todas as rotas retornam `401`.

---

## Tratamento de erros de autenticação

O backend retorna `401` em dois casos:

| Situação | O que fazer |
|---|---|
| `access_token` ausente | Redirecionar para login |
| `access_token` expirado | Chamar `POST /refresh` e repetir a requisição original |
| `refresh_token` expirado ou inválido (o `/refresh` retorna 401) | Redirecionar para login |

**Padrão recomendado (interceptor):**

```js
// Exemplo com axios
axios.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true
      try {
        await axios.post("/refresh")       // tenta renovar
        return axios(error.config)         // repete requisição original
      } catch {
        window.location.href = "/login"    // refresh falhou → login
      }
    }
    return Promise.reject(error)
  }
)
```

---

## Dados do usuário logado

```http
GET /users/me
```

**Resposta 200:**
```json
{ "id": "uuid", "email": "usuario@exemplo.com" }
```

Use este endpoint para verificar se a sessão ainda está ativa ao carregar a aplicação.

---

## Alteração de senha

```http
PATCH /users/me/password
Content-Type: application/json

{
  "current_password": "senhaAtual",
  "new_password": "novaSenha123"
}
```

**Resposta 200:**
```json
{ "password_updated": true }
```
Todos os refresh tokens do usuário são revogados. Os cookies são limpos — o usuário precisa fazer login novamente.

**Erro 401** — senha atual incorreta ou sessão inválida.

---

## Validações de entrada

| Campo | Regra |
|---|---|
| `email` | Formato de e-mail válido |
| `password` (cadastro / nova senha) | Mínimo 8 caracteres, máximo 128 |
| `password` (login / senha atual) | Mínimo 1 caractere, máximo 128 |

Erros de validação retornam `422 Unprocessable Entity` com detalhes no corpo da resposta.

---

## Resumo dos endpoints de auth

| Método | Rota | Auth necessária | Descrição |
|---|---|---|---|
| `POST` | `/register` | Não | Cadastro + login automático |
| `POST` | `/login` | Não | Login |
| `POST` | `/refresh` | Não (usa cookie) | Renova access token |
| `POST` | `/logout` | Sim | Encerra sessão |
| `GET` | `/users/me` | Sim | Dados do usuário logado |
| `PATCH` | `/users/me/password` | Sim | Altera senha |
