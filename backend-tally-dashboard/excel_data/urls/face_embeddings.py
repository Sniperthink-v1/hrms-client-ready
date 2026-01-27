from django.urls import path

from ..views.face_embeddings import FaceEmbeddingRegisterView, FaceEmbeddingVerifyView
from ..views.face_logs import FaceAttendanceLogListView

urlpatterns = [
    path('face-embeddings/register/', FaceEmbeddingRegisterView.as_view(), name='face-embeddings-register'),
    path('face-embeddings/verify/', FaceEmbeddingVerifyView.as_view(), name='face-embeddings-verify'),
    path('face-attendance/logs/', FaceAttendanceLogListView.as_view(), name='face-attendance-logs'),
]

