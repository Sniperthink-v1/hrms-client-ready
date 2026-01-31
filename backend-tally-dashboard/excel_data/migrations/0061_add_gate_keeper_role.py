from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("excel_data", "0060_face_attendance_log_event_type"),
    ]

    operations = [
        migrations.AlterField(
            model_name="customuser",
            name="role",
            field=models.CharField(
                choices=[
                    ("admin", "Admin"),
                    ("hr_manager", "HR Manager"),
                    ("payroll_master", "Payroll Master"),
                    ("gate_keeper", "Gate Keeper"),
                    ("supervisor", "Supervisor"),
                    ("employee", "Employee"),
                ],
                default="employee",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="invitationtoken",
            name="role",
            field=models.CharField(
                choices=[
                    ("admin", "Admin"),
                    ("hr_manager", "HR Manager"),
                    ("payroll_master", "Payroll Master"),
                    ("gate_keeper", "Gate Keeper"),
                    ("supervisor", "Supervisor"),
                    ("employee", "Employee"),
                ],
                default="employee",
                max_length=20,
            ),
        ),
    ]
