from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('excel_data', '0056_tenant_face_attendance_enabled'),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                "ALTER TABLE excel_data_employeeprofile "
                "ADD COLUMN IF NOT EXISTS face_person_id VARCHAR(64);"
            ),
            reverse_sql=(
                "ALTER TABLE excel_data_employeeprofile "
                "DROP COLUMN IF EXISTS face_person_id;"
            ),
            state_operations=[
                migrations.AddField(
                    model_name='employeeprofile',
                    name='face_person_id',
                    field=models.CharField(blank=True, max_length=64, null=True),
                ),
            ],
        ),
        migrations.RunSQL(
            sql=(
                "ALTER TABLE excel_data_employeeprofile "
                "ADD COLUMN IF NOT EXISTS face_persisted_face_id VARCHAR(64);"
            ),
            reverse_sql=(
                "ALTER TABLE excel_data_employeeprofile "
                "DROP COLUMN IF EXISTS face_persisted_face_id;"
            ),
            state_operations=[
                migrations.AddField(
                    model_name='employeeprofile',
                    name='face_persisted_face_id',
                    field=models.CharField(blank=True, max_length=64, null=True),
                ),
            ],
        ),
        migrations.RunSQL(
            sql=(
                "ALTER TABLE excel_data_employeeprofile "
                "ADD COLUMN IF NOT EXISTS face_registered_at TIMESTAMP WITH TIME ZONE;"
            ),
            reverse_sql=(
                "ALTER TABLE excel_data_employeeprofile "
                "DROP COLUMN IF EXISTS face_registered_at;"
            ),
            state_operations=[
                migrations.AddField(
                    model_name='employeeprofile',
                    name='face_registered_at',
                    field=models.DateTimeField(blank=True, null=True),
                ),
            ],
        ),
    ]
