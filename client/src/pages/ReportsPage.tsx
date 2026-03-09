import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { OrganizationLeaveSummary } from '@/components/reports/OrganizationLeaveSummary';
import { AttendanceHeatmap } from '@/components/reports/AttendanceHeatmap';
import { AttendanceDashboard } from '@/components/reports/AttendanceDashboard';
import { DepartmentBurnReport }      from '@/components/reports/DepartmentBurnReport';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { CalendarDays, Building2, User, Download, FileBarChart, DollarSign } from 'lucide-react';

export function ReportsPage() {
  const { hasPermission } = useAuth();
  const isHR = hasPermission('leave_approve');

  // ── State for the Year Selector ──────────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  
  // Generate the last 5 years for the dropdown
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // ── Render Employee View (No Tabs) ───────────────────────────────────────
  if (!isHR) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
            <FileBarChart className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Reports</h1>
            <p className="text-sm text-gray-500">View your personal attendance and leave history.</p>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-gray-500" />
                Attendance Heatmap
              </CardTitle>
              <CardDescription>Your daily attendance and leave record.</CardDescription>
            </div>
            
            {/* Year Selector */}
            <Select 
              value={selectedYear.toString()} 
              onValueChange={(val) => setSelectedYear(Number(val))}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {/* Pass the dynamically selected year to your component! */}
            <AttendanceHeatmap year={selectedYear} />
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Render HR/Admin View (Tabbed Interface) ──────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
          <FileBarChart className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics & Reports</h1>
          <p className="text-sm text-gray-500">Company-wide metrics and personal attendance records.</p>
        </div>
      </div>

   
      <Tabs defaultValue="organization" className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="organization" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Organization
          </TabsTrigger>
          <TabsTrigger value="personal" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            My Attendance
          </TabsTrigger>
          <TabsTrigger value="attendance" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Attendance
          </TabsTrigger>
          <TabsTrigger value="payroll-burn" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Payroll Burn
          </TabsTrigger>
        </TabsList>


       {/* ── Organization Tab ─────────────────────────────────────────────── */}
        <TabsContent value="organization">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-base font-semibold">Leave Summary</CardTitle>
                <CardDescription>Aggregated leave data for all employees.</CardDescription>
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <OrganizationLeaveSummary />
            </CardContent>
          </Card>
        </TabsContent>

       {/* ── Personal Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="personal">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-base font-semibold">Attendance Heatmap</CardTitle>
                <CardDescription>Your daily attendance and leave record.</CardDescription>
              </div>
              <Select
                value={selectedYear.toString()}
                onValueChange={(val) => setSelectedYear(Number(val))}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map(y => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <AttendanceHeatmap year={selectedYear} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Attendance Dashboard Tab ────────────────────────────────────── */}
        <TabsContent value="attendance">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-base font-semibold">Attendance Dashboard</CardTitle>
                <CardDescription>Company-wide attendance metrics.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <AttendanceDashboard selectedYear={selectedYear} onYearChange={setSelectedYear} />
            </CardContent>
          </Card>
        </TabsContent>

         <TabsContent value="payroll-burn">
          <Card>
       
            <CardContent>
              <DepartmentBurnReport />
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}