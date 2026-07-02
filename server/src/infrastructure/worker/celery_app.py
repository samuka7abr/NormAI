"""Celery app que processa execuções de relatório em segundo plano.

Subir worker:
  celery -A infrastructure.worker.celery_app.celery_app worker --loglevel=info

A integração com a fila (publish) está em `infrastructure/queue/celery_queue.py`.
A task que consome e processa vive em `infrastructure/worker/tasks.py`.
"""
from celery import Celery

from infrastructure.settings import get_settings


def create_celery_app() -> Celery:
    settings = get_settings()
    app = Celery(
        "normalizador",
        broker=settings.celery_broker_url,
        backend=settings.celery_result_backend,
        include=["infrastructure.worker.tasks"],
    )
    app.conf.update(
        task_default_queue=settings.celery_task_default_queue,
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
        timezone="UTC",
        enable_utc=True,
        # Long-running: ack tardio pra não perder job em crash.
        task_acks_late=True,
        worker_prefetch_multiplier=1,
        broker_connection_retry_on_startup=True,
    )
    return app


celery_app = create_celery_app()
