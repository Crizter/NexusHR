
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Users, Calendar, BarChart3 } from 'lucide-react';

export function WelcomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Welcome to NexusHR
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Streamline your human resource management with our comprehensive 
            platform designed for modern organizations.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link to="/login">
              <Button className="flex items-center space-x-2">
                <span>Get Started</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Button variant="outline">
              Learn More
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
            <div className="text-center p-6">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Employee Management</h3>
              <p className="text-gray-600">
                Manage your workforce efficiently with comprehensive employee profiles and data.
              </p>
            </div>

            <div className="text-center p-6">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Calendar className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Leave Management</h3>
              <p className="text-gray-600">
                Streamlined leave requests, approvals, and tracking for better workforce planning.
              </p>
            </div>

            <div className="text-center p-6">
              <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                <BarChart3 className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Analytics & Reports</h3>
              <p className="text-gray-600">
                Get insights into your organization with detailed analytics and reporting tools.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}