import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

interface Props { children: ReactNode; }

export function ProtectedSuperAdminRoute({ children }: Props) {
  const token = localStorage.getItem('adminToken');
  if (!token) return <Navigate to="/super-admin/login" replace />;
  return <>{children}</>;
}