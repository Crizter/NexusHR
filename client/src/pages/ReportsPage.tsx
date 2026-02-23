import { AttendanceHeatmap } from '@/components/reports/AttendanceHeatmap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function ReportsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">My Reports</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Attendance — {new Date().getFullYear()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AttendanceHeatmap year={new Date().getFullYear()} />
        </CardContent>
      </Card>
    </div>
  );
}