from domain.classification.entities import OTHERS_CATEGORY

DISCOVERY_SYSTEM = """Você é um especialista em organização de dados jurídicos brasileiros.

Sua tarefa é analisar uma amostra de valores de uma coluna de planilha e propor
categorias coerentes que cubram esses valores e os que vierem depois.

Regras obrigatórias:
- Proponha entre 5 e 15 categorias.
- Categorias devem ser substantivos curtos em português, com inicial maiúscula
  (ex.: "Aves", "Cães", "Equinos", "Tribunais Estaduais").
- Categorias devem ser semanticamente distintas e mutuamente exclusivas.
- Inclua sempre, como última categoria da lista, exatamente o nome "{others}".
- Se o usuário fornecer contexto, ele define o domínio e o nível de granularidade
  das categorias. Use esse contexto como prioridade sobre preferências genéricas.
- Não invente categorias sem suporte na amostra. Se a amostra é heterogênea,
  prefira menos categorias mais amplas a muitas categorias específicas.
"""


DISCOVERY_USER = """Coluna: "{column_name}"
Amostra de {sample_count} valores únicos:

{values}

Proponha as categorias agora, no formato JSON definido pelo schema."""


CLASSIFY_SYSTEM = """Você classifica valores em categorias pré-definidas.

Regras obrigatórias:
- Cada valor recebe EXATAMENTE UMA categoria.
- Use apenas categorias da lista fornecida pelo usuário. Não invente categorias novas.
- Se o valor não cabe em nenhuma categoria específica, use "{others}".
- Preserve o valor original exatamente como recebido (mesma string, mesmo case, sem editar).
- Responda com um item por valor, na mesma ordem da entrada.
"""


CLASSIFY_USER = """Categorias disponíveis (use apenas estas):
{categories}

Coluna: "{column_name}"

Classifique cada valor abaixo:
{values}

Responda no formato JSON definido pelo schema, com um item para cada valor."""


RULES_SYSTEM = """Você cria regras genéricas de classificação para planilhas.

Regras obrigatórias:
- Use apenas categorias da lista fornecida pelo usuário.
- Gere keywords curtas, aliases e termos recorrentes observados na amostra.
- Não use conhecimento fixo de um domínio específico; derive as regras da amostra,
  dos nomes das categorias e do contexto fornecido pelo usuário.
- Não inclua keywords ambíguas demais que poderiam bater em várias categorias.
- Não crie regra para "{others}".
"""


RULES_USER = """Categorias disponíveis:
{categories}

Coluna: "{column_name}"

Amostra de valores:
{values}

Gere regras de keywords no formato JSON definido pelo schema."""


def build_discovery_messages(
    column_name: str,
    sample: list[str],
    project_instructions: str | None,
) -> tuple[str, str]:
    system = DISCOVERY_SYSTEM.format(others=OTHERS_CATEGORY)
    if project_instructions:
        system = f"{system}\nContexto fornecido pelo usuário:\n{project_instructions.strip()}\n"
    user = DISCOVERY_USER.format(
        column_name=column_name,
        sample_count=len(sample),
        values="\n".join(f"- {value}" for value in sample),
    )
    return system, user


def build_rule_messages(
    column_name: str,
    categories: list[str],
    sample: list[str],
    project_instructions: str | None,
) -> tuple[str, str]:
    system = RULES_SYSTEM.format(others=OTHERS_CATEGORY)
    if project_instructions:
        system = f"{system}\nContexto fornecido pelo usuário:\n{project_instructions.strip()}\n"
    user = RULES_USER.format(
        categories=", ".join(categories),
        column_name=column_name,
        values="\n".join(f"- {value}" for value in sample),
    )
    return system, user


def build_classify_messages(
    column_name: str,
    categories: list[str],
    batch: list[str],
    project_instructions: str | None,
) -> tuple[str, str]:
    system = CLASSIFY_SYSTEM.format(others=OTHERS_CATEGORY)
    if project_instructions:
        system = f"{system}\nContexto fornecido pelo usuário:\n{project_instructions.strip()}\n"
    user = CLASSIFY_USER.format(
        categories=", ".join(categories),
        column_name=column_name,
        values="\n".join(f"- {value}" for value in batch),
    )
    return system, user
