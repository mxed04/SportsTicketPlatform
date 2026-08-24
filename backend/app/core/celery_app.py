import os
from celery import Celery

# Redis address from environment variables or Docker defaults
REDIS_URL = os.getenv(
    "REDIS_URL",
    "redis://sports_ticket_redis:6379/0",
)

celery_app = Celery(
    "sports_ticket_worker",
    broker=REDIS_URL,
    backend=REDIS_URL,
    # 🚀 FIXED: Explicitly tell Celery where to find and register the tasks
    include=["app.tasks.reservation_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
)
