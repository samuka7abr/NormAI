from unittest.mock import patch
from uuid import uuid4

from infrastructure.queue.celery_queue import CeleryProcessingQueue


async def test_enqueue_publishes_to_celery():
    queue = CeleryProcessingQueue()
    execution_id = uuid4()

    with patch(
        "infrastructure.queue.celery_queue.process_report_task.delay"
    ) as mock_delay:
        await queue.enqueue_execution(execution_id)

    mock_delay.assert_called_once_with(str(execution_id))


async def test_enqueue_passes_uuid_as_string():
    """Garante serialização JSON-safe: Celery não aceita UUID nativo em json."""
    queue = CeleryProcessingQueue()
    execution_id = uuid4()

    with patch(
        "infrastructure.queue.celery_queue.process_report_task.delay"
    ) as mock_delay:
        await queue.enqueue_execution(execution_id)

    args, _kwargs = mock_delay.call_args
    assert isinstance(args[0], str)
    assert args[0] == str(execution_id)
