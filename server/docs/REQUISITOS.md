# PRD: Normalizador JusBrasil

**Equipe IDP × JusBrasil** · Versão 1.0 · maio/2026
*Documento para validação do cliente*

---

## 1. Em uma frase

Uma plataforma web onde o(a) Usuário(a) sobe planilhas de relatórios jurídicos (CSV ou Excel) e recebe de volta a mesma planilha com colunas limpas, padronizadas e classificadas em categorias, pronta para análise no Power BI ou Looker Studio.

---

## 2. O Problema

Hoje, o JusBrasil produz relatórios jurídicos em escala. As LLMs extraem informações de centenas de milhares de decisões judiciais e geram planilhas com colunas como `tribunal`, `comarca`, `especies_afetadas`, `tipos_violencia`, etc.

O conteúdo está lá, mas não está pronto pra análise. Os mesmos conceitos aparecem de formas diferentes:

* O mesmo tribunal aparece como `TJSP`, `Tribunal de Justiça de São Paulo TJSP`, `Tribunal de Justiça do Estado de São Paulo`
* A mesma comarca aparece como `Poços De Caldas`, `Poços de Caldas`, `poços de caldas`
* Variações nulas se misturam: `NA`, `Não informado`, `Nenhuma`, `Não aplicável`, `Não especificado`
* Listas de animais ou tipos de violência aparecem coladas com `|` (`Cachorro|Galgo Inglês`, `Inanição/Fome|Falta de Água|Abandono`)
* Não há agrupamento de alto nível: o(a) Usuário(a) quer ver "Aves" englobando `Pombo`, `Papagaio`, `Pintassilgo de cabeça preta`, mas o relatório dá apenas a espécie

Antes de qualquer análise no Power BI, alguém precisa normalizar e classificar tudo isso à mão. É um trabalho repetitivo, demorado e propenso a erro humano.

---

## 3. A Solução

Uma plataforma que faz esse trabalho automaticamente, em duas camadas independentes que o(a) Usuário(a) combina como quiser.

### Camada 1: Normalização (sem IA, instantânea)

Transformações determinísticas, com regras claras, aplicadas por checkbox. Não usa IA, não tem custo por chamada, é rápido e previsível. As opções são:

* **Capitalização PT-BR**: corrige `poços de caldas` para `Poços de Caldas`, respeitando preposições.
* **Abreviação**: extrai siglas conhecidas (`Tribunal de Justiça de São Paulo TJSP` para `TJSP`).
* **Remover sufixos**: corta tudo depois de `-` ou `/` quando aplicável (`TJMG Comarca de Itamogi` para `TJMG`).
* **Tratar nulos disfarçados**: converte `NA`, `Não informado`, `Nenhuma`, `Não aplicável`, `Não especificado` em vazio padronizado.
* **Split por separador**: divide listas coladas por `|`, `;`, `/` em valores atômicos.
* **Trim e remover acentos**: para comparação consistente.

### Camada 2: Classificação (com IA)

Cria uma nova coluna com a categoria de cada valor. Aqui é onde a IA entra: ela agrupa os valores em categorias semanticamente coerentes.

Funciona em dois modos:

* **Categorias definidas pelo(a) Usuário(a)**: ele(a) escreve a lista (`Cães, Gatos, Aves, Equinos, Bovinos, Animais selvagens, Sem informação`) e a IA classifica cada valor numa dessas opções.
* **Categorias inferidas pela IA**: quando o(a) Usuário(a) não fornece a lista, o sistema descobre as categorias adequadas a partir dos próprios dados, e usa essas categorias para classificar tudo de forma consistente.

### Combinação

O(a) Usuário(a) configura por coluna:

* `tribunal`: só normalização (capitalize + abreviar + remover sufixo).
* `comarca`: só normalização (capitalize + remover sufixo).
* `especies_afetadas`: normalização (split por `|` + nulos) + classificação em categorias.
* `tipos_violencia`: normalização (split por `|`) + classificação inferida pela IA.

E uma vez configurado, é mete-bala: toda vez que ele(a) subir um novo relatório, a plataforma processa com a configuração salva. Sem aprovação manual, sem revisão linha a linha.

---

## 4. Fluxo do(a) Usuário(a)

### Configuração do projeto (uma vez)

1. O(a) Usuário(a) cria um projeto (ex.: "Maus tratos a Animais").
2. Faz upload de uma planilha de exemplo.
3. O sistema detecta as colunas automaticamente.
4. Para cada coluna, ele(a) escolhe:
   * Processar essa coluna? Sim/Não.
   * Quais checkboxes de normalização aplicar.
   * Classificar em categorias? Se sim, lista delas (opcional).
5. Salva a configuração do projeto.

### Uso recorrente (toda vez que recebe um relatório)

1. O(a) Usuário(a) abre o projeto, faz upload do CSV/XLSX novo.
2. O sistema valida que as colunas batem com a configuração.
3. Processa em segundo plano (5 a 15 minutos para 120k linhas, com barra de progresso).
4. Ele(a) pode fechar o navegador e voltar depois; o processamento continua.
5. Quando termina, baixa a planilha com as colunas normalizadas e as colunas novas de categoria.
6. Revisa: se estiver bom, marca como "aprovada". Se houver problema, marca como "rejeitada" e descreve o motivo.

### Aprendizado entre projetos (Dicionário Global)

O(a) Usuário(a) tem um dicionário global próprio, que vale para todos os projetos. Coisas como "para colunas tipo tribunal, sempre usar a sigla canônica" ficam guardadas e disponíveis em qualquer projeto novo. Ele(a) escolhe, na hora de salvar uma regra ou categoria, se quer guardar só naquele projeto ou no dicionário global.

---

## 5. Histórias de Usuário

As histórias descrevem, na perspectiva do(a) Usuário(a), o que ele(a) conseguirá fazer com a ferramenta. Cada uma tem critérios de aceite no formato **Dado / Quando / Então**, as condições verificadas para considerar a história entregue.

---

### HU-01 · Criar conta e entrar

> **Como** Usuário(a)
> **Quero** criar minha conta e fazer login
> **Para** ter um espaço próprio com meus projetos e meu dicionário global

**Critérios de aceite:**

* **Dado** que ainda não tenho conta, **quando** eu informar email e senha, **então** o sistema cria minha conta e me autentica.
* **Dado** que já tenho conta, **quando** eu informar email e senha corretos, **então** o sistema me autentica e mostra a lista dos meus projetos.
* **Dado** uma sessão ativa ficar inativa por algumas horas, **quando** eu voltar a usar a ferramenta, **então** o sistema pede login novamente.

---

### HU-02 · Criar e gerenciar projetos

> **Como** Usuário(a)
> **Quero** organizar meus relatórios em projetos
> **Para** agrupar relatórios do mesmo tema (ex.: "Improbidade Administrativa", "Maus tratos a Animais") e reaproveitar a configuração entre eles

**Critérios de aceite:**

* **Dado** que estou logado(a), **quando** eu criar um projeto com nome e descrição, **então** o projeto aparece na minha lista, vazio, aguardando configuração.
* **Dado** um projeto existente, **quando** eu abri-lo, **então** vejo sua configuração de colunas, suas categorias, e o histórico de relatórios processados.
* **Dado** um projeto, **quando** eu decidir excluí-lo, **então** o sistema pede confirmação e remove o projeto e seus dados.

---

### HU-03 · Configurar como cada coluna deve ser processada

> **Como** Usuário(a)
> **Quero** definir, uma única vez por projeto, como cada coluna deve ser tratada
> **Para** que todos os relatórios futuros sejam processados automaticamente do jeito que eu preciso

**Critérios de aceite:**

* **Dado** um projeto novo, **quando** eu fizer upload de uma planilha de referência, **então** o sistema detecta as colunas e me apresenta uma tela de configuração com cada uma delas.
* **Dado** a tela de configuração, **quando** eu olhar uma coluna, **então** vejo amostras dos valores reais para entender o conteúdo.
* **Dado** uma coluna, **quando** eu configurá-la, **então** posso escolher: ignorar essa coluna; aplicar uma ou mais normalizações (capitalize PT-BR, abreviar, remover sufixo, tratar nulos, split por separador); marcar para classificação em categorias.
* **Dado** que marquei uma coluna para classificação, **quando** eu quiser, **então** posso fornecer a lista de categorias (ex.: "Cães, Gatos, Aves, Equinos") ou deixar em branco para que o sistema descubra as categorias.
* **Dado** uma configuração concluída, **quando** eu salvar, **então** ela vale para todos os relatórios futuros do projeto.
* **Dado** uma configuração salva, **quando** eu precisar ajustar, **então** posso editá-la a qualquer momento (alterações valem a partir do próximo relatório; relatórios já processados ficam intactos).

---

### HU-04 · Enviar um relatório para processamento

> **Como** Usuário(a)
> **Quero** subir o CSV ou XLSX gerado pela LLM
> **Para** receber de volta a planilha normalizada e classificada conforme a configuração do projeto

**Critérios de aceite:**

* **Dado** um projeto configurado, **quando** eu fizer upload do arquivo, **então** o sistema valida que as colunas batem com a configuração e começa a processar em segundo plano.
* **Dado** um upload aceito, **quando** eu olhar a lista de relatórios, **então** vejo o status atual: "na fila", "processando", "pronto" ou "com erro".
* **Dado** que o sistema está processando, **quando** eu fechar o navegador e voltar depois, **então** o processamento continua e o status se mantém.
* **Dado** um arquivo cujas colunas não batem com a configuração do projeto, **quando** o upload acontecer, **então** o sistema avisa antes de processar e me deixa decidir entre cancelar, ajustar a configuração, ou processar mesmo assim ignorando colunas extras.

---

### HU-05 · Acompanhar o progresso

> **Como** Usuário(a)
> **Quero** acompanhar o processamento em tempo real
> **Para** saber quanto falta e identificar problemas cedo

**Critérios de aceite:**

* **Dado** um relatório sendo processado, **quando** eu abrir sua tela, **então** vejo barra de progresso, percentual concluído, etapa atual (normalização ou classificação) e tempo estimado.
* **Dado** um erro durante o processamento, **quando** ele ocorrer, **então** o sistema tenta novamente automaticamente; se persistir, registra o erro e continua processando o restante.

---

### HU-06 · Baixar o resultado processado

> **Como** Usuário(a)
> **Quero** baixar a planilha final
> **Para** carregar diretamente no Power BI ou Looker Studio para análise

**Critérios de aceite:**

* **Dado** um relatório com status "pronto", **quando** eu clicar em baixar, **então** posso escolher entre CSV ou XLSX e o sistema entrega o arquivo com as colunas normalizadas e as colunas novas de categoria.
* **Dado** um relatório com erros parciais, **quando** eu baixar, **então** o arquivo inclui as linhas processadas com sucesso e marca explicitamente as linhas com erro.
* **Dado** o mesmo relatório, **quando** eu reprocessar (depois de ajustar a configuração, por exemplo), **então** o sistema gera uma nova execução sem apagar a anterior; ambas ficam disponíveis para download e comparação.

---

### HU-07 · Avaliar e dar feedback sobre o resultado

> **Como** Usuário(a)
> **Quero** marcar cada relatório processado como aprovado ou rejeitado
> **Para** registrar a qualidade da entrega e comunicar problemas à equipe

**Critérios de aceite:**

* **Dado** um relatório processado, **quando** eu revisar e considerá-lo bom, **então** posso marcá-lo como "aprovado".
* **Dado** um relatório processado, **quando** eu identificar problemas, **então** posso marcá-lo como "rejeitado" e descrever o motivo em texto livre (ex.: "categorias muito amplas", "tribunal X não foi abreviado corretamente").
* **Dado** um relatório aprovado, **quando** eu quiser corrigir pontos pontuais antes de usar, **então** posso editar a planilha por fora e usar a versão corrigida na minha análise.

---

### HU-08 · Gerenciar o dicionário global de preferências

> **Como** Usuário(a)
> **Quero** ter um dicionário pessoal de preferências de normalização e classificação
> **Para** reusar essas preferências em qualquer projeto novo, sem reconfigurar tudo do zero

**Critérios de aceite:**

* **Dado** que estou logado(a), **quando** eu acessar meu dicionário global, **então** vejo as preferências que salvei (ex.: instruções de classificação favoritas, categorias reutilizáveis).
* **Dado** uma configuração de projeto, **quando** eu salvar uma regra ou lista de categorias, **então** posso escolher entre "salvar apenas neste projeto" ou "salvar no meu dicionário global".
* **Dado** um projeto novo, **quando** eu configurar uma coluna, **então** posso aplicar uma preferência do meu dicionário global com um clique.
* **Dado** uma preferência no dicionário global, **quando** eu identificar que ela não está mais adequada, **então** posso editá-la ou removê-la.

---

## 6. Escopo do MVP

### Está incluído

* Cadastro e login com email e senha (1 usuário por conta).
* Criação, edição e exclusão de projetos.
* Detecção automática de colunas a partir de uma planilha de exemplo.
* Configuração por coluna: ignorar, normalizar (com checkboxes), classificar.
* Upload de relatórios em CSV ou XLSX (volume entre 15 mil e 120 mil linhas).
* Processamento assíncrono em segundo plano com barra de progresso.
* Pipeline determinístico de normalização (sem IA).
* Classificação por IA com categorias definidas pelo(a) Usuário(a) ou inferidas pelo sistema.
* Garantia de consistência na classificação inferida (mesmas categorias do início ao fim do arquivo).
* Acompanhamento do processamento em tempo real.
* Download do resultado em CSV ou XLSX.
* Histórico de execuções: cada relatório processado fica preservado, mesmo se reprocessado.
* Avaliação aprovado/rejeitado com motivo.
* Dicionário global de preferências, reutilizável entre projetos.

### Fora do escopo (não será entregue no MVP)

Os itens abaixo são reconhecidos como úteis, mas ficam fora desta entrega para garantir o cumprimento do prazo. Podem ser discutidos em uma fase posterior.

* Integração direta com o BigQuery ou outros sistemas internos do JusBrasil.
* Geração automática de prompts para a LLM que produz os relatórios (o(a) Usuário(a) continua escrevendo os seus).
* Painel de analytics sobre os dados normalizados.
* API pública para outros sistemas consumirem a ferramenta.
* Suporte a outros idiomas além de português brasileiro.
* Login social (Google/Microsoft) ou SSO corporativo.
* Múltiplos usuários por conta, permissões e compartilhamento de projetos entre membros do time.
* Edição visual linha a linha do resultado dentro da ferramenta.
* Aprendizado automático a partir de correções (a v2 pode incorporar isso).

---

## 7. Critérios de Qualidade

A qualidade da entrega será avaliada de duas formas complementares.

### Métrica objetiva

Para cada relatório processado, o sistema reporta:

* Percentual de valores normalizados com sucesso por coluna.
* Percentual de valores classificados com sucesso por coluna.
* Número de erros e o tipo (formato inválido, falha na chamada à IA, valor não classificável, etc.).

Esses indicadores ficam visíveis na tela do relatório.

### Avaliação qualitativa

O(a) Usuário(a) revisa amostras dos relatórios processados e classifica cada execução como "aprovada" ou "rejeitada", com justificativa quando aplicável (HU-07). A meta percentual mínima aceitável será acordada em conjunto na primeira reunião de validação após o recebimento dos dados de exemplo.

---

## 8. Premissas e Dependências

Para que a equipe IDP consiga entregar dentro do prazo, os pontos abaixo precisam ser providenciados pelo JusBrasil:

* **Dados de exemplo.** O(a) Usuário(a) disponibiliza pelo menos 2 planilhas reais (com colunas e contextos diferentes) na primeira semana, para alinhar a detecção de colunas e os testes da camada determinística.
* **Custo da API de LLM durante o desenvolvimento.** Definir antes do início se o custo será absorvido pela equipe IDP, pelo JusBrasil ou se haverá um teto compartilhado.
* **Canal de comunicação ativo.** Grupo no WhatsApp criado e participantes adicionados, conforme acordado na reunião inicial.
* **Validação contínua.** Disponibilidade do(a) Usuário(a) (ou substituto designado) para responder dúvidas pontuais e participar de duas reuniões de validação ao longo do período.