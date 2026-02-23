import axiosInstance from './axios';
import type { Role } from './config';

// ============================================================================
// TypeScript Interfaces 
// ============================================================================

export interface Organization {
  _id:    string;
  name:   string;
  slug:   string;
  subscription: {
    plan:     'free' | 'pro' | 'enterprise';
    status:   'active' | 'past_due';
    maxUsers: number;
  };
  settings: {
    leavePolicy: {
      casualLeaves: number;
      sickLeaves:   number;
    };
    timezone: string;
  };
  createdAt: Date;
}

export interface User {
  _id:          string;
  orgId:        string;
  displayId:    string;
  email:        string;
  role:         Role;
  departmentId: string;
  profile: {
    firstName:     string;
    lastName:      string;
    contactNumber: string;
    avatarUrl?:    string;
  };
  financial: {
    baseSalary: number;
    currency:   string;
  };
  leaveBalances: {
    casual: number;
    sick:   number;
  };
  isDeleted:  boolean;
  createdAt:  Date;
  lastLogin?: Date;
}

export interface Department {
  _id:       string;
  orgId:     string;
  name:      string;
  managerId: string;
  createdAt: Date;
}

export interface LeaveRequest {
  _id:          string;
  orgId:        string;
  employeeId:   string;
  departmentId: string;
  employeeName: string;
  type:         'casual_leave' | 'sick_leave';
  status:       'pending' | 'approved' | 'rejected' | 'cancelled';
  dates: {
    startDate: Date;
    endDate:   Date;
    totalDays: number;
  };
  reason:    string;
  workflow?: {
    actionedBy: string;
    actionedAt: Date;
    comments:   string;
  };
  createdAt: Date;
}

export interface AuthUser {
  id:    string;
  orgId: string;
  name:  string;
  email: string;
  role:  Role;
  token?: string;
}

export interface DashboardStats {
  totalEmployees:          number;
  departmentsCount:        number;
  pendingLeaves:           number;
  approvedLeavesThisMonth: number;
  totalLeavesThisMonth:    number;
  activeEmployees:         number;
}

// ─── Helper — extract a readable message from any Axios error ────────────────
function extractError(error: unknown): never {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error
  ) {
    const axiosError = error as {
      response?: { data?: { message?: string } };
      message:   string;
    };
    const serverMsg = axiosError.response?.data?.message;
    throw new Error(serverMsg ?? axiosError.message);
  }
  throw new Error(String(error));
}

// ============================================================================
// API Client 
// ============================================================================

export const api = {

  // ── Auth ────────────────────────────────────────────────────────────────────

  /**
   * POST /auth/login
   * Returns the JWT token + formatted user object
   */
  async login(
    email:    string,
    password: string
  ): Promise<{ token: string; user: AuthUser }> {
    try {
      const response = await axiosInstance.post<{ token: string; user: AuthUser }>(
        '/auth/login',
        { email, password }
      );
      return response.data;
    } catch (error) {
      extractError(error);
    }
  },

  // ── Employees ───────────────────────────────────────────────────────────────

  /**
   * GET /employees
   * orgId is NOT passed — backend reads it from the JWT
   */
  async getEmployees(): Promise<User[]> {
    try {
      const response = await axiosInstance.get<User[]>('/employees');
      return response.data;
    } catch (error) {
      extractError(error);
    }
  },

  /**
   * GET /employees/:id
   */
  async getEmployeeById(_orgId: string, userId: string): Promise<User> {
    try {
      const response = await axiosInstance.get<User>(`/employees/${userId}`);
      return response.data;
    } catch (error) {
      extractError(error);
    }
  },

  /**
   * POST /employees
   */
  async addEmployee(
    _orgId:       string,
    employeeData: Omit<User, '_id' | 'orgId' | 'createdAt' | 'isDeleted'>
  ): Promise<User> {
    try {
      const response = await axiosInstance.post<User>('/employees', employeeData);
      return response.data;
    } catch (error) {
      extractError(error);
    }
  },

  /**
   * DELETE /employees/:id  (soft-delete on backend)
   */
  async deleteEmployee(_orgId: string, userId: string): Promise<boolean> {
    try {
      await axiosInstance.delete(`/employees/${userId}`);
      return true;
    } catch (error) {
      extractError(error);
    }
  },

  // ── Leaves ──────────────────────────────────────────────────────────────────

  /**
   * GET /leaves?employeeId=...
   */
  async getLeaves(
    _orgId:      string,
    employeeId?: string
  ): Promise<LeaveRequest[]> {
    try {
      const params = employeeId ? { employeeId } : {};
      const response = await axiosInstance.get<LeaveRequest[]>('/leaves', { params });
      return response.data;
    } catch (error) {
      extractError(error);
    }
  },

  /**
   * POST /leaves
   */
  async applyLeave(
    _orgId:  string,
    payload: Omit<LeaveRequest, '_id' | 'orgId' | 'createdAt'>
  ): Promise<LeaveRequest> {
    try {
      const response = await axiosInstance.post<LeaveRequest>('/leaves/apply', payload);
      return response.data;
    } catch (error) {
      extractError(error);
    }
  },

  /**
   * PATCH /leaves/:id/status
   */
  async updateLeaveStatus(
    _orgId:     string,
    leaveId:    string,
    status:     'approved' | 'rejected',
    actionedBy: string,
    comments?:  string
  ): Promise<LeaveRequest> {
    try {
      const response = await axiosInstance.patch<LeaveRequest>(
        `/leaves/${leaveId}/status`,
        { status, actionedBy, comments }
      );
      return response.data;
    } catch (error) {
      extractError(error);
    }
  },

  // ── Dashboard ───────────────────────────────────────────────────────────────

   /**
   * GET /dashboard/stats
   * orgId is NOT passed — backend reads it from the JWT
   */
  async getDashboardStats(_orgId?: string): Promise<DashboardStats> {
    try {
      const response = await axiosInstance.get<DashboardStats>('/dashboard/stats');
      return response.data;
    } catch (error) {
      extractError(error);
    }
  },

    // ── Departments ─────────────────────────────────────────────────────────────

  /**
   * GET /departments  — used by AddEmployeeDialog
   */
  async getDepartments(): Promise<Department[]> {
    try {
      const response = await axiosInstance.get<Department[]>('/departments');
      return response.data;
    } catch (error) {
      extractError(error);
    }
  },



  

  // ── Organization ─────────────────────────────────────────────────────────────

  /**
   * GET /organizations/me
   */
  async getOrganization(_orgId: string): Promise<Organization> {
    try {
      const response = await axiosInstance.get<Organization>('/organizations/me');
      return response.data;
    } catch (error) {
      extractError(error);
    }
  },
};

