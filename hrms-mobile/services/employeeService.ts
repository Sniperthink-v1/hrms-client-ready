// Employee Service
import { api } from './api';
import { API_ENDPOINTS } from '@/constants/Config';
import { EmployeeProfile, PaginatedResponse } from '@/types';

export interface ActiveEmployeeListItem {
  id: number;
  employee_id: string | null;
  name: string;
  department?: string;
  designation?: string;
}

export interface EmployeeStats {
  total: number;
  active: number;
  inactive: number;
  by_department: Array<{
    department: string;
    count: number;
  }>;
}

export const employeeService = {
  // Get all employees (paginated)
  async getEmployees(page: number = 1, search?: string, department?: string): Promise<PaginatedResponse<EmployeeProfile>> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    if (search) params.append('search', search);
    if (department && department !== 'All') params.append('department', department);
    
    return await api.get<PaginatedResponse<EmployeeProfile>>(`${API_ENDPOINTS.employees}?${params.toString()}`);
  },

  // Get a lightweight list of all active employees (non-paginated)
  async getActiveEmployeesList(): Promise<ActiveEmployeeListItem[]> {
    return await api.get<ActiveEmployeeListItem[]>('/api/employees/active_employees_list/');
  },

  // Get employee by ID
  async getEmployeeById(id: number): Promise<EmployeeProfile> {
    return await api.get<EmployeeProfile>(`${API_ENDPOINTS.employees}${id}/`);
  },

  // Get employee directory data (progressive loading)
  async getDirectoryData(page: number = 1, search?: string): Promise<any> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    if (search) params.append('search', search);
    
    return await api.get(`${API_ENDPOINTS.employeeDirectory}?${params.toString()}`);
  },

  // Get employee details
  async getEmployeeDetails(id: number): Promise<any> {
    return await api.get(`${API_ENDPOINTS.employees}${id}/get_employee_details/`);
  },

  // Create employee
  async createEmployee(data: Partial<EmployeeProfile>): Promise<EmployeeProfile> {
    return await api.post<EmployeeProfile>(API_ENDPOINTS.employees, data);
  },

  // Update employee
  async updateEmployee(id: number, data: Partial<EmployeeProfile>): Promise<EmployeeProfile> {
    return await api.patch<EmployeeProfile>(`${API_ENDPOINTS.employees}${id}/`, data);
  },

  // Update employee details
  async updateEmployeeDetails(id: number, data: any): Promise<EmployeeProfile> {
    return await api.patch<EmployeeProfile>(`${API_ENDPOINTS.employees}${id}/update_employee_details/`, data);
  },

  // Delete employee
  async deleteEmployee(id: number): Promise<void> {
    return await api.delete(`${API_ENDPOINTS.employees}${id}/`);
  },

  // Get employee statistics
  async getEmployeeStats(): Promise<EmployeeStats> {
    return await api.get<EmployeeStats>(API_ENDPOINTS.employeeStats);
  },

  // Bulk toggle active status
  async bulkToggleActiveStatus(employeeIds: number[], isActive: boolean): Promise<any> {
    return await api.post('/api/employees/bulk_toggle_active_status/', {
      employee_ids: employeeIds,
      is_active: isActive,
    });
  },

  // Bulk update employees
  async bulkUpdate(employeeIds: number[], updates: Partial<EmployeeProfile>): Promise<any> {
    return await api.post('/api/employees/bulk_update/', {
      employee_ids: employeeIds,
      updates: updates,
    });
  },

  // Get bulk update history
  async getBulkUpdateHistory(limit: number = 10): Promise<{ history: any[] }> {
    return await api.get(`/api/employees/bulk-update-history/?limit=${limit}`);
  },

  // Revert bulk update
  async revertBulkUpdate(actionId: string): Promise<{ message: string }> {
    return await api.post('/api/employees/revert-bulk-update/', {
      action_id: actionId,
    });
  },
};

export default employeeService;
