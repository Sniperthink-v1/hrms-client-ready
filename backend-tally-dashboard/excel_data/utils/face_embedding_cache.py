import threading
import time
import logging
from typing import Dict, List, Tuple

from .face_embedding_crypto import decrypt_embedding

logger = logging.getLogger(__name__)


class _TenantEmbeddingCacheEntry:
    __slots__ = ("version", "expires_at", "embeddings")

    def __init__(self, version: int, expires_at: float, embeddings: List[Tuple[int, List[float]]]):
        self.version = version
        self.expires_at = expires_at
        self.embeddings = embeddings


_CACHE_LOCK = threading.Lock()
_TENANT_CACHE: Dict[int, _TenantEmbeddingCacheEntry] = {}


def clear_tenant_cache(tenant_id: int) -> None:
    with _CACHE_LOCK:
        _TENANT_CACHE.pop(tenant_id, None)


def get_cached_embeddings(tenant, ttl_seconds: int = 600) -> List[Tuple[int, List[float]]]:
    """
    Return decrypted embeddings for a tenant with in-process caching.

    Cache entry is invalidated when:
    - TTL expires
    - tenant.embedding_cache_version changes
    """
    tenant_id = tenant.id
    version = int(getattr(tenant, "embedding_cache_version", 0) or 0)
    now = time.time()

    with _CACHE_LOCK:
        entry = _TENANT_CACHE.get(tenant_id)
        if entry and entry.version == version and entry.expires_at > now:
            return entry.embeddings

    # Cache miss or stale; rebuild
    from excel_data.models import FaceEmbedding

    embeddings: List[Tuple[int, List[float]]] = []
    try:
        qs = FaceEmbedding.objects.filter(tenant_id=tenant_id).only("employee_id", "embedding_encrypted")
        for obj in qs:
            try:
                decrypted = decrypt_embedding(obj.embedding_encrypted)
            except Exception:
                # Skip corrupted entries silently
                continue
            embeddings.append((obj.employee_id, decrypted))
    except Exception as exc:
        logger.error("Failed to build face embedding cache for tenant %s: %s", tenant_id, exc, exc_info=True)
        return []

    expires_at = now + ttl_seconds
    with _CACHE_LOCK:
        _TENANT_CACHE[tenant_id] = _TenantEmbeddingCacheEntry(version, expires_at, embeddings)

    return embeddings
