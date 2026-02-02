from datetime import datetime, timedelta
import logging

import pytz
from django.core.cache import cache
from django.utils import timezone

logger = logging.getLogger(__name__)


def is_off_day(employee, target_date) -> bool:
    day_of_week = target_date.weekday()
    return (
        (day_of_week == 0 and employee.off_monday)
        or (day_of_week == 1 and employee.off_tuesday)
        or (day_of_week == 2 and employee.off_wednesday)
        or (day_of_week == 3 and employee.off_thursday)
        or (day_of_week == 4 and employee.off_friday)
        or (day_of_week == 5 and employee.off_saturday)
        or (day_of_week == 6 and employee.off_sunday)
    )


def mark_face_attendance(tenant, employee, mode: str, event_time=None) -> None:
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
    from excel_data.models import DailyAttendance

    tz_name = getattr(tenant, "timezone", "UTC") or "UTC"
    tz = pytz.timezone(tz_name) if tz_name in pytz.all_timezones else pytz.UTC

    if event_time is None:
        event_time = timezone.now()
    elif timezone.is_naive(event_time):
        event_time = timezone.make_aware(event_time, timezone.utc)

    local_now = event_time.astimezone(tz)
    today = local_now.date()
    employee_id = employee.employee_id or str(employee.id)

    try:
        if is_off_day(employee, today):
            return
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
        raise
