import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider }        from '@/context/AuthContext';
import { ProtectedRoute }      from '@/components/ProtectedRoute';
import { DashboardLayout }     from '@/components/layouts/DashboardLayout';
import { LoginPage }           from '@/pages/LoginPage';
import { DashboardPage }       from '@/pages/DashboardPage';
import { EmployeeDirectory }   from '@/pages/EmployeeDirectory';
import { EmployeeProfile }     from '@/pages/EmployeeProfile';
import { LeaveManagement }     from '@/pages/LeaveManagement';
import { WelcomePage }         from '@/pages/WelcomePage';
import './index.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/"      element={<WelcomePage />} />
          <Route path="/login" element={<LoginPage />}   />

          {/* Protected routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute><DashboardLayout><DashboardPage /></DashboardLayout></ProtectedRoute>
          }/>

          <Route path="/employees" element={
            <ProtectedRoute><DashboardLayout><EmployeeDirectory /></DashboardLayout></ProtectedRoute>
          }/>

          {/* Dynamic employee profile route */}
          <Route path="/employees/:id" element={
            <ProtectedRoute><DashboardLayout><EmployeeProfile /></DashboardLayout></ProtectedRoute>
          }/>

          <Route path="/leaves" element={
            <ProtectedRoute><DashboardLayout><LeaveManagement /></DashboardLayout></ProtectedRoute>
          }/>

          <Route path="/reports" element={
            <ProtectedRoute>
              <DashboardLayout>
                <div className="p-4 text-gray-500">Reports — coming soon</div>
              </DashboardLayout>
            </ProtectedRoute>
          }/>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;