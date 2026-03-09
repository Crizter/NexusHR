import { useEffect, useState }         from 'react';
import { useAuth }                     from '@/context/AuthContext';
import { api }                         from '@/lib/api';
import type { Payslip, Organization }  from '@/lib/api';
import { format }                      from 'date-fns';
import { usePayslipDownload }          from '@/hooks/usePayslipDownload';
import { Loader2, Download, FileText } from 'lucide-react';

import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button }   from '@/components/ui/button';
import { Badge }    from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style:               'currency',
    currency:            'USD',
    minimumFractionDigits: 2,
  }).format(n);

const monthName = (m: number) =>
  format(new Date(2000, m - 1, 1), 'MMMM');

// ─── Main Page ────────────────────────────────────────────────────────────────
export function MyPayslips() {
  const { user } = useAuth();

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [payslips,     setPayslips]     = useState<Payslip[]>([]);
  const [orgData,      setOrgData]      = useState<Organization | null>(null);
  const [isLoading,    setIsLoading]    = useState(true);

  const { handleDownload, isDownloading, downloadingId } = usePayslipDownload();

  // ── Fetch payslips + org data ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        const [slips, org] = await Promise.all([
          api.getPayslips(1, selectedYear),
          api.getOrganization(),
        ]);
        if (!cancelled) {
          // Employee view: only show paid payslips
          setPayslips(slips.filter(p => p.status === 'paid'));
          setOrgData(org);
        }
      } catch (err) {
        console.error('MyPayslips load error:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [selectedYear]);

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-36" />
        </div>
        <Card>
          <CardContent className="pt-6 space-y-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </CardContent>
        </Card>
      </div>
    );
  }

  const currency = orgData?.settings.payroll.currency ?? 'USD';

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
            <FileText className="h-5 w-5 text-gray-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Payslips</h1>
            <p className="text-sm text-gray-500">
              Download your paid payslips as PDF.
            </p>
          </div>
        </div>

        <Select
          value={String(selectedYear)}
          onValueChange={v => setSelectedYear(Number(v))}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Select year" />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Paid Payslips — {selectedYear}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {payslips.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500 font-medium">
                No paid payslips found for {selectedYear}.
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Payslips appear here once HR marks them as paid.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50">
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Base Salary</TableHead>
                  <TableHead className="text-right">Total Earnings</TableHead>
                  <TableHead className="text-right">Total Deductions</TableHead>
                  <TableHead className="text-right font-semibold">Net Pay</TableHead>
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...payslips]
                  .sort((a, b) => b.payPeriod.month - a.payPeriod.month)
                  .map(payslip => {
                    const totalEarnings =
                      payslip.earnings.baseSalary +
                      payslip.earnings.bonus +
                      payslip.earnings.allowances;

                    const totalDeductions =
                      payslip.deductions.tax +
                      payslip.deductions.healthInsurance +
                      payslip.deductions.unpaidLeave;

                    const downloading = isDownloading(payslip._id);
                    const filename    = `Payslip_${monthName(payslip.payPeriod.month)}_${payslip.payPeriod.year}.pdf`;

                    return (
                      <TableRow key={payslip._id} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="font-medium text-gray-900">
                          {monthName(payslip.payPeriod.month)}
                          <span className="ml-1.5 text-xs text-gray-400">
                            {payslip.payPeriod.year}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm text-gray-600 tabular-nums">
                          {currency} {payslip.earnings.baseSalary.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-sm text-green-700 font-medium tabular-nums">
                          {currency} {totalEarnings.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-sm text-red-600 tabular-nums">
                          {currency} {totalDeductions.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-bold text-gray-900 tabular-nums">
                          {currency} {payslip.netPay.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center">
                          <DownloadButton
                            payslipId={payslip._id}
                            filename={filename}
                            isDownloading={downloading}
                            isAnyDownloading={!!downloadingId}
                            onDownload={handleDownload}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}