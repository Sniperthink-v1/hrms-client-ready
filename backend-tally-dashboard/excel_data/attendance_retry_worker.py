import logging
import threading
import time
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)


def _backoff_seconds(attempt_count: int) -> int:
    # Exponential backoff: 30s, 60s, 120s, 240s, 480s (max 1h)
    base = 30
    return min(3600, base * (2 ** max(0, attempt_count - 1)))


def process_pending_attendance_batch(batch_size: int = 25, max_attempts: int = 5) -> int:
    """
    Process a batch of pending attendance updates using row locks to avoid duplication.
    Returns number of processed records.
    """
    from excel_data.models import PendingAttendanceUpdate, EmployeeProfile, Tenant
    from excel_data.utils.face_attendance import mark_face_attendance

    now = timezone.now()
    items = []

    with transaction.atomic():
        qs = (
            PendingAttendanceUpdate.objects.select_for_update(skip_locked=True)
            .filter(status="pending", next_retry_at__lte=now)
            .order_by("next_retry_at")[:batch_size]
        )
        for item in qs:
            item.status = "processing"
            item.attempt_count += 1
            item.last_error = ""
            item.save(update_fields=["status", "attempt_count", "last_error", "updated_at"])
            items.append(item)

    if not items:
        return 0

    for item in items:
        try:
            tenant = Tenant.objects.filter(id=item.tenant_id).first()
            if not tenant:
                raise ValueError("Tenant not found")

            employee = None
            if item.employee_id:
                employee = EmployeeProfile.objects.filter(
                    id=item.employee_id, tenant_id=item.tenant_id, is_active=True
                ).first()
            if not employee and item.employee_identifier:
                employee = EmployeeProfile.objects.filter(
                    tenant_id=item.tenant_id, employee_id=item.employee_identifier, is_active=True
                ).first()

            if not employee:
                raise ValueError("Employee not found or inactive")

            mark_face_attendance(tenant, employee, item.mode, event_time=item.event_time)

            item.status = "completed"
            item.save(update_fields=["status", "updated_at"])
        except Exception as exc:
            retry_delay = _backoff_seconds(item.attempt_count)
            item.last_error = str(exc)
            if item.attempt_count >= max_attempts:
                item.status = "failed"
            else:
                item.status = "pending"
                item.next_retry_at = timezone.now() + timedelta(seconds=retry_delay)
            item.save(update_fields=["status", "next_retry_at", "last_error", "updated_at"])

    return len(items)


def start_pending_attendance_worker(poll_interval_seconds: int = 10):
    """
    Start a background thread that retries pending attendance updates.
    """
    def _run():
        logger.info("Pending attendance retry worker started")
        while True:
            try:
                processed = process_pending_attendance_batch()
                if processed == 0:
                    time.sleep(poll_interval_seconds)
            except Exception as exc:
                logger.error("Pending attendance worker error: %s", exc, exc_info=True)
                time.sleep(poll_interval_seconds)

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
    return thread
