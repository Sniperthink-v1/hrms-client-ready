from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("excel_data", "0061_add_gate_keeper_role"),
    ]

    operations = [
        migrations.AddField(
            model_name="tenant",
            name="embedding_cache_version",
            field=models.PositiveIntegerField(
                default=0,
                help_text="Version for invalidating per-tenant embedding cache",
            ),
        ),
        migrations.CreateModel(
            name="PendingAttendanceUpdate",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("employee_identifier", models.CharField(blank=True, max_length=64, null=True)),
                ("mode", models.CharField(choices=[("clock_in", "Clock In"), ("clock_out", "Clock Out")], max_length=16)),
                ("event_time", models.DateTimeField(default=django.utils.timezone.now)),
                ("source", models.CharField(blank=True, max_length=32)),
                ("status", models.CharField(choices=[("pending", "Pending"), ("processing", "Processing"), ("completed", "Completed"), ("failed", "Failed")], default="pending", max_length=16)),
                ("attempt_count", models.PositiveIntegerField(default=0)),
                ("next_retry_at", models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ("last_error", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("employee", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="pending_attendance_updates", to="excel_data.employeeprofile")),
                ("tenant", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="pending_attendance_updates", to="excel_data.tenant")),
            ],
            options={
                "db_table": "excel_data_pending_attendance_update",
                "indexes": [
                    models.Index(fields=["tenant", "status", "next_retry_at"], name="pending_attendance_retry_idx"),
                ],
            },
        ),
    ]
