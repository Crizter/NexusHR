
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { EmployeeDirectory } from '@/pages/EmployeeDirectory';
import { WelcomePage } from '@/pages/WelcomePage';
import './index.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<WelcomePage />} />
          <Route path="/login" element={<LoginPage />} />
          
          {/* Protected routes with dashboard layout */}
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
          
          {/* Add more protected routes here */}
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
          
          <Route
            path="/leaves"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <div>Leaves Page - Coming Soon</div>
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          {/* Catch all route - redirect to dashboard if logged in, otherwise to welcome */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;