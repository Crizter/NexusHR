import { useState }    from 'react';
import { api }         from '@/lib/api';
import type { Payslip } from '@/lib/api';
import { toast }       from 'sonner';
import { Loader2 }     from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input }  from '@/components/ui/input';
import { Label }  from '@/components/ui/label';

interface EditPayslipModalProps {
  isOpen:    boolean;
  onClose:   () => void;
  payslip:   Payslip | null;
  onSuccess: () => void;
}

interface FormState {
  bonus:           number;
  allowances:      number;
  tax:             number;
  healthInsurance: number;
  unpaidLeave:     number;
}

function NumberInput({
  id, label, value, onChange, disabled,
}: {
  id: string; label: string; value: number;
  onChange: (val: number) => void; disabled: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium text-gray-700">{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
        <Input
          id={id}
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Math.max(0, parseFloat(e.target.value) || 0))}
          disabled={disabled}
          className="pl-7"
        />
      </div>
    </div>
  );
}

export function EditPayslipModal({ isOpen, onClose, payslip, onSuccess }: EditPayslipModalProps) {
  const [form,    setForm]    = useState<FormState>({
    bonus:           payslip?.earnings.bonus          ?? 0,
    allowances:      payslip?.earnings.allowances     ?? 0,
    tax:             payslip?.deductions.tax          ?? 0,
    healthInsurance: payslip?.deductions.healthInsurance ?? 0,
    unpaidLeave:     payslip?.deductions.unpaidLeave  ?? 0,
  });
  const [loading, setLoading] = useState(false);

  // Re-sync when a different payslip is passed in
  const setField = <K extends keyof FormState>(key: K, val: number) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const totalEarnings   = (payslip?.earnings.baseSalary ?? 0) + form.bonus + form.allowances;
  const totalDeductions = form.tax + form.healthInsurance + form.unpaidLeave;
  const previewNetPay   = totalEarnings - totalDeductions;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payslip) return;

    try {
      setLoading(true);
      await api.updatePayslip(payslip._id, {
        earnings:   { bonus: form.bonus,   allowances: form.allowances },
        deductions: { tax: form.tax, healthInsurance: form.healthInsurance, unpaidLeave: form.unpaidLeave },
      });
      toast.success('Payslip updated', {
        description: 'Earnings and deductions have been saved.',
      });
      onSuccess();
      onClose();
    } catch (err) {
      toast.error('Failed to update payslip', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!payslip) return null;

  const emp = typeof payslip.employeeId === 'object' ? payslip.employeeId : null;
  const empName = emp
    ? `${emp.profile.firstName} ${emp.profile.lastName}`
    : 'Employee';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="bg-white sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-gray-900">
            Edit Payslip — {empName}
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            Base salary is locked. Adjust bonus, allowances, and deductions below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 py-2">

            {/* ── Left: Earnings ─────────────────────────────────────────── */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <p className="text-sm font-semibold text-gray-800">Earnings</p>
              </div>

              {/* Base salary — read-only */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Base Salary</Label>
                <div className="flex h-9 items-center rounded-md border border-gray-200 bg-gray-50 px-3 text-sm text-gray-500">
                  ${payslip.earnings.baseSalary.toLocaleString()}
                  <span className="ml-auto text-xs text-gray-400">locked</span>
                </div>
              </div>

              <NumberInput id="bonus"      label="Bonus"      value={form.bonus}      onChange={(v) => setField('bonus', v)}      disabled={loading} />
              <NumberInput id="allowances" label="Allowances" value={form.allowances} onChange={(v) => setField('allowances', v)} disabled={loading} />
            </div>

            {/* ── Right: Deductions ──────────────────────────────────────── */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-red-400" />
                <p className="text-sm font-semibold text-gray-800">Deductions</p>
              </div>

              <NumberInput id="tax"             label="Tax"              value={form.tax}             onChange={(v) => setField('tax', v)}             disabled={loading} />
              <NumberInput id="healthInsurance" label="Health Insurance" value={form.healthInsurance} onChange={(v) => setField('healthInsurance', v)} disabled={loading} />
              <NumberInput id="unpaidLeave"     label="Unpaid Leave"     value={form.unpaidLeave}     onChange={(v) => setField('unpaidLeave', v)}     disabled={loading} />
            </div>
          </div>

          {/* ── Net pay preview ──────────────────────────────────────────── */}
          <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Total Earnings</span>
              <span className="font-medium text-green-700">${totalEarnings.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-gray-500">Total Deductions</span>
              <span className="font-medium text-red-600">−${totalDeductions.toLocaleString()}</span>
            </div>
            <div className="mt-2 border-t border-gray-200 pt-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800">Net Pay (preview)</span>
              <span className={`text-base font-bold ${previewNetPay >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                ${previewNetPay.toLocaleString()}
              </span>
            </div>
          </div>

          <DialogFooter className="mt-5 gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}