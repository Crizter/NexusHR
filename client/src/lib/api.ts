import axiosInstance from './axios';
import type { Role } from './config';

// ============================================================================
// TypeScript Interfaces 
// ============================================================================

export interface ZoomStatus {
  isConnected: boolean;
  isExpired:   boolean | null;
  zoomUserId:  string | null;
  expiresAt:   string | null;
}



export interface Candidate {
  _id:   string;
  orgId: string;
  jobId: string;
  email: string;
  profile: {
    firstName: string;
    lastName:  string;
  };
  documents: {
    resumeS3Key: string;
  };
  questionnaireAnswers: {
    questionId:   string;
    questionText: string;
    answer:       string;
  }[];
  pipeline: {
    currentStage: 'Screening' | 'Interview' | 'Offer' | 'Hired' | 'Rejected';
    status:       'Active' | 'Rejected' | 'Withdrawn' | 'Hired';
    matchScore?:  number;    // — used for sorting on the board
  };
  createdAt: string;
}

export interface CandidateSignupPayload {
  orgId:     string;
  jobId:     string;
  firstName: string;
  lastName:  string;
  email:     string;
  password:  string;
}

export interface CandidateAuthResponse {
  success:   boolean;
  message:   string;
  token:     string;
  candidate: {
    id:        string;
    email:     string;
    firstName: string;
    lastName:  string;
  };
}

export interface CandidateLoginPayload {
  email:    string;
  password: string;
}

export interface CandidateLoginResponse {
  success:   boolean;
  token:     string;
  candidate: {
    id:           string;
    email:        string;
    firstName:    string;
    lastName:     string;
    currentStage: string;
    status:       string;
  };
}

export interface ApplicationAnswer {
  questionId:   string;
  questionText?: string;
  answer:        string;
}

export interface SubmitApplicationPayload {
  jobId:   string;
  answers: ApplicationAnswer[];
  resume:  File;                 // multipart/form-data
}

export interface SubmitApplicationResponse {
  success:     boolean;
  message:     string;
  application: {
    candidateId:  string;
    jobId:        string;
    resumeS3Key:  string;
    currentStage: string;
  };
}

export interface ScheduleInterviewPayload {
  topic:     string;
  startTime: string;   // ISO 8601
  duration:  number;   // minutes
}

export interface ScheduleInterviewResponse {
  success:     boolean;
  candidateId: string;
  meetingId:   number;
  topic:       string;
  startTime:   string;
  duration:    number;
  join_url:    string;   // send to candidate via email
  start_url:   string;   // display to recruiter only
  password:    string;
}


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

// DEPARTMENT SALARY REPORTS INTERFACE 
export interface DepartmentBurnRecord {
  _id:          string;
  departmentId: { _id: string; name: string } | string;
  month:        number;
  year:         number;
  totalNetPay:  number;
  totalGrossPay: number;
  totalTaxes:   number;
  employeeCount: number;
}



export interface OrgAttendanceStat {
  _id: {
    date:  string;   // "YYYY-MM-DD"
    year:  number;
    month: number;
  };
  metrics: {
    totalHeadcount: number;
    present:        number;
    onLeave:        number;
    absent:         number;
    attendanceRate: number;
  };
  departmentBreakdown: {
    departmentId?:   string;
    departmentName:  string;
    headcount:       number;
    present:         number;
    onLeave:         number;
  }[];
}


export interface UpdateOrganizationPayload {
  name?:     string;
  settings?: {
    timezone?:    string;
    leavePolicy?: { casualLeaves?: number; sickLeaves?: number };
    payroll?:     { currency?: string; payCycle?: 'monthly' | 'bi-weekly'; taxId?: string };
  };
}

export interface PayslipDownloadResponse { 
  downloadUrl: string; 
  message: string ; 
}

export interface PayslipProcessingResponse { 
  status: 'processing' ; 
  message : string, 
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
  start: string, 
  end: string, 
  days: number, 
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

export interface PayrollBatch {
  _id:            string;
  status:         'processing' | 'completed' | 'completed_with_errors' | 'failed';
  totalEmployees: number;
  processedCount: number;
  failedCount:    number;
  completedAt?:   string;
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

export interface ScreeningQuestion{
  _id: string; 
  questionText: string;
  answerType: 'text' | 'boolean' ; 
  isRequired: boolean ; 
}
export interface SalaryRange{
  min: number; 
  max: number ; 
  currency: string ; 
}

export interface JobOpening {
  _id:                string;
  title:              string;
  department:         string;
  location:           string;
  description:        string;
  status:             'Draft' | 'Published' | 'Closed';   // ADD — used by sidebar green dot
  technologies:       {                                    // FIX — was string[]
    name:          string;
    yearsRequired: number;
    weight:        number;
  }[];
  salaryRange:        SalaryRange;
  screeningQuestions: ScreeningQuestion[];
  createdAt:          string;
}

export interface Candidate {
  _id:   string;
  orgId: string;
  jobId: string;
  email: string;
  profile: {
    firstName: string;
    lastName:  string;
  };
  documents: {
    resumeS3Key: string;
  };
  questionnaireAnswers: {
    questionId:   string;
    questionText: string;
    answer:       string;
  }[];
  pipeline: {
    currentStage: 'Screening' | 'Interview' | 'Offer' | 'Hired' | 'Rejected';
    status:       'Active' | 'Rejected' | 'Withdrawn';
  };
  createdAt: string;
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

  //── DEPARTMENT REPORT ───────────────────────────────────────────────────────────────
   async getDepartmentBurn(year: number): Promise<DepartmentBurnRecord[]> {
    try {
      const response = await axiosInstance.get<DepartmentBurnRecord[]>(
        `/reports/department-burn?year=${year}`
      );
      return response.data;
    } catch (error) {
      extractError(error);
    }
  },

  // ── Org-wide attendance materialized view (AttendanceDashboard) ───────────
  async getOrgAttendance(year: number, month?: number): Promise<OrgAttendanceStat[]> {
    try {
      const params = new URLSearchParams({ year: String(year) });
      if (month) params.append('month', String(month));   // optional month filter

      const response = await axiosInstance.get<OrgAttendanceStat[]>(
        `/reports/org-attendance?${params.toString()}`   // ← org-wide materialized view
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

    // ── Public ATS — no auth header required ──────────────────────────────────

  /**
   * GET /api/jobs/public/:orgId
   * Public endpoint — called from CareersPortal without a JWT.
   */
  async getPublicJobs(orgId: string): Promise<JobOpening[]> {
    try {
      //  Uses fetch — NOT axiosInstance (which always attaches Authorization header)
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/jobs/public/${orgId}`
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? `Request failed with status ${response.status}`);
      }
      const body: { success: boolean; data: JobOpening[] } = await response.json();
      return body.data;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : String(error));
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

    async updateDepartmentPayrollSettings(
    deptId: string,
    data: {
      defaultTaxPercentage?:       number;
      healthInsuranceFlatRate?:    number;
      unpaidLeaveDeductionPerDay?: number;
    }
  ): Promise<Department> {
    try {
      const res = await axiosInstance.patch<Department>(
        `/departments/${deptId}/payroll-settings`,
        data
      );
      return res.data;
    } catch (error) { extractError(error); }
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
  //  Updated return type — now returns batchId not generated count
  ): Promise<{ message: string; batchId: string; totalEmployees: number }> {
    try {
      const response = await axiosInstance.post('/payroll/generate', { month, year });
      return response.data;
    } catch (error) {
      extractError(error);
    }
  },
// — polls the batch progress
    async getPayrollBatchStatus(batchId: string): Promise<PayrollBatch> {
    try {
      const response = await axiosInstance.get<PayrollBatch>(
        `/payroll/status/${batchId}`
      );
      return response.data;
    } catch (error) {
      extractError(error);
    }
  },

async getPayslips(departmentId: string, month: number, year: number): Promise<Payslip[]> {
  try {
    const response = await axiosInstance.get<Payslip[]>(
      `/payroll?departmentId=${departmentId}&month=${month}&year=${year}`
    );
    return response.data;
  } catch (error) {
    extractError(error);
  }
},


  async getMyPayslips(year: number): Promise<Payslip[]> {
  try {
    const response = await axiosInstance.get<Payslip[]>(
      `/payroll/my?year=${year}`
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

    // ── Update monthly variables (bonus + unpaid leave) before SQS dispatch ───
  async updateUserMonthlyVars(
    userId: string,
    data: { bonusThisMonth: number; unpaidLeaveDaysThisMonth: number }
  ): Promise<{ message: string }> {
    try {
      const response = await axiosInstance.patch<{ message: string }>(
        `/employees/${userId}/monthly-vars`,
        data
      );
      return response.data;
    } catch (error) {
      extractError(error);
    }
  },

    // GET /api/payslips/:id/download — returns a 60-second presigned S3 URL
  async getPayslipDownloadUrl(
    payslipId: string
  ): Promise<PayslipDownloadResponse | PayslipProcessingResponse> {
    try {
      const response = await axiosInstance.get<PayslipDownloadResponse>(
        `/payslips/${payslipId}/download`
      );
      return response.data;
    } catch (error: unknown) {
      // 202 comes back as a resolved response in axios (2xx) — but guard anyway
      if (
        typeof error === 'object' &&
        error !== null &&
        'response' in error
      ) {
        const axiosError = error as { response?: { status?: number; data?: PayslipProcessingResponse } };
        if (axiosError.response?.status === 202 && axiosError.response.data) {
          return axiosError.response.data;
        }
      }
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

  // ── Zoom Integration ────────────────────────────────────────────────────────

  /**
   * GET /api/zoom/auth  (protected)
   * Returns the Zoom OAuth URL to redirect the browser to.
   */
  async getZoomAuthUrl(): Promise<{ success: boolean; url: string }> {
    try {
      const response = await axiosInstance.get<{ success: boolean; url: string }>(
        '/zoom/auth'
      );
      return response.data;
    } catch (error) {
      extractError(error);
    }
  },

  /**
   * GET /api/zoom/status  (protected)
   * Returns whether the current HR user has Zoom connected.
   */
  async getZoomStatus(): Promise<ZoomStatus> {
    try {
      const response = await axiosInstance.get<{ success: boolean } & ZoomStatus>(
        '/zoom/status'
      );
      return {
        isConnected: response.data.isConnected,
        isExpired:   response.data.isExpired,
        zoomUserId:  response.data.zoomUserId,
        expiresAt:   response.data.expiresAt,
      };
    } catch (error) {
      extractError(error);
    }
  },

  /**
   * DELETE /api/zoom/disconnect  (protected)
   * Revokes the Zoom token and clears zoomAuth from the User document.
   */
  async disconnectZoom(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await axiosInstance.delete<{ success: boolean; message: string }>(
        '/zoom/disconnect'
      );
      return response.data;
    } catch (error) {
      extractError(error);
    }
  },

  // ── ATS — Candidate (public — uses fetch, no JWT) ───────────────────────────

  /**
   * POST /api/candidates/signup  (public)
   * Creates a candidate account before they submit their application.
   */
  async candidateSignup(
    payload: CandidateSignupPayload
  ): Promise<CandidateAuthResponse> {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/candidates/signup`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        }
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? `Request failed with status ${response.status}`);
      }
      return response.json();
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : String(error));
    }
  },
  

  /**
   * POST /api/candidates/login  (public)
   * Returns a candidate JWT token.
   */
  async candidateLogin(
    payload: CandidateLoginPayload
  ): Promise<CandidateLoginResponse> {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/candidates/login`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        }
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? `Request failed with status ${response.status}`);
      }
      return response.json();
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : String(error));
    }
  },

  /**
   * POST /api/candidates/apply  (protected by candidate JWT — NOT HR JWT)
   * Uploads resume to S3 and submits screening answers.
   * Uses multipart/form-data — do NOT set Content-Type manually.
   */
  async submitApplication(
    candidateToken: string,
    payload:        SubmitApplicationPayload
  ): Promise<SubmitApplicationResponse> {
    try {
      const form = new FormData();
      form.append('jobId',   payload.jobId);
      form.append('answers', JSON.stringify(payload.answers));  // stringified JSON
      form.append('resume',  payload.resume, payload.resume.name);

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/candidates/apply`,
        {
          method:  'POST',
          headers: {
            //  NO Content-Type — browser sets it automatically with boundary for FormData
            'Authorization': `Bearer ${candidateToken}`,
          },
          body: form,
        }
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? `Request failed with status ${response.status}`);
      }
      return response.json();
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : String(error));
    }
  },

  // ── ATS — Candidate Management (protected — HR/Admin axiosInstance) ──────────

  /**
   * GET /api/candidates/job/:jobId  (protected — hr_manager / super_admin)
   * Returns all candidates for a job opening, sorted by matchScore desc.
   * Scoped to the recruiter's orgId on the backend — no cross-tenant leaks.
   */
  async getCandidatesByJob(jobId: string): Promise<{
    candidates: Candidate[];
    esRanked:   boolean;    
  }> {
    try {
      const response = await axiosInstance.get<{
        success:  boolean;
        count:    number;
        esRanked: boolean;
        data:     Candidate[];
      }>(`/candidates/job/${jobId}`);
      return {
        candidates: response.data.data,
        esRanked:   response.data.esRanked,
      };
    } catch (error) {
      extractError(error);
    }
  },

  /**
   * PUT /api/candidates/:id/stage  (protected — hr_manager / super_admin)
   * Moves a candidate to a new pipeline stage.
   * Called by the Kanban board onDragEnd handler.
   */
  async updateCandidateStage(
    candidateId: string,
    stage:       Candidate['pipeline']['currentStage']
  ): Promise<Candidate> {
    try {
      const response = await axiosInstance.put<{
        success:   boolean;
        candidate: Candidate;
      }>(`/candidates/${candidateId}/stage`, { stage });
      return response.data.candidate;
    } catch (error) {
      extractError(error);
    }
  },



  

  // ── ATS — Job Management (protected — HR/Admin axiosInstance) ───────────────

  /**
   * POST /api/jobs  (protected — hr_manager / super_admin)
   * Creates a new job opening for the org.
   */
  async createJobOpening(
    payload: Omit<JobOpening, '_id' | 'createdAt'>
  ): Promise<{ success: boolean; job: JobOpening }> {
    try {
      const response = await axiosInstance.post<{ success: boolean; job: JobOpening }>(
        '/jobs',
        payload
      );
      return response.data;
    } catch (error) {
      extractError(error);
    }
  },

  /**
   * GET /api/jobs  (protected — hr_manager / super_admin)
   * Returns all job openings for the logged-in user's org.
   */
  async getJobOpenings(): Promise<JobOpening[]> {
    try {
      const response = await axiosInstance.get<{ success: boolean; data: JobOpening[] }>(
        '/jobs'
      );
      return response.data.data;
    } catch (error) {
      extractError(error);
    }
  },

  // /**
  //  * PATCH /api/jobs/:id  (protected — hr_manager / super_admin)
  //  * Updates an existing job opening (e.g. change status to Closed).
  //  */
  // async updateJobOpening(
  //   jobId:   string,
  //   payload: Partial<Omit<JobOpening, '_id' | 'createdAt'>>
  // ): Promise<JobOpening> {
  //   try {
  //     const response = await axiosInstance.patch<{ success: boolean; job: JobOpening }>(
  //       `/jobs/${jobId}`,
  //       payload
  //     );
  //     return response.data.job;
  //   } catch (error) {
  //     extractError(error);
  //   }
  // },

  // /**
  //  * DELETE /api/jobs/:id  (protected — hr_manager / super_admin)
  //  */
  // async deleteJobOpening(jobId: string): Promise<boolean> {
  //   try {
  //     await axiosInstance.delete(`/jobs/${jobId}`);
  //     return true;
  //   } catch (error) {
  //     extractError(error);
  //   }
  // },



   // ── Interviews ─────────────────────────────────────────────────────────────

  /**
   * POST /api/interviews/candidate/:id/schedule  (protected — HR/Admin)
   * Creates a Zoom meeting and moves the candidate to the Interview stage.
   */
  async scheduleInterview(
    candidateId: string,
    payload:     ScheduleInterviewPayload
  ): Promise<ScheduleInterviewResponse> {
    try {
      const response = await axiosInstance.post<ScheduleInterviewResponse>(
        `/interviews/candidate/${candidateId}/schedule`,
        payload
      );
      return response.data;
    } catch (error) {
      extractError(error);
    }
  },
  // ── Super Admin ──────────────────────────────────────────────────────────────

async onboardTenant(payload: {
  orgName:   string;
  firstName: string;
  lastName:  string;
  email:     string;
}): Promise<{ success: boolean; orgId: string; userId: string }> {
  const token = localStorage.getItem('adminToken');
  const res   = await fetch(`${import.meta.env.VITE_API_URL}/super-admin/onboard-tenant`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? 'Onboarding failed.');
  return data;
},









};




  




