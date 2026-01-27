import { api } from './api';
import { API_ENDPOINTS } from '@/constants/Config';

export interface FaceAttendanceLog {
  id: number;
  employee_id: string | null;
  employee_name: string | null;
  event_type?: 'registration' | 'verification';
  mode?: 'clock_in' | 'clock_out' | null;
  recognized: boolean;
  confidence?: number;
  message?: string;
  source?: string;
  event_time: string;
}

export interface FaceAttendanceLogResponse {
  count: number;
  total: number;
  offset: number;
  limit: number;
  results: FaceAttendanceLog[];
}

export const faceLogService = {
  async getLogs(params: { date?: string; limit?: number } = {}): Promise<FaceAttendanceLogResponse> {
    const search = new URLSearchParams();
    if (params.date) search.append('date', params.date);
    if (params.limit) search.append('limit', params.limit.toString());
    const query = search.toString();
    const url = query
      ? `${API_ENDPOINTS.faceAttendanceLogs}?${query}`
      : API_ENDPOINTS.faceAttendanceLogs;
    return await api.get<FaceAttendanceLogResponse>(url);
  },
};

export default faceLogService;

