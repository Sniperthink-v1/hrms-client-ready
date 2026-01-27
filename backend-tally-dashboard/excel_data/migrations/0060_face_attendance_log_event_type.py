from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('excel_data', '0059_faceattendancelog'),
    ]

    operations = [
        migrations.AddField(
            model_name='faceattendancelog',
            name='event_type',
            field=models.CharField(choices=[('registration', 'Registration'), ('verification', 'Verification')], default='verification', max_length=16),
        ),
        migrations.AddField(
            model_name='faceattendancelog',
            name='employee_identifier',
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.AlterField(
            model_name='faceattendancelog',
            name='mode',
            field=models.CharField(blank=True, choices=[('clock_in', 'Clock In'), ('clock_out', 'Clock Out')], max_length=16, null=True),
        ),
    ]
