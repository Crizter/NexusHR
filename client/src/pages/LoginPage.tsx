// src/pages/LoginPage.tsx
import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { AuthLayout } from '@/components/layouts/AuthLayout';
import { LoginForm } from '@/components/LoginForm';

export function LoginPage() {
  const { user, isLoading } = useAuth();

  // Redirect to dashboard if already logged in
  if (!isLoading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
}