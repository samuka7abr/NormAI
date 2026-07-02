# KPIs — Métricas para o Dashboard

> Documento de discussão. Métricas propostas para o dashboard global do Normalizador JusBrasil, com base nas entidades e endpoints existentes no backend (`BackEnd/IDP-SPRINT-2026.1`).

## Escopo

A página `projects/{id}` **já exibe métricas por projeto**: Normalizações, Última Alteração, Linhas Processadas, Tamanho Total, Tokens Gastos, Histórico e Insights da Execução.

O dashboard deve trazer a **visão agregada entre todos os projetos** e comparativos — não repetir os números individuais de cada projeto.

---

## 1. Visão geral / volume

| Métrica | Definição | Fonte |
|---|---|---|
| Projetos ativos | Total de projetos, com breakdown por status derivado (`active` \| `processing` \| `pending` \| `ready`) | `GET /projects` |
| Relatórios processados | Total de uploads (Report), com tendência semanal/mensal | `GET /projects/{id}/reports` (agregado) |
| Linhas normalizadas | Soma de linhas processadas por todas as execuções | `ReportExecution` |
| Verbetes de dicionário | Total por kind (`mappings` \| `categories` \| `context`) | `GET /dictionary/stats` |
| Tokens gastos (total) | Soma do consumo de tokens de IA entre todos os projetos, com tendência mensal (proxy de custo) | `ReportExecution` |
| Top projetos | Ranking por linhas processadas / tokens gastos | agregação |

## 2. Saúde do processamento (`ReportExecution`)

| Métrica | Definição |
|---|---|
| Taxa de sucesso | `READY / (READY + ERROR)` |
| Tempo médio de processamento | `finished_at - started_at` |
| Fila atual | Execuções em `QUEUED` + `PROCESSING` (com `progress_percent`) |
| Throughput | Execuções concluídas por dia/hora |
| Erros recentes | Contagem e categorias do `error_log` |

## 3. Qualidade da classificação por IA (`classification_metrics`)

| Métrica | Definição |
|---|---|
| Taxa de classificação OK | `classified_ok / unique_values` por coluna (média) |
| % caindo em "Outros" | `fell_to_others`; alerta para colunas com > 15% (flag de qualidade) |
| Colunas classificadas vs. apenas normalizadas | Distribuição das `ColumnConfig` (`classify` true/false) |
| Categorias por coluna | Quantas categorias a IA está usando por coluna |

## 4. Aprovação / feedback do usuário (`Report.approval_status`)

| Métrica | Definição |
|---|---|
| Taxa de aprovação | `APPROVED / (APPROVED + REJECTED)` |
| Pendentes de revisão | Relatórios `PENDING` (call-to-action no dashboard) |
| Motivos de rejeição | Principais `approval_reason` |

## 5. Reuso e engajamento

| Métrica | Definição | Fonte |
|---|---|---|
| Reuso de dicionário | Entradas com `len(used_in) > 1`; top entradas mais aplicadas | `DictionaryEntry.used_in` |
| Atividade recente | Feed de eventos (`project_created`, `upload`, `processing_done`, `needs_action`) | `GET /activities` |
| Itens "needs_action" | Eventos que exigem ação do usuário | `GET /activities` |

---

## Visualizações sugeridas

- **Cards de KPI** (4 no topo): projetos ativos, taxa de sucesso, taxa de aprovação, fila atual
- **Linha temporal**: uploads/execuções por dia
- **Barra/donut**: status das execuções e `approval_status`
- **Tabela/lista**: colunas com `fell_to_others` alto (alerta de qualidade) e atividades recentes

## Fontes de dados

Endpoints existentes: `GET /projects`, `GET /projects/{id}/reports`, `GET /reports/{id}/executions/{exec_id}/status`, `GET /dictionary/stats`, `GET /activities`.

**Nota:** métricas agregadas (taxas, tempos médios, throughput, tokens totais) provavelmente exigem um endpoint novo no backend, ex. `GET /dashboard/stats`, pois hoje só existem listagens por recurso.
