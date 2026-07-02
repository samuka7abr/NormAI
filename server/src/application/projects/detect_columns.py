from abc import ABC, abstractmethod

from application.projects.dtos import DetectedColumnOutput


class ColumnDetector(ABC):
    @abstractmethod
    def detect(self, content: bytes, filename: str) -> list[DetectedColumnOutput]: ...


class DetectColumnsUseCase:
    def __init__(self, detector: ColumnDetector) -> None:
        self._detector = detector

    def execute(self, content: bytes, filename: str) -> list[DetectedColumnOutput]:
        return self._detector.detect(content, filename)
