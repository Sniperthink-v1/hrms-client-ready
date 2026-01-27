import json
from typing import List

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from cryptography.fernet import Fernet, InvalidToken


def _get_fernet() -> Fernet:
    """
    Returns a Fernet instance using a symmetric key from settings.

    You MUST set FACE_EMBEDDING_SECRET_KEY in environment; it should be a
    base64 url-safe key generated via: Fernet.generate_key().decode().
    """
    key = getattr(settings, "FACE_EMBEDDING_SECRET_KEY", None)
    if not key:
        raise ImproperlyConfigured(
            "FACE_EMBEDDING_SECRET_KEY is not configured in Django settings."
        )
    return Fernet(key.encode("utf-8") if isinstance(key, str) else key)


def encrypt_embedding(embedding: List[float]) -> str:
    """
    Serialize an embedding (list of floats) to JSON and encrypt it.
    """
    f = _get_fernet()
    payload = json.dumps(embedding, separators=(",", ":")).encode("utf-8")
    token = f.encrypt(payload)
    return token.decode("utf-8")


def decrypt_embedding(encrypted: str) -> List[float]:
    """
    Decrypt and deserialize an embedding from storage.
    """
    f = _get_fernet()
    try:
        data = f.decrypt(encrypted.encode("utf-8"))
    except InvalidToken as exc:
        raise ValueError("Invalid embedding encryption token") from exc
    return json.loads(data.decode("utf-8"))

