from dataclasses import dataclass


@dataclass
class ClassifyColumnInput:
    """Entrada do ClassifyColumnValuesUseCase.

    `values` é a lista completa de valores da coluna (pode ter duplicatas).
    Cabe ao caller filtrar nulos/vazios antes de chamar — esses não devem ser classificados.
    `project_instructions` é o texto livre vindo de Project.ai_context (concatenado no
    system prompt). Pode ser None se o projeto não tem contexto definido.
    """

    column_name: str
    values: list[str]
    project_instructions: str | None = None
