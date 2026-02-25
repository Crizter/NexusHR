import axiosInstance from './axios';
import type { Role } from './config';

// ============================================================================
// TypeScript Interfaces 
// ============================================================================

export interface Organization {
  _id: string;
  name: string;
  slug: string;
  subscription: {
    plan: 'free' | 'pro' | 'enterprise';
    status: 'active' | 'past_due';
    maxUsers: number;
  };
  settings: {
    leavePolicy: {
      casualLeaves: number;
      sickLeaves: number;
    };
    timezone: string;
    payroll: {
      currency: string;
      payCycle: 'monthly' | 'bi-weekly';
      taxId?: string;
    };
  };
  createdAt: string;
  updatedAt: string;
}

export interface UpdateOrganizationPayload {
  name?:     string;
  settings?: {
    timezone?:    string;
    leavePolicy?: { casualLeaves?: number; sickLeaves?: number };
    payroll?:     { currency?: string; payCycle?: 'monthly' | 'bi-weekly'; taxId?: string };
  };
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


export interface AttendanceLeave {
  _id:   string;
  type:  'casual_leave' | 'sick_leave';
  dates: {
    startDate: string;
    endDate:   string;
    totalDays: number;
  };
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
export interface LeaveByType {
  type:      'casual_leave' | 'sick_leave';
  totalDays: number;
  count:     number;
}

export interface LeaveByDepartment {
  departmentId:   string;
  departmentName: string;
  totalDays:      number;
  count:          number;
}

export interface OrganizationLeaveStats {
  leavesByType:       LeaveByType[];
  leavesByDepartment: LeaveByDepartment[];
}

export interface UpdateProfilePayload {
  firstName: string;
  lastName:  string;
  email:     string;
}

export interface UpdatePasswordPayload {
  oldPassword: string;
  newPassword: string;
}




export interface AuthUser {
  id:    string;
  orgId: string;
  name:  string;
  email: string;
  role:  Role;
  token?: string;
}
export interface DashboardActivity {
  id:        string;
  type:      'leave_request' | 'leave_approved' | 'leave_rejected' | 'employee_added';
  message:   string;
  timestamp: string;   // ISO string from backend
  user:      string;
}

export interface DashboardStats {
  totalEmployees:          number;
  departmentsCount:        number;
  pendingLeaves:           number;
  approvedLeavesThisMonth: number;
  totalLeavesThisMonth:    number;
  activeEmployees:         number;
  recentActivity:          DashboardActivity[]; 
}



export interface PayslipEarnings {
  baseSalary:  number;
  bonus:       number;
  allowances:  number;
}

export interface PayslipDeductions {
  tax:             number;
  healthInsurance: number;
  unpaidLeave:     number;
}

export interface Payslip {
  _id:          string;
  orgId:        string;
  employeeId:   {
    _id:         string;
    displayId:   string;
    email:       string;
    profile: {
      firstName: string;
      lastName:  string;
    };
  } | string;
  departmentId: string;
  payPeriod: {
    month: number;
    year:  number;
  };
  earnings:    PayslipEarnings;
  deductions:  PayslipDeductions;
  netPay:      number;
  status:      'draft' | 'processed' | 'paid';
  paymentDate: string | null;
  createdAt:   string;
}

export interface UpdatePayslipPayload {
  earnings?: Partial<Omit<PayslipEarnings, 'baseSalary'>>;  // baseSalary is protected
  deductions?: Partial<PayslipDeductions>;
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
  //── ATTENDANCE ───────────────────────────────────────────────────────────────
    async getAttendanceReport(year: number): Promise<AttendanceLeave[]> {
    try {
      const response = await axiosInstance.get<AttendanceLeave[]>(
        `/reports/attendance?year=${year}`
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
  // Get organization leave stats
    async getOrganizationLeaveStats(): Promise<OrganizationLeaveStats> {
    try {
      const response = await axiosInstance.get<OrganizationLeaveStats>('/reports/summary');
      return response.data;
    } catch (error) {
      extractError(error);
    }
  },



  // ── Profile ─────────────────────────────────────────────────────────────────

  /**
   * PATCH /profile/info
   * Updates the authenticated user's own name and email.
   * Role, financial, and leaveBalances are NOT touched.
   */
  async updateMyProfile(data: UpdateProfilePayload): Promise<User> {
    try {
      const response = await axiosInstance.patch<User>('/profile/info', data);
      return response.data;
    } catch (error) {
      extractError(error);
    }
  },

  /**
   * PATCH /profile/password
   * Requires the user's current password for verification before updating.
   */
  async updateMyPassword(data: UpdatePasswordPayload): Promise<{ message: string }> {
    try {
      const response = await axiosInstance.patch<{ message: string }>(
        '/profile/password',
        data
      );
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
   * GET /organization
   */

  async getOrganization(): Promise<Organization> { 
    try {
      const response = await axiosInstance.get<Organization>('/organization');
      return response.data ; 

    } catch (error) {
      extractError(error) ; 
    }
  },
  /** 
   * PATCH /organization 
   */
   async updateOrganization(data: UpdateOrganizationPayload): Promise<Organization> {
    try {
      const response = await axiosInstance.patch<Organization>('/organization', data);
      return response.data;
    } catch (error) {
      extractError(error);
    }
  },

  // ── Payroll ─────────────────────────────────────────────────────────────────

  async generatePayroll(
    month: number,
    year:  number
  ): Promise<{ message: string; generated: number; skipped: number }> {
    try {
      const response = await axiosInstance.post('/payroll/generate', { month, year });
      return response.data;
    } catch (error) {
      extractError(error);
    }
  },

  async getPayslips(month: number, year: number): Promise<Payslip[]> {
    try {
      const response = await axiosInstance.get<Payslip[]>(
        `/payroll?month=${month}&year=${year}`
      );
      return response.data;
    } catch (error) {
      extractError(error);
    }
  },

  async updatePayslip(id: string, updates: UpdatePayslipPayload): Promise<Payslip> {
    try {
      const response = await axiosInstance.patch<Payslip>(`/payroll/${id}`, updates);
      return response.data;
    } catch (error) {
      extractError(error);
    }
  },

  async updatePayslipStatus(
    id:     string,
    status: 'draft' | 'processed' | 'paid'
  ): Promise<Payslip> {
    try {
      const response = await axiosInstance.patch<Payslip>(
        `/payroll/${id}/status`,
        { status }
      );
      return response.data;
    } catch (error) {
      extractError(error);
    }
  },


  async bulkLockPayslips(
    month: number,
    year:  number
  ): Promise<{ message: string; modifiedCount: number }> {
    try {
      const response = await axiosInstance.patch<{ message: string; modifiedCount: number }>(
        '/payroll/bulk-lock',
        { month, year }
      );
      return response.data;
    } catch (error) {
      extractError(error);
    }
  },

  async bulkPayPayslips(
    month: number,
    year:  number
  ): Promise<{ message: string; modifiedCount: number }> {
    try {
      const response = await axiosInstance.patch<{ message: string; modifiedCount: number }>(
        '/payroll/bulk-pay',
        { month, year }
      );
      return response.data;
    } catch (error) {
      extractError(error);
    }
  },



};




  




