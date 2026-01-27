from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.exceptions import ValidationError

from .employee import EmployeeProfile
from .tenant import Tenant


class FaceEmbedding(models.Model):
    """
    Stores an encrypted face embedding for an employee within a tenant.

    The raw embedding (Float32 array from MobileFaceNet) is:
    - Normalized on-device (L2)
    - Serialized to JSON
    - Encrypted using a symmetric key before persisting.
    """

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name="face_embeddings",
    )
    employee = models.OneToOneField(
        EmployeeProfile,
        on_delete=models.CASCADE,
        related_name="face_embedding",
    )

    # Encrypted JSON string of the embedding vector
    embedding_encrypted = models.TextField()

    # Optional metadata
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    # Cosine-similarity threshold used when this embedding was created (for auditing/tuning)
    similarity_threshold = models.FloatField(default=0.55)

    class Meta:
        app_label = "excel_data"
        db_table = "excel_data_face_embedding"
        indexes = [
            models.Index(fields=["tenant", "employee"], name="face_embedding_employee_idx"),
        ]

    def __str__(self):
        return f"FaceEmbedding<{self.employee_id}> ({self.tenant_id})"

