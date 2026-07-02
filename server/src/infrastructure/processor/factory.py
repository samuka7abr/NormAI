"""Factory que decide qual ReportProcessor instanciar.

Sem configuração de LLM, devolve o `NormalizationProcessor` puro (mantém o
comportamento anterior). Com LLM configurado, envolve em `ClassificationProcessor`
que aplica também a classificação por IA.
"""
from application.classification.classify_column import ClassifyColumnValuesUseCase
from application.reports.report_processor import ReportProcessor
from infrastructure.llm.openai_compatible_client import OpenAICompatibleClient
from infrastructure.processor.classification_processor import ClassificationProcessor
from infrastructure.processor.normalization_processor import NormalizationProcessor
from infrastructure.settings import Settings


def build_report_processor(settings: Settings) -> ReportProcessor:
    normalize = NormalizationProcessor()
    if not settings.llm_base_url or not settings.llm_model:
        return normalize

    llm = OpenAICompatibleClient(settings)
    classify = ClassifyColumnValuesUseCase(
        llm,
        sample_size=settings.llm_sample_size,
        batch_size=settings.llm_batch_size,
    )
    return ClassificationProcessor(
        normalization_processor=normalize,
        classify_use_case=classify,
    )
