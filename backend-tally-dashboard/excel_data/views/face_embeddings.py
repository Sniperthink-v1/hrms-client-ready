from typing import List, Optional

import logging
from django.utils import timezone
from django.db import transaction
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from ..models import EmployeeProfile
from ..models.face_embedding import FaceEmbedding
from ..models.face_log import FaceAttendanceLog
from ..models.pending_attendance import PendingAttendanceUpdate
from ..utils.face_embedding_crypto import encrypt_embedding
from ..utils.face_embedding_cache import get_cached_embeddings, clear_tenant_cache
from ..utils.face_attendance import is_off_day, mark_face_attendance


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

        # Bump cache version and clear local cache for this tenant
        try:
            from django.db.models import F
            from ..models import Tenant
            Tenant.objects.filter(id=tenant.id).update(
                embedding_cache_version=F("embedding_cache_version") + 1
            )
            clear_tenant_cache(tenant.id)
        except Exception as exc:
            logger.warning("Failed to bump embedding cache version for tenant %s: %s", tenant.id, exc)

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

    DEFAULT_THRESHOLD = 0.65

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

        # Fetch cached embeddings for this tenant
        cached_embeddings = get_cached_embeddings(tenant)
        if not cached_embeddings:
            return Response(
                {"recognized": False, "message": "No face registrations found for this tenant."},
                status=status.HTTP_200_OK,
            )

        best_score: float = 0.0
        best_employee_id: Optional[int] = None

        for employee_id, stored in cached_embeddings:
            score = _cosine_similarity(embedding, stored)
            if score > best_score:
                best_score = score
                best_employee_id = employee_id

        threshold = getattr(tenant, "face_similarity_threshold", self.DEFAULT_THRESHOLD)

        if not best_employee_id or best_score < threshold:
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

        employee = EmployeeProfile.objects.filter(id=best_employee_id, tenant=tenant).first()
        if not employee:
            try:
                FaceAttendanceLog.objects.create(
                    tenant=tenant,
                    event_type="verification",
                    mode=mode,
                    recognized=False,
                    confidence=float(best_score),
                    message="Face matched to missing employee record.",
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
                    "message": "Matched employee not found. Please contact support.",
                },
                status=status.HTTP_200_OK,
            )

        FaceEmbedding.objects.filter(tenant=tenant, employee=employee).update(last_used_at=timezone.now())

        import pytz
        tz_name = getattr(tenant, "timezone", "UTC") or "UTC"
        tz = pytz.timezone(tz_name) if tz_name in pytz.all_timezones else pytz.UTC
        local_today = timezone.now().astimezone(tz).date()
        if is_off_day(employee, local_today):
            try:
                FaceAttendanceLog.objects.create(
                    tenant=tenant,
                    employee=employee,
                    employee_identifier=employee.employee_id or str(employee.id),
                    event_type="verification",
                    mode=mode,
                    recognized=True,
                    confidence=float(best_score),
                    message="Off-day check-in detected. Admin must mark attendance manually.",
                    source="mobile",
                    event_time=timezone.now(),
                )
            except Exception as exc:
                logger.warning(
                    "Failed to create off-day FaceAttendanceLog for employee %s: %s",
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
                    "message": "Off-day check-in detected. Admin must mark attendance manually.",
                    "requires_admin": True,
                },
                status=status.HTTP_200_OK,
            )

        # Mark daily attendance so it reflects immediately in web + mobile dashboards
        try:
            mark_face_attendance(tenant, employee, mode, event_time=timezone.now())
        except Exception as exc:
            # Enqueue for retry without blocking inference
            try:
                PendingAttendanceUpdate.objects.create(
                    tenant=tenant,
                    employee=employee,
                    employee_identifier=employee.employee_id or str(employee.id),
                    mode=mode,
                    event_time=timezone.now(),
                    source="mobile",
                    status="pending",
                    last_error=str(exc),
                )
            except Exception as enqueue_exc:
                logger.warning(
                    "Failed to enqueue pending attendance update for employee %s: %s",
                    employee.employee_id,
                    enqueue_exc,
                )
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
