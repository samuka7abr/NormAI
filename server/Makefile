COMPOSE := docker compose
SERVICE := api
APP_URL := http://localhost:8000

.DEFAULT_GOAL := help

.PHONY: help build up start down stop restart rebuild logs logs-localstack ps shell health test clean migrate migration shell-db s3-buckets

help: ## Lista os comandos disponiveis
	@echo "Comandos disponiveis:"
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ {printf "  make %-16s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Constroi/reconstroi a imagem Docker
	@$(COMPOSE) build

up: ## Sobe a API em segundo plano
	@$(COMPOSE) up -d
	@echo "API em $(APP_URL)"

start: up ## Alias para subir a API

down: ## Derruba containers e rede do projeto
	@$(COMPOSE) down

stop: down ## Alias para derrubar a API

restart: down up ## Reinicia a API

rebuild: down build up ## Reconstroi e sobe a API do zero

logs: ## Mostra os logs da API
	@$(COMPOSE) logs -f $(SERVICE)

logs-localstack: ## Mostra os logs do LocalStack
	@$(COMPOSE) logs -f localstack

ps: ## Mostra o status dos containers
	@$(COMPOSE) ps

shell: ## Abre um shell dentro do container da API
	@$(COMPOSE) exec $(SERVICE) sh

health: ## Testa a rota /health
	@curl -sS $(APP_URL)/health
	@echo

test: ## Roda os testes no Docker
	@$(COMPOSE) run --rm $(SERVICE) uv run pytest

clean: ## Remove containers, rede e volumes do projeto
	@$(COMPOSE) down -v --remove-orphans

migrate: ## Aplica todas as migrations pendentes (alembic upgrade head)
	@$(COMPOSE) run --rm $(SERVICE) uv run alembic upgrade head

migration: ## Gera nova migration (uso: make migration MSG="descricao")
	@$(COMPOSE) run --rm $(SERVICE) uv run alembic revision --autogenerate -m "$(MSG)"

shell-db: ## Abre psql dentro do container do banco
	@$(COMPOSE) exec db psql -U $${POSTGRES_USER:-postgres} -d $${POSTGRES_DB:-normalizador}

s3-buckets: ## Lista buckets S3 no LocalStack
	@$(COMPOSE) exec localstack awslocal s3 ls

ollama-pull: ## Forca o pull do modelo configurado no Ollama
	@$(COMPOSE) run --rm ollama-pull

ollama-shell: ## Abre um shell dentro do container do Ollama
	@$(COMPOSE) exec ollama sh

llm-ping: ## Testa o endpoint do LLM (lista modelos disponiveis)
	@$(COMPOSE) exec api sh -c 'curl -sS -H "Authorization: Bearer $${LLM_API_KEY}" "$${LLM_BASE_URL%/v1}/api/tags" 2>/dev/null || curl -sS -H "Authorization: Bearer $${LLM_API_KEY}" "$${LLM_BASE_URL}/models"'
	@echo

worker-logs: ## Mostra os logs do worker Celery
	@$(COMPOSE) logs -f worker

worker-restart: ## Reinicia o worker Celery
	@$(COMPOSE) restart worker

redis-cli: ## Abre o redis-cli no container do Redis
	@$(COMPOSE) exec redis redis-cli

queue-inspect: ## Mostra estatísticas da fila Celery (active + scheduled)
	@$(COMPOSE) exec worker uv run celery -A infrastructure.worker.celery_app.celery_app inspect active
	@$(COMPOSE) exec worker uv run celery -A infrastructure.worker.celery_app.celery_app inspect scheduled
