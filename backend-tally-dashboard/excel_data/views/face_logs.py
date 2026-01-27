from datetime import datetime
from typing import Optional

from django.utils import timezone
from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from ..models import FaceAttendanceLog


class FaceAttendanceLogListView(APIView):
    """
    GET /api/face-attendance/logs/?date=YYYY-MM-DD&employee_id=<id>&mode=clock_in|clock_out&limit=50&offset=0

    Centralized log of face-based attendance events used by both mobile and web.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        tenant = getattr(request, "tenant", None)
        if not tenant:
            return Response({"error": "Tenant not found"}, status=status.HTTP_400_BAD_REQUEST)

        qs = FaceAttendanceLog.objects.select_related("employee").filter(tenant=tenant)

        # Filters
        date_str: Optional[str] = request.query_params.get("date")
        employee_id: Optional[str] = request.query_params.get("employee_id")
        mode: Optional[str] = request.query_params.get("mode")
        q: Optional[str] = request.query_params.get("q")

        if date_str:
            try:
                day = datetime.strptime(date_str, "%Y-%m-%d").date()
                qs = qs.filter(event_time__date=day)
            except ValueError:
                return Response({"error": "Invalid date format, expected YYYY-MM-DD"}, status=400)

        if employee_id:
            qs = qs.filter(employee__employee_id=employee_id)

        if mode in ("clock_in", "clock_out"):
            qs = qs.filter(mode=mode)

        if q:
            qv = q.strip()
            if qv:
                qs = qs.filter(
                    Q(employee__employee_id__icontains=qv)
                    | Q(employee__first_name__icontains=qv)
                    | Q(employee__last_name__icontains=qv)
                    | Q(employee_identifier__icontains=qv)
                    | Q(message__icontains=qv)
                    | Q(mode__icontains=qv)
                    | Q(event_type__icontains=qv)
                )

        # Pagination
        try:
            limit = int(request.query_params.get("limit", 50))
            offset = int(request.query_params.get("offset", 0))
        except ValueError:
            return Response({"error": "limit and offset must be integers"}, status=400)

        total = qs.count()
        logs = qs.order_by("-event_time")[offset : offset + limit]

        results = []
        for log in logs:
            emp = log.employee
            results.append(
                {
                    "id": log.id,
                    "employee_id": emp.employee_id if emp else log.employee_identifier,
                    "employee_name": (f"{emp.first_name} {emp.last_name}".strip() if emp else None),
                    "event_type": getattr(log, "event_type", None),
                    "mode": log.mode,
                    "recognized": log.recognized,
                    "confidence": log.confidence,
                    "message": log.message,
                    "source": log.source,
                    "event_time": log.event_time.isoformat(),
                }
            )

        return Response(
            {
                "count": len(results),
                "total": total,
                "offset": offset,
                "limit": limit,
                "results": results,
            }
        )

