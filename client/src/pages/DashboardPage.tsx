
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Calendar, FileText, TrendingUp } from 'lucide-react';

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.name}!
        </h1>
        <p className="text-gray-600">
          Here's what's happening in your organization today.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">150</div>
            <p className="text-xs text-gray-600">+5 from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leave Requests</CardTitle>
            <Calendar className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">23</div>
            <p className="text-xs text-gray-600">Pending approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
            <FileText className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">89</div>
            <p className="text-xs text-gray-600">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance</CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">94%</div>
            <p className="text-xs text-gray-600">Average score</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div className="text-sm">
                  <span className="font-medium">John Doe</span> submitted a leave request
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div className="text-sm">
                  <span className="font-medium">Jane Smith</span> updated her profile
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <div className="text-sm">
                  <span className="font-medium">Mike Johnson</span> clocked in
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <button className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 transition-colors">
                Add New Employee
              </button>
              <button className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 transition-colors">
                Process Payroll
              </button>
              <button className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 transition-colors">
                Review Leave Requests
              </button>
              <button className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 transition-colors">
                Generate Reports
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}