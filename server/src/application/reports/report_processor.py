from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class ProcessingResult:
    content: bytes
    filename: str
    content_type: str


class ReportProcessor(ABC):
    """
    Interface de processamento de relatórios.
    Implementação concreta a cargo do Samuel — ver infrastructure/processor/normalization_processor.py.
    """

    @abstractmethod
    async def process(
        self,
        content: bytes,
        original_filename: str,
        column_config_snapshot: dict,
    ) -> ProcessingResult:
        """
        Recebe o arquivo bruto e o snapshot da config de colunas do momento do upload.
        Retorna o arquivo processado (normalizado + classificado) pronto para salvar no storage.
        """
