from typing import List, Optional

import logging
from django.utils import timezone
from django.db import transaction
from django.db.models import QuerySet
from django.core.cache import cache
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from ..models import EmployeeProfile, DailyAttendance
from ..models.face_embedding import FaceEmbedding
from ..models.face_log import FaceAttendanceLog
from ..utils.face_embedding_crypto import encrypt_embedding, decrypt_embedding


logger = logging.getLogger(__name__)


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    """
    Compute cosine similarity between two vectors.
    Assumes both are already L2-normalized on device, but we still handle edge cases.
    """
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = 0.0
    for x, y in zip(a, b):
        dot += float(x) * float(y)
    # Since embeddings are already normalized, the denominator is ~1.
    return float(dot)


def _mark_face_attendance(tenant, employee: EmployeeProfile, mode: str) -> None:
    """
    Create or update DailyAttendance for this employee based on face recognition.

    - mode == 'clock_in'  -> NEVER overwrite existing check_in; only compute late/OT deltas
    - mode == 'clock_out' -> NEVER overwrite existing check_out; only compute late/OT deltas
    - For clock_in:
        * If actual time < shift_start  => pre-shift OT
        * If actual time > shift_start  => late minutes
      For clock_out:
        * If actual time > shift_end    => post-shift OT
        * If actual time < shift_end    => shortfall counted as late minutes
    """
    import pytz
    from datetime import date, datetime, timedelta
    tz_name = getattr(tenant, "timezone", "UTC") or "UTC"
    tz = pytz.timezone(tz_name) if tz_name in pytz.all_timezones else pytz.UTC
    local_now = timezone.now().astimezone(tz)
    today = local_now.date()
    employee_id = employee.employee_id or str(employee.id)

    try:
        record, created = DailyAttendance.objects.get_or_create(
            tenant=tenant,
            employee_id=employee_id,
            date=today,
            defaults={
                "employee_name": f"{employee.first_name} {employee.last_name}".strip(),
                "department": employee.department or "General",
                "designation": employee.designation or "",
                "employment_type": employee.employment_type or "",
                "attendance_status": "PRESENT",
            },
        )

        now_local_time = local_now.time().replace(tzinfo=None)
        shift_start = getattr(employee, "shift_start_time", None)
        shift_end = getattr(employee, "shift_end_time", None)

        # CLOCK IN LOGIC (do not overwrite existing check_in)
        if mode == "clock_in":
            # If this is the first clock-in, set it; otherwise keep original
            if record.check_in is None:
                record.check_in = now_local_time

        # CLOCK OUT LOGIC (do not overwrite existing check_out)
        if mode == "clock_out":
            # If this is the first clock-out, set it; otherwise keep original
            if record.check_out is None:
                record.check_out = now_local_time

        # Deterministic late_minutes + ot_hours calculation (no double counting across multiple scans)
        # Uses stored check_in/check_out vs scheduled shift_start/shift_end
        if shift_start and shift_end and (record.check_in or record.check_out):
            shift_start_dt = datetime.combine(today, shift_start)
            shift_end_dt = datetime.combine(today, shift_end)
            if shift_end_dt <= shift_start_dt:
                # Overnight shift
                shift_end_dt = shift_end_dt + timedelta(days=1)

            check_in_dt = None
            if record.check_in:
                check_in_dt = datetime.combine(today, record.check_in)
                # Overnight shift: times after midnight belong to next day
                if shift_end_dt.date() != shift_start_dt.date() and check_in_dt < shift_start_dt:
                    check_in_dt = check_in_dt + timedelta(days=1)

            check_out_dt = None
            if record.check_out:
                check_out_dt = datetime.combine(today, record.check_out)
                if shift_end_dt.date() != shift_start_dt.date() and check_out_dt < shift_start_dt:
                    check_out_dt = check_out_dt + timedelta(days=1)
                if check_in_dt and check_out_dt < check_in_dt:
                    check_out_dt = check_out_dt + timedelta(days=1)

            # Late minutes:
            # - late_in: after shift_start
            # - early_out: before shift_end (requested to count as late minutes)
            late_in_minutes = 0
            if check_in_dt:
                late_in_minutes = max(0, int((check_in_dt - shift_start_dt).total_seconds() // 60))
            early_out_minutes = 0
            if check_out_dt:
                early_out_minutes = max(0, int((shift_end_dt - check_out_dt).total_seconds() // 60))
            record.late_minutes = late_in_minutes + early_out_minutes

            # OT hours:
            # - early_in: before shift_start
            # - late_out: after shift_end
            ot_early = 0.0
            if check_in_dt:
                ot_early = max(0.0, (shift_start_dt - check_in_dt).total_seconds() / 3600.0)
            ot_late = 0.0
            if check_out_dt:
                ot_late = max(0.0, (check_out_dt - shift_end_dt).total_seconds() / 3600.0)
            record.ot_hours = round(ot_early + ot_late, 1)

        # Ensure status present when either in/out has been marked
        if record.check_in or record.check_out:
            record.attendance_status = "PRESENT"

        record.save()

        # Invalidate lightweight attendance caches used by dashboard list view
        cache_keys = [
            f"attendance_list_{tenant.id}_offset_0_limit_50",
            f"attendance_list_{tenant.id}_offset_0_limit_100",
        ]
        for key in cache_keys:
            cache.delete(key)
        # Also clear aggregated attendance caches used by all_records
        try:
            cache.delete_pattern(f"attendance_all_records_{tenant.id}_*")
        except AttributeError:
            cache.delete(f"attendance_all_records_{tenant.id}")

    except Exception as exc:
        # Do not break face verification if attendance write fails
        logger.error(
            "Failed to mark face attendance for employee %s (tenant %s): %s",
            employee_id,
            getattr(tenant, "id", None),
            exc,
            exc_info=True,
        )


class FaceEmbeddingRegisterView(APIView):
    """
    POST /api/face-embeddings/register/

    Request:
    {
      "employee_id": "<id>",
      "embedding": [float, float, ...]
    }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        tenant = getattr(request, "tenant", None)
        if not tenant:
            return Response({"error": "Tenant not found"}, status=status.HTTP_400_BAD_REQUEST)
        if not getattr(tenant, "face_attendance_enabled", False):
            try:
                FaceAttendanceLog.objects.create(
                    tenant=tenant,
                    event_type="registration",
                    recognized=False,
                    employee_identifier=None,
                    message="Face attendance is disabled for this tenant.",
                    source="mobile",
                    event_time=timezone.now(),
                )
            except Exception:
                pass
            return Response(
                {"error": "Face attendance is disabled for this tenant"},
                status=status.HTTP_403_FORBIDDEN,
            )

        employee_id = request.data.get("employee_id")
        embedding = request.data.get("embedding")

        if not employee_id:
            try:
                FaceAttendanceLog.objects.create(
                    tenant=tenant,
                    event_type="registration",
                    recognized=False,
                    employee_identifier=None,
                    message="Registration failed: employee_id is required",
                    source="mobile",
                    event_time=timezone.now(),
                )
            except Exception:
                pass
            return Response({"error": "employee_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(embedding, list) or not embedding:
            try:
                FaceAttendanceLog.objects.create(
                    tenant=tenant,
                    event_type="registration",
                    recognized=False,
                    employee_identifier=str(employee_id),
                    message="Registration failed: embedding must be a non-empty list",
                    source="mobile",
                    event_time=timezone.now(),
                )
            except Exception:
                pass
            return Response({"error": "embedding must be a non-empty list"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            employee = EmployeeProfile.objects.get(id=employee_id, tenant=tenant)
        except EmployeeProfile.DoesNotExist:
            try:
                FaceAttendanceLog.objects.create(
                    tenant=tenant,
                    event_type="registration",
                    recognized=False,
                    employee_identifier=str(employee_id),
                    message="Registration failed: employee not found for this tenant",
                    source="mobile",
                    event_time=timezone.now(),
                )
            except Exception:
                pass
            return Response(
                {"error": "Employee not found for this tenant"},
                status=status.HTTP_404_NOT_FOUND,
            )

        encrypted = encrypt_embedding(embedding)

        with transaction.atomic():
            obj, created = FaceEmbedding.objects.select_for_update().get_or_create(
                tenant=tenant,
                employee=employee,
                defaults={
                    "embedding_encrypted": encrypted,
                },
            )
            if not created:
                obj.embedding_encrypted = encrypted
                obj.updated_at = timezone.now()
                obj.save(update_fields=["embedding_encrypted", "updated_at"])

        # Log successful registration
        try:
            FaceAttendanceLog.objects.create(
                tenant=tenant,
                employee=employee,
                employee_identifier=employee.employee_id or str(employee.id),
                event_type="registration",
                recognized=True,
                message="Face embedding registered successfully.",
                source="mobile",
                event_time=timezone.now(),
            )
        except Exception as exc:
            logger.warning("Failed to create FaceAttendanceLog for registration: %s", exc)

        return Response(
            {
                "success": True,
                "employee_id": employee.id,
                "employee_name": f"{employee.first_name} {employee.last_name}".strip(),
                "message": "Face embedding stored securely.",
            },
            status=status.HTTP_200_OK,
        )


class FaceEmbeddingVerifyView(APIView):
    """
    POST /api/face-embeddings/verify/

    Request:
    {
      "mode": "clock_in" | "clock_out",
      "embedding": [float, float, ...]
    }
    """

    permission_classes = [IsAuthenticated]

    DEFAULT_THRESHOLD = 0.55  # can be tuned per-tenant later

    def post(self, request, *args, **kwargs):
        tenant = getattr(request, "tenant", None)
        if not tenant:
            return Response({"error": "Tenant not found"}, status=status.HTTP_400_BAD_REQUEST)
        if not getattr(tenant, "face_attendance_enabled", False):
            try:
                FaceAttendanceLog.objects.create(
                    tenant=tenant,
                    event_type="verification",
                    recognized=False,
                    message="Face attendance is disabled for this tenant.",
                    source="mobile",
                    event_time=timezone.now(),
                )
            except Exception:
                pass
            return Response(
                {"error": "Face attendance is disabled for this tenant"},
                status=status.HTTP_403_FORBIDDEN,
            )

        mode = request.data.get("mode")
        embedding = request.data.get("embedding")

        if mode not in ("clock_in", "clock_out"):
            return Response(
                {"error": "mode must be 'clock_in' or 'clock_out'"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not isinstance(embedding, list) or not embedding:
            return Response({"error": "embedding must be a non-empty list"}, status=status.HTTP_400_BAD_REQUEST)

        # Fetch all embeddings for this tenant
        qs: QuerySet[FaceEmbedding] = FaceEmbedding.objects.select_related("employee").filter(
            tenant=tenant
        )
        if not qs.exists():
            return Response(
                {"recognized": False, "message": "No face registrations found for this tenant."},
                status=status.HTTP_200_OK,
            )

        best_score: float = 0.0
        best_obj: Optional[FaceEmbedding] = None

        for obj in qs:
            try:
                stored = decrypt_embedding(obj.embedding_encrypted)
            except Exception:
                # Skip corrupted entries silently
                continue
            score = _cosine_similarity(embedding, stored)
            if score > best_score:
                best_score = score
                best_obj = obj

        threshold = getattr(tenant, "face_similarity_threshold", self.DEFAULT_THRESHOLD)

        if not best_obj or best_score < threshold:
            # Persist centralized face log for failures as well
            try:
                FaceAttendanceLog.objects.create(
                    tenant=tenant,
                    event_type="verification",
                    mode=mode,
                    recognized=False,
                    confidence=float(best_score),
                    message="Face not recognized.",
                    source="mobile",
                    event_time=timezone.now(),
                )
            except Exception:
                pass
            return Response(
                {
                    "recognized": False,
                    "mode": mode,
                    "confidence": float(best_score),
                    "message": "Face not recognized. Please try again or register first.",
                },
                status=status.HTTP_200_OK,
            )

        employee = best_obj.employee
        best_obj.last_used_at = timezone.now()
        best_obj.save(update_fields=["last_used_at"])

        # Mark daily attendance so it reflects immediately in web + mobile dashboards
        try:
            _mark_face_attendance(tenant, employee, mode)
        except Exception as exc:
            # Already logged inside helper; keep response successful
            logger.warning(
                "Face recognized but attendance update failed for employee %s: %s",
                employee.employee_id,
                exc,
            )

        # Persist centralized face attendance log (for web + mobile)
        try:
            FaceAttendanceLog.objects.create(
                tenant=tenant,
                employee=employee,
                employee_identifier=employee.employee_id or str(employee.id),
                event_type="verification",
                mode=mode,
                recognized=True,
                confidence=float(best_score),
                message="Face recognized successfully.",
                source="mobile",  # Currently only mobile calls this endpoint
                event_time=timezone.now(),
            )
        except Exception as exc:
            logger.warning(
                "Failed to create FaceAttendanceLog for employee %s: %s",
                employee.employee_id,
                exc,
            )

        return Response(
            {
                "recognized": True,
                "mode": mode,
                "employee_id": str(employee.id),
                "employee_name": f"{employee.first_name} {employee.last_name}".strip(),
                "confidence": float(best_score),
                "timestamp": timezone.now().isoformat(),
                "message": "Face recognized successfully.",
            },
            status=status.HTTP_200_OK,
        )
