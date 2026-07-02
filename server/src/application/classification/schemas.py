from pydantic import BaseModel, Field


class CategoryDiscoveryResponse(BaseModel):
    """Resposta do LLM na fase de descoberta. Lista de nomes de categoria curtos em PT-BR."""

    categories: list[str] = Field(
        description="Entre 5 e 15 categorias curtas, mutuamente exclusivas, em português."
    )


class ClassifiedItem(BaseModel):
    value: str = Field(description="O valor original exatamente como recebido na entrada.")
    category: str = Field(description="Uma categoria da lista fornecida no prompt.")


class ClassifyBatchResponse(BaseModel):
    items: list[ClassifiedItem] = Field(
        description="Um item para cada valor da entrada, na mesma ordem."
    )


class CategoryRule(BaseModel):
    category: str = Field(description="Uma categoria da lista fornecida no prompt.")
    keywords: list[str] = Field(
        description="Palavras, aliases ou padrões curtos que indicam esta categoria."
    )


class CategoryRulesResponse(BaseModel):
    rules: list[CategoryRule] = Field(
        description="Regras de palavras-chave para acelerar a classificação."
    )
