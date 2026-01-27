import { api } from './api';
import { API_ENDPOINTS } from '@/constants/Config';

export interface FaceEmbeddingRegistrationResponse {
  success: boolean;
  employee_id: number;
  employee_name: string;
  embedding_id?: string;
  message: string;
}

export interface FaceEmbeddingVerificationResponse {
  recognized: boolean;
  mode?: 'clock_in' | 'clock_out';
  employee_id?: string;
  employee_name?: string;
  confidence?: number;
  timestamp?: string;
  message?: string;
  error?: string;
}

export const faceEmbeddingService = {
  registerEmbedding: async (
    employeeId: string,
    embedding: number[]
  ): Promise<FaceEmbeddingRegistrationResponse> => {
    return await api.post<FaceEmbeddingRegistrationResponse>(API_ENDPOINTS.faceEmbeddingRegister, {
      employee_id: employeeId,
      embedding,
    });
  },
  verifyEmbedding: async (
    mode: 'clock_in' | 'clock_out',
    embedding: number[]
  ): Promise<FaceEmbeddingVerificationResponse> => {
    return await api.post<FaceEmbeddingVerificationResponse>(API_ENDPOINTS.faceEmbeddingVerify, {
      mode,
      embedding,
    });
  },
};

export default faceEmbeddingService;
