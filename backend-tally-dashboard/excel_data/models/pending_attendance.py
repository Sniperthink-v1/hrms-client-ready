from django.db import models
from django.utils import timezone

from .tenant import Tenant
from .employee import EmployeeProfile


class PendingAttendanceUpdate(models.Model):
    """
    Durable queue for retrying face-based attendance updates.
    """

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("processing", "Processing"),
        ("completed", "Completed"),
        ("failed", "Failed"),
    ]

    MODE_CHOICES = [
        ("clock_in", "Clock In"),
        ("clock_out", "Clock Out"),
    ]

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="pending_attendance_updates")
    employee = models.ForeignKey(
        EmployeeProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pending_attendance_updates",
    )
    employee_identifier = models.CharField(max_length=64, null=True, blank=True)
    mode = models.CharField(max_length=16, choices=MODE_CHOICES)
    event_time = models.DateTimeField(default=timezone.now)
    source = models.CharField(max_length=32, blank=True)

    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="pending")
    attempt_count = models.PositiveIntegerField(default=0)
    next_retry_at = models.DateTimeField(default=timezone.now, db_index=True)
    last_error = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "excel_data"
        db_table = "excel_data_pending_attendance_update"
        indexes = [
            models.Index(fields=["tenant", "status", "next_retry_at"], name="pending_attendance_retry_idx"),
        ]

    def __str__(self) -> str:
        return f"PendingAttendanceUpdate<{self.tenant_id}:{self.employee_id}:{self.mode}:{self.status}>"
