# NormAI — Documentação do Protótipo

> Protótipo interativo da plataforma de normalização e classificação de planilhas jurídicas da equipe IDP × JusBrasil.
> Arquivo principal: [`NormAI.html`](NormAI.html)

---

## 1. Visão geral da arquitetura

O protótipo é composta por **3 telas principais** + **1 drawer off-canvas** que se sobrepõe a qualquer tela.

```
NormAI.html
├── Sidebar
└── Main
    ├── Home (lista de projetos)
    └── Project (configuração + arquivos)

Database Drawer (overlay, 800px) ── disparado por clique em qualquer CSV
```

---

## 2. Sidebar

### Estrutura a adicionar ou integrar com atual

1. **Botão "Início"** — leva à Home.
2. **Seção "Projetos · N" após divider** — label uppercase com contagem total e botão `+` para criar novo projeto.
3. **Lista de projetos** — botões com:
   - Título truncado com `text-overflow: ellipsis`
   - Badge numérico à direita com contagem de normalizações
   - Estado ativo: barra verde de 3px à esquerda + fundo cinza claro

### Comportamento

- A busca **não navega**, apenas filtra visualmente a lista
- O botão `+` cria um projeto vazio e **redireciona** para sua página
- Cliques na lista navegam para `Project { id }`

---

## 3. Home (Início)

> Componente: `Home` em `home.jsx`
> Rota: estado `{ view: "home" }`

Tela inicial após login. Densa, sem floreios — segue a regra *"interface de instrumento de precisão"*.

### Estrutura

#### 3.1. Header
- Título grande *"Olá, { User }."* em Inter 36px / 700 / tracking −0.03em
- Botão primário verde *"+ Novo projeto"* no canto direito

#### 3.2. Barra de estatísticas
Quatro métricas separadas por bordas finas em cima e embaixo:

| Métrica | Cálculo |
|---|---|
| Projetos | Total |
| Com relatório | Projetos com `uploadedFile` |
| Normalizações | Soma de Normalizações em todos os projetos |
| Linhas processadas | Soma de `normalizedFile.rows` em milhares |

#### 3.3. Lista de projetos
Cabeçalho com label "PROJETOS" + filtros segmentados *(Todos / Com relatório / Sem upload)*.

Cada linha (`.project-row`) é um grid de 5 colunas:

| Col | Conteúdo |
|---|---|
| 1 | Título + descrição truncada |
| 2 | Dot com a cor do status (Verde / Amarelo / Vermelho) |
| 3 | Contagem de Normalizações |
| 4 | Última atualização |
| 5 | Chevron `›` |

Com efeitos de hover e click

---

## 4. Página de Projeto

### 4.1. Cabeçalho
- Breadcrumbs: `Projetos / · Configuração do projeto`
- **Título editável inline** — clique no h1 e digite (sem botão de salvar separado, atualiza no `onChange`)
- Linha meta: execuções · última run · ID do projeto

### 4.2. Campos de texto

#### Descrição
Textarea de altura média (88px). Texto visível na lista da Home.

#### Contexto para IA ✨
Textarea grande (140px). Hint: *"Instruções aplicadas a todas as execuções"*. Ícone verde de sparkles indica que é instrução de IA.

### 4.3. Tarefas
Grid de 2 cards (`.task`) — checkboxes grandes em forma de card:

| Tarefa | Descrição |
|---|---|
| **Normalizar** | Capitalização PT-BR, abreviar, remover sufixos, tratar nulos, split por separador. |
| **Classificar** | Cria coluna nova com a categoria de cada valor. IA — categorias definidas ou inferidas. |

Estado checked: borda verde + fundo levemente tingido + checkmark branco em quadrado verde. Compatível com teclado (Space/Enter).

### 4.4. Banco de dados (file slots)
Grid 2x1:

#### Slot de **Upload** (esquerda)
Dois estados:

- **Vazio** — área tracejada com ícone de seta, *"Arraste um CSV ou XLSX"* + *"ou clique para selecionar do computador"*. Drop zone real (drag-over destaca em verde).
- **Preenchido** — card com ícone "CSV", nome do arquivo truncado, metadata (linhas formatadas em pt-BR · tamanho · tempo relativo). Click em qualquer parte abre o drawer. Link "Substituir arquivo" no rodapé.

#### Slot de **Download** (direita)
Três estados:

- **Não gerado** — call-to-action *"Processar agora"* (desabilitado se não há upload ou nenhuma task ativa)
- **Processando** — pill animada com pulso, texto *"Gerando arquivo…"*
- **Pronto** — card com ícone de sparkles verde, mesma estrutura do upload + link de download

Click no card pronto abre o drawer com o CSV normalizado.

### 4.5. Comportamento de processamento

`onProcess` simula um job assíncrono de 1.8s:
1. Status muda para `processando` com pulso animado
2. Ao terminar, gera `normalizedFile` com nome `_normalized.csv`
3. Incrementa `runs` e atualiza `lastRun`

---

## 5. Database Drawer (Off-canvas)

> Componente: `DatabaseDrawer` em `drawer.jsx`

Drawer de 800px que desliza da direita com `cubic-bezier(0.16, 1, 0.3, 1)` em 400ms, sobre um scrim escuro (35% black). Fechável por:
- Click no `×`
- Click no scrim
- Tecla **Esc**
- Botão "Concluir" no rodapé

### 5.1. Cabeçalho
- Eyebrow indicando se é **upload bruto** (cinza) ou **saída normalizada** (cinza)
- Nome do arquivo em destaque
- Meta: total de linhas · número de colunas · `head(N)` mostrado

### 5.2. Hint bar
- **CSV bruto:** *"Clique no título de uma coluna para marcá-la como coluna a ser normalizada."* + contador de colunas marcadas à direita
- **CSV normalizado:** *"Saída processada. Colunas `_categoria` foram criadas pela camada de classificação."*

### 5.3. Tabela (estilo pandas `head()`)
- Fonte monoespaçada (JetBrains Mono)
- Coluna `#` sticky com o row index estilo Python (0, 1, 2…)
- Headers sticky no topo
- **Headers clicáveis** (apenas no CSV bruto) — toggle entre estado normal e marcado
- Estado marcado:
  - Header: fundo `#006b5a` + texto branco + dot circular branco
  - Toda a coluna ganha fundo verde tingido a 5% e texto em verde-floresta
- Células nulas (`NA`, `Não informado`, valores vazios) em itálico cinza-muted
- Valores com `|` em vermelho discreto (sinalizando que precisam de split)
- Caption no rodapé estilo pandas: `[N rows × M columns]`

### 5.4. Rodapé do drawer
- **CSV bruto:**
  - Sem marcações: *"Marque pelo menos uma coluna para normalização."*
  - Com marcações: *"Normalizar:"* + chips monoespaçados com os nomes das colunas
- **CSV normalizado:** call-to-action *"Baixar CSV"* à direita

### 5.5. Persistência

Ao marcar/desmarcar colunas, o estado é **propagado para o projeto** (`columnsToNormalize`), persistindo entre aberturas do drawer e sobrevivendo a navegação entre Home e Project.

---

## 6. Toast

Notificação verde-escura no rodapé central, ~2.2s de duração. Disparada quando o usuário marca/desmarca uma coluna no drawer.

---

## 7. Mock data

O arquivo `data.js` expõe duas estruturas globais:

### `window.NORM_PROJECTS`
Array de 6 projetos representativos dos casos do PRD:

1. **Maus tratos a Animais** — caso de exemplo principal do PRD
2. **Improbidade Administrativa**
3. **Violência Doméstica · MP-MG**
4. **Direito do Consumidor · STJ**
5. **Tributário · TJRJ**
6. **Trabalhista · Reclamatórias**

Cada projeto tem: `id, title, description, aiContext, tasks{normalize, classify}, columnsToNormalize[], columnsToClassify[], uploadedFile, normalizedFile, lastRun, runs`.

### `window.CSV_SAMPLES`
Dicionário indexado por nome de arquivo. Cada amostra tem `columns[], rows[][], totalRows`. As amostras **brutas** contêm propositadamente as inconsistências descritas no PRD:

- Tribunal aparece como `TJSP`, `Tribunal de Justiça de São Paulo TJSP`, `tjsp`, `TJ-MG`, `TJMG Comarca de Itamogi`
- Comarcas com capitalização inconsistente: `Poços De Caldas`, `poços de caldas`
- Nulos disfarçados: `NA`, `Não informado`, `Não aplicável`
- Listas coladas: `Cachorro|Galgo Inglês`, `Inanição/Fome|Abandono`

As amostras **normalizadas** mostram o resultado esperado: valores atômicos, capitalização correta, siglas canônicas, e novas colunas `_categoria`.

---

## 8. Estado e fluxo

Todo o estado vive no componente `App`:

```js
projects        // array de projetos (mutável)
view            // { view: "home" } | { view: "project", projectId }
drawerFile      // string | null — arquivo aberto no drawer
drawerOpen      // boolean — controla animação
toast           // string | null — texto da notificação atual
```

Ações principais:

| Ação | Resultado |
|---|---|
| Click em projeto da sidebar/home | `setView({ view: "project", projectId })` |
| `+ Novo projeto` | Insere projeto vazio no topo + navega |
| Click em CSV | `setDrawerFile(name); setDrawerOpen(true)` |
| Marcar coluna | Atualiza `currentProject.columnsToNormalize` |
| Processar | Simula job de 1.8s e gera `normalizedFile` |

---

## 9. Design system aplicado

Aderência estrita ao `DESIGN.md`:

| Token | Uso |
|---|---|
| **`#006b5a`** | Botões primários, focus, headers marcados, identidade. ~8% da tela. |
| **`#1b3630`** | Avatar do usuário, toast, hover de botões verdes (`#005a4c`). |
| **`#f4f5f6`** | Fundo da página inteira. |
| **Inter** | 100% da UI. |
| **Archivo** | Apenas no logo (Display only rule respeitada). |
| **Tracking negativo** | −0.02 a −0.03em em todos os headlines. |
| **8px radius** | Botões, inputs, cards. |
| **Flat by default** | Única shadow estrutural — no drawer (`-16px 0 40px / 10%`). |
| **Transições 200–400ms** | Cores, bordas, e o slide do drawer (400ms expo-out). |

### Anti-padrões evitados
- ✗ Gradientes
- ✗ Glass / blur decorativo
- ✗ Border-left coloridos como acento
- ✗ Métric-card grids estilo BI template
- ✗ Emojis decorativos
- ✗ `#000` ou `#fff` puros (uso `#0a0a0a` no scrim, `#ffffff` apenas em cards)

---

## 10. O que **falta** do PRD

Itens das histórias de usuário que ainda não estão implementados:

| HU | Item | Status |
|---|---|---|
| HU-01 | Login / signup | Não implementado (sidebar já mostra usuário logado) |
| HU-03 | Configuração coluna-a-coluna (ignorar, escolher normalizações, definir categorias) | Parcial — drawer marca colunas, falta detalhe por coluna |
| HU-05 | Barra de progresso em tempo real com etapa atual | Apenas pulso simples |
| HU-06 | Escolha CSV vs XLSX no download | Botão único hoje |
| HU-07 | Aprovado / rejeitado com motivo | Não implementado |
| HU-08 | Dicionário global de preferências | Não implementado |

Esses são bons candidatos para a próxima rodada de variações.
