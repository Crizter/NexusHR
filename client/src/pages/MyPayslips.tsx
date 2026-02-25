import { useEffect, useRef, useState } from 'react';
import { useAuth }                     from '@/context/AuthContext';
import { api }                         from '@/lib/api';
import type { Payslip, Organization }  from '@/lib/api';
import { format }                      from 'date-fns';
import jsPDF                           from 'jspdf';
import html2canvas                     from 'html2canvas';
import { Loader2, Download, FileText } from 'lucide-react';

import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toFixed(2);
const monthName = (m: number) =>
  format(new Date(2000, m - 1, 1), 'MMMM');

// ─── Hidden PDF Template ──────────────────────────────────────────────────────
interface PayslipTemplateProps {
  payslip: Payslip | null;
  org:     Organization | null;
  pdfRef:  React.RefObject<HTMLDivElement>;
  userName: string;
  userEmail: string;
}

function PayslipTemplate({ payslip, org, pdfRef, userName, userEmail }: PayslipTemplateProps) {
  if (!payslip || !org) return <div ref={pdfRef} />;

  const totalEarnings =
    payslip.earnings.baseSalary +
    payslip.earnings.bonus +
    payslip.earnings.allowances;

  const totalDeductions =
    payslip.deductions.tax +
    payslip.deductions.healthInsurance +
    payslip.deductions.unpaidLeave;

  const currency = org.settings.payroll.currency ?? 'USD';

  return (
    <div
      ref={pdfRef}
      className="absolute -left-[9999px] top-0 w-[800px] bg-white text-black"
      aria-hidden="true"
    >
      <div className="p-10 font-sans">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between border-b-2 border-gray-900 pb-6 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{org.name}</h1>
            {org.settings.payroll.taxId && (
              <p className="text-sm text-gray-500 mt-1">
                Tax ID: {org.settings.payroll.taxId}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-3xl font-extrabold tracking-widest text-gray-800">PAYSLIP</p>
            <p className="text-sm text-gray-500 mt-1">
              {monthName(payslip.payPeriod.month)} {payslip.payPeriod.year}
            </p>
          </div>
        </div>

        {/* ── Employee Info ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-6 mb-8 bg-gray-50 rounded-lg p-5">
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-1">Employee</p>
            <p className="text-base font-semibold text-gray-900">{userName}</p>
            <p className="text-sm text-gray-500">{userEmail}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-1">Pay Period</p>
            <p className="text-base font-semibold text-gray-900">
              {monthName(payslip.payPeriod.month)} {payslip.payPeriod.year}
            </p>
            {payslip.paymentDate && (
              <p className="text-sm text-gray-500">
                Paid on: {format(new Date(payslip.paymentDate), 'dd MMM yyyy')}
              </p>
            )}
          </div>
        </div>

        {/* ── Earnings & Deductions ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-8 mb-8">

          {/* Earnings */}
          <div>
            <h2 className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">
              Earnings
            </h2>
            <div className="space-y-2">
              {[
                { label: 'Base Salary',  value: payslip.earnings.baseSalary },
                { label: 'Bonus',        value: payslip.earnings.bonus      },
                { label: 'Allowances',   value: payslip.earnings.allowances },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm py-1 border-b border-gray-100">
                  <span className="text-gray-600">{label}</span>
                  <span className="font-medium">{currency} {fmt(value)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm py-2 bg-green-50 rounded px-2 mt-1">
                <span className="font-semibold text-green-800">Total Earnings</span>
                <span className="font-bold text-green-800">{currency} {fmt(totalEarnings)}</span>
              </div>
            </div>
          </div>

          {/* Deductions */}
          <div>
            <h2 className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">
              Deductions
            </h2>
            <div className="space-y-2">
              {[
                { label: 'Tax',              value: payslip.deductions.tax             },
                { label: 'Health Insurance', value: payslip.deductions.healthInsurance },
                { label: 'Unpaid Leave',     value: payslip.deductions.unpaidLeave     },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm py-1 border-b border-gray-100">
                  <span className="text-gray-600">{label}</span>
                  <span className="font-medium">{currency} {fmt(value)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm py-2 bg-red-50 rounded px-2 mt-1">
                <span className="font-semibold text-red-800">Total Deductions</span>
                <span className="font-bold text-red-800">{currency} {fmt(totalDeductions)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Net Pay ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between bg-gray-900 text-white rounded-lg px-6 py-5">
          <p className="text-lg font-bold tracking-wide uppercase">Net Pay</p>
          <p className="text-2xl font-extrabold">
            {currency} {fmt(payslip.netPay)}
          </p>
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <p className="text-center text-xs text-gray-400 mt-8">
          This is a system-generated payslip and does not require a signature.
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function MyPayslips() {
  const { user } = useAuth();

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const [selectedYear,   setSelectedYear]   = useState(currentYear);
  const [payslips,       setPayslips]       = useState<Payslip[]>([]);
  const [orgData,        setOrgData]        = useState<Organization | null>(null);
  const [isLoading,      setIsLoading]      = useState(true);
  const [downloadingId,  setDownloadingId]  = useState<string | null>(null);
  const [printData,      setPrintData]      = useState<Payslip | null>(null);

  const pdfRef = useRef<HTMLDivElement>(null);

  // ── Fetch payslips + org ────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const [slips, org] = await Promise.all([
          api.getPayslips(1, selectedYear),   // fetch all months — filter paid below
          api.getOrganization(),
        ]);
        setPayslips(slips.filter(p => p.status === 'paid'));
        setOrgData(org);
      } catch (err) {
        console.error('MyPayslips load error:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [selectedYear]);

  // ── PDF generation ──────────────────────────────────────────────────────────
  const handleDownloadPDF = async (payslip: Payslip) => {
    setDownloadingId(payslip._id);
    setPrintData(payslip);

    // Allow React to re-render the hidden template with new data
    await new Promise(resolve => setTimeout(resolve, 150));

    try {
      if (!pdfRef.current) return;

      const canvas = await html2canvas(pdfRef.current, {
        scale:            2,
        useCORS:          true,
        backgroundColor:  '#ffffff',
        logging:          false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf     = new jsPDF('p', 'mm', 'a4');

      const pageWidth  = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth   = pageWidth;
      const imgHeight  = (canvas.height * imgWidth) / canvas.width;

      // If content overflows one page, scale down to fit
      const finalHeight = imgHeight > pageHeight ? pageHeight : imgHeight;

      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, finalHeight);
      pdf.save(`Payslip_${monthName(payslip.payPeriod.month)}_${payslip.payPeriod.year}.pdf`);

    } catch (err) {
      console.error('PDF generation error:', err);
    } finally {
      setDownloadingId(null);
      setPrintData(null);
    }
  };

  // ── Loading skeleton ────────────────────────────────────────────────────────
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

  const userName  = user?.name  ?? '—';
  const userEmail = user?.email ?? '—';

  return (
    <>
      {/* ── Hidden PDF template (off-screen) ─────────────────────────────── */}
      <PayslipTemplate
        payslip={printData}
        org={orgData}
        pdfRef={pdfRef}
        userName={userName}
        userEmail={userEmail}
      />

      {/* ── Page ─────────────────────────────────────────────────────────── */}
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

          {/* Year selector */}
          <Select
            value={String(selectedYear)}
            onValueChange={(v) => setSelectedYear(Number(v))}
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
                  <TableRow className="bg-gray-50">
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Base Salary</TableHead>
                    <TableHead className="text-right">Total Earnings</TableHead>
                    <TableHead className="text-right">Total Deductions</TableHead>
                    <TableHead className="text-right font-semibold">Net Pay</TableHead>
                    <TableHead className="text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payslips
                    .sort((a, b) => b.payPeriod.month - a.payPeriod.month)
                    .map((payslip) => {
                      const totalEarnings =
                        payslip.earnings.baseSalary +
                        payslip.earnings.bonus +
                        payslip.earnings.allowances;

                      const totalDeductions =
                        payslip.deductions.tax +
                        payslip.deductions.healthInsurance +
                        payslip.deductions.unpaidLeave;

                      const currency = orgData?.settings.payroll.currency ?? 'USD';
                      const isDownloading = downloadingId === payslip._id;

                      return (
                        <TableRow key={payslip._id} className="hover:bg-gray-50">
                          <TableCell className="font-medium">
                            {monthName(payslip.payPeriod.month)}
                          </TableCell>
                          <TableCell className="text-right text-gray-600">
                            {currency} {fmt(payslip.earnings.baseSalary)}
                          </TableCell>
                          <TableCell className="text-right text-green-700 font-medium">
                            {currency} {fmt(totalEarnings)}
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            {currency} {fmt(totalDeductions)}
                          </TableCell>
                          <TableCell className="text-right font-bold text-gray-900">
                            {currency} {fmt(payslip.netPay)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1.5"
                              disabled={isDownloading || !!downloadingId}
                              onClick={() => handleDownloadPDF(payslip)}
                            >
                              {isDownloading
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <Download className="h-3 w-3" />}
                              {isDownloading ? 'Generating...' : 'Download PDF'}
                            </Button>
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
    </>
  );
}