
import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">NexusHR</h1>
          <p className="text-gray-600 mt-2">Human Resource Management System</p>
        </div>
        
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-xl font-semibold">
              Sign in to your account
            </CardTitle>
          </CardHeader>
          <CardContent>
            {children}
          </CardContent>
        </Card>
        
        <div className="text-center mt-6 text-sm text-gray-500">
          <p>&copy; 2026 NexusHR. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}