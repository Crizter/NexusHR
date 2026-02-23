import { useAuth } from '@/context/AuthContext';
import { OrganizationLeaveSummary } from '@/components/reports/OrganizationLeaveSummary';
import { AttendanceHeatmap } from '@/components/reports/AttendanceHeatmap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function ReportsPage() {
  const {hasPermission} = useAuth();
  const isHR = hasPermission('leave_approve');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Reports</h1>

      {/* My Attendance Heatmap — visible to everyone */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            My Attendance — {new Date().getFullYear()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AttendanceHeatmap year={new Date().getFullYear()} />
        </CardContent>
      </Card>

      {/* Organization Summary — HR / Admin only */}
      {isHR && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Organization Leave Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <OrganizationLeaveSummary />
          </CardContent>
        </Card>
      )}
    </div>
  );
}