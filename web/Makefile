COMPOSE := docker compose
SERVICE ?= web

.DEFAULT_GOAL := help

.PHONY: help up down dev dev-down rebuild restart ps health logs errors lint install build-local clean

help: ## Lista todos os comandos disponíveis
	@echo "Comandos disponíveis (SERVICE=$(SERVICE)):"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

up: ## Sobe o container de produção (web) em background
	$(COMPOSE) --profile prod up -d

down: ## Derruba todos os containers (prod e dev)
	$(COMPOSE) --profile prod --profile dev down

dev: ## Sobe o container de dev com hot reload (web-dev)
	$(COMPOSE) --profile dev up --build web-dev -d
	@echo "Hot reload ativo em http://localhost:3000 — edite o código e o browser atualiza sozinho."

dev-down: ## Derruba o container de dev
	$(COMPOSE) --profile dev down

rebuild: ## Reconstrói a imagem de produção e reinicia (equivale ao 'up --build web -d')
	$(COMPOSE) --profile prod up --build web -d

restart: ## Reinicia o serviço sem rebuild (use SERVICE=web-dev para o dev)
	$(COMPOSE) restart $(SERVICE)

ps: ## Lista os containers do projeto (prod e dev)
	@$(COMPOSE) --profile prod --profile dev ps 2>/dev/null

health: ## Mostra status dos containers e resultado do healthcheck
	@$(COMPOSE) --profile prod --profile dev ps
	@echo ""
	@for c in $$($(COMPOSE) --profile prod --profile dev ps -q); do \
		docker inspect --format '{{.Name}}: {{if .State.Health}}{{.State.Health.Status}}{{else}}sem healthcheck{{end}}' $$c; \
	done

logs: ## Acompanha os logs em tempo real (use SERVICE=web-dev para o dev)
	$(COMPOSE) logs -f --tail=100 $(SERVICE)

errors: ## Filtra erros e warnings dos logs recentes
	@$(COMPOSE) logs --tail=500 $(SERVICE) 2>/dev/null | grep -iE "error|warn|fail|exception" || echo "Nenhum erro encontrado nos últimos 500 logs de $(SERVICE)."

lint: ## Roda o ESLint via npm no host
	npm run lint

install: ## Instala dependências no host (mantém node_modules sincronizado p/ IDE)
	npm ci

build-local: ## Roda o build do Next.js no host
	npm run build

clean: ## Derruba tudo, remove volumes e imagens dangling
	$(COMPOSE) --profile prod --profile dev down -v
	docker image prune -f
