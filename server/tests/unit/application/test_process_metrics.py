from application.reports.process_report import _extract_metrics
from domain.classification.entities import ClassificationResult


class _FakeProcessor:
    def __init__(self, metrics: dict) -> None:
        self.last_metrics = metrics


def test_extract_metrics_serializes_classification_results():
    processor = _FakeProcessor(
        {
            "especies": ClassificationResult(
                categories=["Mamíferos", "Aves", "Outros"],
                value_to_category={
                    "Pitbull": "Mamíferos",
                    "Pombo": "Aves",
                    "X": "Outros",
                },
                failed_values=["X"],
            )
        }
    )

    metrics = _extract_metrics(processor)

    assert metrics == {
        "columns": {
            "especies": {
                "categories": ["Mamíferos", "Aves", "Outros"],
                "unique_values": 3,
                "classified_ok": 2,
                "fell_to_others": 1,
            }
        }
    }


def test_extract_metrics_returns_none_when_processor_has_no_attr():
    class _Plain:
        pass

    assert _extract_metrics(_Plain()) is None


def test_extract_metrics_returns_none_when_empty():
    assert _extract_metrics(_FakeProcessor({})) is None
