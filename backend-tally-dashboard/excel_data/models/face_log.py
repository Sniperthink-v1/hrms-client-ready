from django.db import models
from django.utils import timezone

from .tenant import Tenant
from .employee import EmployeeProfile


class FaceAttendanceLog(models.Model):
    """
    Immutable log of face-based attendance events.

    Central source of truth for:
    - Who was recognized
    - When (UTC)
    - Mode: clock_in / clock_out
    - Result: recognized or not
    - Confidence score and message
    - Origin: mobile / web / other (for future use)
    """

    EVENT_TYPE_CHOICES = [
        ("registration", "Registration"),
        ("verification", "Verification"),
    ]

    MODE_CHOICES = [
        ("clock_in", "Clock In"),
        ("clock_out", "Clock Out"),
    ]

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="face_logs")
    employee = models.ForeignKey(
        EmployeeProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="face_logs",
    )

    event_type = models.CharField(max_length=16, choices=EVENT_TYPE_CHOICES, default="verification")
    # Mode is only meaningful for verification events
    mode = models.CharField(max_length=16, choices=MODE_CHOICES, null=True, blank=True)
    # If employee FK is null (e.g. failure), still store attempted identifier if provided
    employee_identifier = models.CharField(max_length=64, null=True, blank=True)
    recognized = models.BooleanField(default=False)
    confidence = models.FloatField(null=True, blank=True)
    message = models.CharField(max_length=255, blank=True)

    source = models.CharField(
        max_length=32,
        blank=True,
        help_text="Source channel, e.g. 'mobile', 'web', 'kiosk'",
    )

    # When the event actually happened (UTC)
    event_time = models.DateTimeField(default=timezone.now, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "excel_data"
        db_table = "excel_data_face_attendance_log"
        indexes = [
            models.Index(fields=["tenant", "event_time"], name="face_log_tenant_time_idx"),
            models.Index(fields=["tenant", "employee", "event_time"], name="face_log_employee_time_idx"),
        ]

    def __str__(self) -> str:
        emp = self.employee.employee_id if self.employee else "unknown"
        label = self.mode or self.event_type
        return f"{label} - {emp} - {self.event_time.isoformat()}"

