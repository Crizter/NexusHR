import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { EmployeeDirectory } from "@/pages/EmployeeDirectory";
import { EmployeeProfile } from "@/pages/EmployeeProfile";
import { ReportsPage } from "@/pages/ReportsPage";
import { LeaveManagement } from "@/pages/LeaveManagement";
import { PayrollDashboard } from "@/pages/PayrollDashboard";
import { OrganizationSettings } from "@/pages/OrganizationSettings";
import { WelcomePage } from "@/pages/WelcomePage";
import { MyPayslips } from "@/pages/MyPayslips";
import { AllPayslips } from "@/pages/AllPayslips";
import { MyProfile } from "@/pages/MyProfile";
import { CareersPortal } from "@/pages/CareersPortal";
import { JobApplicationForm } from "@/pages/JobApplicationForm";
import { JobBoard } from "@/pages/JobBoard";
import { CreateJob } from "@/pages/CreateJob";
import { SuperAdminDashboard } from "@/pages/SuperAdminDashboard";
import { SuperAdminLogin } from "@/pages/SuperAdminLogin";
import { ProtectedSuperAdminRoute } from "@/components/ProtectedSuperAdminRoute";
import { SuperAdminLayout } from "@/components/layouts/SuperAdminLayout";
import { TenantDirectory } from "@/pages/TenantDirectory";
import { Toaster } from "./components/ui/sonner";
import "./index.css";

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* SUPER ADMIN */}
          {/* Public Super Admin login — BEFORE the catch-all */}
          <Route path="/super-admin/login" element={<SuperAdminLogin />} />

          <Route
            path="/super-admin"
            element={
              <ProtectedSuperAdminRoute>
                <SuperAdminLayout>
                  <SuperAdminDashboard />
                </SuperAdminLayout>
              </ProtectedSuperAdminRoute>
            }
          />

          <Route
            path="/super-admin/tenants"
            element={
              <ProtectedSuperAdminRoute>
                <SuperAdminLayout>
                  <TenantDirectory />
                </SuperAdminLayout>
              </ProtectedSuperAdminRoute>
            }
          />

          {/* Public routes */}
          <Route path="/" element={<WelcomePage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Careers Portal  */}
          <Route path="/careers/:orgId" element={<CareersPortal />} />
          <Route
            path="/careers/:orgId/apply/:jobId"
            element={<JobApplicationForm />}
          />

          {/* Protected routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <DashboardPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/employees"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <EmployeeDirectory />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          {/* Dynamic employee profile route */}
          <Route
            path="/employees/:id"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <EmployeeProfile />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/leaves"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <LeaveManagement />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ReportsPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <MyProfile />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/payroll"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <PayrollDashboard />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <OrganizationSettings />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/payslips"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <AllPayslips />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/recruitment/job/:jobId"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <JobBoard />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/recruitment/create"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <CreateJob />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}

export default App;
