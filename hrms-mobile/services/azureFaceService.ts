import { api } from './api';
import { API_ENDPOINTS } from '@/constants/Config';

export interface FaceRegistrationResponse {
  success: boolean;
  employee_id: number;
  employee_name: string;
  person_id: string;
  persisted_face_id: string;
  message: string;
}

export interface FaceRecognitionResponse {
  recognized: boolean;
  mode?: 'clock_in' | 'clock_out';
  employee_id?: string;
  employee_name?: string;
  confidence?: number;
  timestamp?: string;
  message?: string;
  error?: string;
}

export const azureFaceService = {
  registerFace: async (
    employeeId: string,
    image: { uri: string; name: string; type: string }
  ): Promise<FaceRegistrationResponse> => {
    const formData = new FormData();
    formData.append('employee_id', employeeId);
    formData.append('image', image as any);
    return await api.upload<FaceRegistrationResponse>(API_ENDPOINTS.faceRegistration, formData);
  },
  recognizeFace: async (
    mode: 'clock_in' | 'clock_out',
    image: { uri: string; name: string; type: string }
  ): Promise<FaceRecognitionResponse> => {
    const formData = new FormData();
    formData.append('mode', mode);
    formData.append('image', image as any);
    return await api.upload<FaceRecognitionResponse>(API_ENDPOINTS.faceRecognition, formData);
  },
};

export default azureFaceService;
