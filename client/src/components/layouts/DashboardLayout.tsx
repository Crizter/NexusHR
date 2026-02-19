// src/components/layouts/DashboardLayout.tsx
import { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, User, Building, Menu } from 'lucide-react';
import { useState } from 'react';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    // Navigation will be handled by the protected route wrapper
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="lg:hidden mr-2"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-semibold text-gray-900">NexusHR</h1>
            </div>

            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-2 text-sm">
                <Building className="h-4 w-4 text-gray-500" />
                <span className="text-gray-600">Org: {user?.orgId}</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">
                  {user?.name}
                </span>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  {user?.role.replace('_', ' ')}
                </span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className="flex">
        {/* Sidebar */}
        <aside className={`
          fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:transform-none
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="p-6">
            <nav className="space-y-2">
              <a
                href="/dashboard"
                className="flex items-center space-x-2 px-3 py-2 text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
              >
                <span>Dashboard</span>
              </a>
              <a
                href="/employees"
                className="flex items-center space-x-2 px-3 py-2 text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
              >
                <span>Employees</span>
              </a>
              <a
                href="/leaves"
                className="flex items-center space-x-2 px-3 py-2 text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
              >
                <span>Leaves</span>
              </a>
              {/* Add more navigation items based on permissions */}
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 lg:ml-0">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}