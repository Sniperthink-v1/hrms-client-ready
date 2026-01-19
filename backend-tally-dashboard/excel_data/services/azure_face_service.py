import requests
from django.conf import settings


class AzureFaceServiceError(Exception):
    pass


class AzureFaceService:
    def __init__(self) -> None:
        endpoint = (getattr(settings, 'AZURE_FACE_ENDPOINT', '') or '').rstrip('/')
        key = getattr(settings, 'AZURE_FACE_KEY', '') or ''
        if not endpoint or not key:
            raise AzureFaceServiceError('Azure Face API is not configured')

        self.base_url = f"{endpoint}/face/v1.0"
        self.base_headers = {
            'Ocp-Apim-Subscription-Key': key,
        }

    @staticmethod
    def get_person_group_id(tenant) -> str:
        return f"tenant-{tenant.id}".lower()

    def ensure_person_group(self, group_id: str, group_name: str) -> None:
        url = f"{self.base_url}/persongroups/{group_id}"
        response = requests.get(url, headers=self.base_headers, timeout=15)
        if response.status_code == 404:
            payload = {
                'name': (group_name or group_id)[:64],
                'recognitionModel': 'recognition_04',
            }
            create_response = requests.put(url, headers=self.base_headers, json=payload, timeout=15)
            if not create_response.ok:
                raise AzureFaceServiceError(self._format_error(create_response))
            return

        if not response.ok:
            raise AzureFaceServiceError(self._format_error(response))

    def create_person(self, group_id: str, name: str) -> str:
        url = f"{self.base_url}/persongroups/{group_id}/persons"
        payload = {'name': name[:128]}
        response = requests.post(url, headers=self.base_headers, json=payload, timeout=15)
        if not response.ok:
            raise AzureFaceServiceError(self._format_error(response))
        person_id = response.json().get('personId')
        if not person_id:
            raise AzureFaceServiceError('Azure Face API did not return personId')
        return person_id

    def add_face(self, group_id: str, person_id: str, image_bytes: bytes) -> str:
        url = f"{self.base_url}/persongroups/{group_id}/persons/{person_id}/persistedFaces"
        headers = {
            **self.base_headers,
            'Content-Type': 'application/octet-stream',
        }
        params = {'detectionModel': 'detection_03'}
        response = requests.post(url, headers=headers, params=params, data=image_bytes, timeout=15)
        if not response.ok:
            raise AzureFaceServiceError(self._format_error(response))
        persisted_face_id = response.json().get('persistedFaceId')
        if not persisted_face_id:
            raise AzureFaceServiceError('Azure Face API did not return persistedFaceId')
        return persisted_face_id

    def detect_faces(self, image_bytes: bytes) -> list[str]:
        url = f"{self.base_url}/detect"
        headers = {
            **self.base_headers,
            'Content-Type': 'application/octet-stream',
        }
        params = {
            'returnFaceId': 'true',
            'recognitionModel': 'recognition_04',
            'detectionModel': 'detection_03',
        }
        response = requests.post(url, headers=headers, params=params, data=image_bytes, timeout=15)
        if not response.ok:
            raise AzureFaceServiceError(self._format_error(response))
        data = response.json()
        if not data:
            return []
        return [item.get('faceId') for item in data if item.get('faceId')]

    def detect_face(self, image_bytes: bytes) -> str | None:
        face_ids = self.detect_faces(image_bytes)
        if not face_ids:
            return None
        return face_ids[0]

    def identify_face(self, group_id: str, face_id: str, confidence_threshold: float) -> dict | None:
        url = f"{self.base_url}/identify"
        payload = {
            'personGroupId': group_id,
            'faceIds': [face_id],
            'maxNumOfCandidatesReturned': 1,
            'confidenceThreshold': confidence_threshold,
        }
        response = requests.post(url, headers=self.base_headers, json=payload, timeout=15)
        if not response.ok:
            raise AzureFaceServiceError(self._format_error(response))
        results = response.json()
        if not results:
            return None
        candidates = results[0].get('candidates') or []
        if not candidates:
            return None
        return candidates[0]

    def train_person_group(self, group_id: str) -> None:
        url = f"{self.base_url}/persongroups/{group_id}/train"
        response = requests.post(url, headers=self.base_headers, timeout=15)
        if not response.ok:
            raise AzureFaceServiceError(self._format_error(response))

    @staticmethod
    def _format_error(response: requests.Response) -> str:
        try:
            data = response.json()
            if isinstance(data, dict):
                message = data.get('error', {}).get('message') or data.get('message')
                if message:
                    return message
        except ValueError:
            pass
        return f"Azure Face API error (HTTP {response.status_code})"
