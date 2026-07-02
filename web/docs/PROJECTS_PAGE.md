# Página de Projetos — Especificação

**Rota:** `/projects`
**Papel:** Ponto de entrada do dashboard após login.

---

## Contexto de uso

Analistas jurídicos chegam aqui logo após autenticar. Podem ter 2 a 10 projetos simultâneos. O objetivo imediato é acessar um projeto existente (para subir um relatório ou checar status de processamento) ou criar um novo. Não é uma página de exploração: é acesso rápido ao trabalho em andamento.

---

## Elementos obrigatórios

### 1. Cabeçalho da página
- Título "Projetos" (Inter 700, tracking negativo)
- Controle de tema (light/dark toggle) — canto superior direito do conteúdo
- Embutido no conteúdo, não um header fixo separado

### 2. Ação principal: Novo projeto
- CTA sempre visível
- Destino: `/projects/new`
- Quando há projetos existentes, o CTA não compete com eles — é visível mas hierarquicamente secundário
- Quando não há projetos, o CTA é o elemento central da tela

### 3. Lista de projetos
Cada item exibe obrigatoriamente:
- **Título** — nome do projeto
- **Descrição** — texto livre, truncado a 3-4 linhas com ellipsis
- **Status** — um de: `ativo`, `processando`, `aguardando`, `pronto` (com label, não só cor)
- **Última atualização** — tempo relativo ("há 3 dias", "há 12 min")
- **Número de normalizações configuradas** — ex: "4 normalizações"
- Toda a área é clicável, leva para `/projects/[id]`

### 4. Estado vazio
- Quando o usuário não tem nenhum projeto
- Copy direto, sem infantilizar — ex: "Nenhum projeto ainda. Crie o primeiro para começar a processar relatórios."
- CTA para `/projects/new` como elemento central

---

## Status dos projetos

| Valor | Significado |
|---|---|
| `ativo` | Projeto configurado, sem processamento em andamento |
| `processando` | Um relatório está sendo processado agora |
| `aguardando` | Upload recebido, processamento ainda não iniciou |
| `pronto` | Último relatório concluído, disponível para download |

O status `processando` tem natureza temporal: a UI pode precisar de polling ou WebSocket para refletir progresso em tempo real sem reload manual.

---

## Modelo de dados

```typescript
type ProjectStatus = "ativo" | "processando" | "aguardando" | "pronto";

interface Project {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  updatedAt: Date;
  normalizationCount: number; // colunas configuradas para normalização neste projeto
}
```

---

## Ações por projeto

| Ação | Comportamento |
|---|---|
| Abrir | Clique no item navega para `/projects/[id]` |
| Excluir | Ação destrutiva com confirmação obrigatória (HU-02); sem exclusão acidental |

Sem edição inline na lista. Toda edição de configuração acontece dentro do projeto (`/projects/[id]/config`).

---

## Estados da página

| Estado | Condição | Comportamento |
|---|---|---|
| Carregando | Dados ainda não chegaram | Skeleton ou indicador — sem flash de "vazio" |
| Com projetos | ≥1 projeto retornado | Lista completa |
| Vazio | 0 projetos | Estado de onboarding com CTA central |
| Erro | Falha ao buscar projetos | Mensagem de erro + opção de retry |

---

## Restrições de design

- **Não usar grid de cards idênticos** (proibido pelo design system: "identical card grids"). Explore lista estruturada, tabela estilizada, ou layout com ritmo variável entre itens.
- **Status nunca só por cor** — sempre label acompanhando o indicador visual (WCAG AA).
- **Descrições variáveis**: 2 a 4 linhas no conteúdo real; o layout precisa acomodar a variação sem desalinhar os itens.
- **Escalabilidade**: com 10+ projetos, a estrutura deve comportar ordenação — reservar espaço arquitetural para isso, sem implementar agora (fora do MVP).
- **Sidebar colapsada por padrão**: a página deve funcionar bem com 60px de sidebar; não assumir 220px disponíveis.

---

## Fora do escopo desta página

- Edição de configuração de colunas → `/projects/[id]/config`
- Upload de relatórios → `/projects/[id]`
- Histórico de execuções → `/projects/[id]`
- Filtros, busca e ordenação → pós-MVP
