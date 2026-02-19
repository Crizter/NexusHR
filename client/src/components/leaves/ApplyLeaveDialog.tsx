import { useEffect, useState } from 'react';
import { format, differenceInDays } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { useAuth } from '@/context/AuthContext';
import { mockApi } from '@/lib/mockApi';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button }   from '@/components/ui/button';
import { Label }    from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar }   from '@/components/ui/calendar';
import { CalendarIcon, Loader2, AlertCircle } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type LeaveType = 'casual_leave' | 'sick_leave';

interface FormState {
  type:      LeaveType | '';
  dateRange: DateRange | undefined;
  reason:    string;
}

interface FormErrors {
  type?:      string;
  dateRange?: string;
  reason?:    string;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface ApplyLeaveDialogProps {
  open:         boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess:    () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const EMPTY_FORM: FormState = {
  type:      '',
  dateRange: undefined,
  reason:    '',
};

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  casual_leave: 'Casual Leave',
  sick_leave:   'Sick Leave',
};

// ─── Date range label helper ──────────────────────────────────────────────────
function formatDateRangeLabel(range: DateRange | undefined): string {
  if (!range?.from) return 'Pick a date range';
  if (!range.to)    return format(range.from, 'MMM dd, yyyy');

  const totalDays = differenceInDays(range.to, range.from) + 1;
  const label     = `${format(range.from, 'MMM dd, yyyy')} – ${format(range.to, 'MMM dd, yyyy')}`;
  return `${label} (${totalDays} day${totalDays > 1 ? 's' : ''})`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function ApplyLeaveDialog({
  open,
  onOpenChange,
  onSuccess,
}: ApplyLeaveDialogProps) {
  const { user } = useAuth();

  // ── Form state ─────────────────────────────────────────────────────────────
  const [form, setForm]               = useState<FormState>(EMPTY_FORM);
  const [formErrors, setFormErrors]   = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading]         = useState<boolean>(false);
  const [calendarOpen, setCalendarOpen] = useState<boolean>(false);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setFormErrors({});
      setSubmitError(null);
      setCalendarOpen(false);
    }
  }, [open]);

  // ── Field helpers ──────────────────────────────────────────────────────────
  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (formErrors[key as keyof FormErrors]) {
      setFormErrors(prev => ({ ...prev, [key]: undefined }));
    }
    if (submitError) setSubmitError(null);
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const errors: FormErrors = {};

    if (!form.type) {
      errors.type = 'Please select a leave type.';
    }

    if (!form.dateRange?.from) {
      errors.dateRange = 'Please select a start date.';
    } else if (!form.dateRange?.to) {
      errors.dateRange = 'Please select an end date.';
    } else if (form.dateRange.from < new Date(new Date().setHours(0, 0, 0, 0))) {
      errors.dateRange = 'Leave cannot start in the past.';
    }

    if (!form.reason.trim()) {
      errors.reason = 'Please provide a reason for your leave.';
    } else if (form.reason.trim().length < 10) {
      errors.reason = 'Reason must be at least 10 characters.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validate())        return;
    if (!user?.orgId)       return;
    if (!form.type)         return;
    if (!form.dateRange?.from || !form.dateRange?.to) return;

    const totalDays = differenceInDays(form.dateRange.to, form.dateRange.from) + 1;

    try {
      setLoading(true);
      setSubmitError(null);

      await mockApi.applyLeave(user.orgId, {
        employeeId:   user.id,
        departmentId: (user as any).departmentId ?? '',
        employeeName: user.name,
        type:         form.type,
        status:       'pending',
        dates: {
          startDate: form.dateRange.from,
          endDate:   form.dateRange.to,
          totalDays,
        },
        reason: form.reason.trim(),
      });

      onSuccess();
      onOpenChange(false);

    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to submit request. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Computed ───────────────────────────────────────────────────────────────
  const totalDaysSelected =
    form.dateRange?.from && form.dateRange?.to
      ? differenceInDays(form.dateRange.to, form.dateRange.from) + 1
      : 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white sm:max-w-[600px]">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-gray-900">
            Apply for Leave
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            Fill in the details below. Your request will be sent to your manager
            for approval.
          </DialogDescription>
        </DialogHeader>

        {/* ── Form ───────────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-5 py-2">

            {/* ── Leave Type ─────────────────────────────────────────────── */}
            <div className="space-y-1.5">
              <Label htmlFor="leaveType" className="text-sm font-medium text-gray-700">
                Leave Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.type}
                onValueChange={(v) => setField('type', v as LeaveType)}
                disabled={loading}
              >
                <SelectTrigger
                  id="leaveType"
                  className={cn(
                    'w-full',
                    formErrors.type && 'border-red-400 focus:ring-red-300'
                  )}
                >
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="casual_leave">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-400" />
                      Casual Leave
                    </div>
                  </SelectItem>
                  <SelectItem value="sick_leave">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-green-400" />
                      Sick Leave
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {formErrors.type && (
                <p className="text-xs text-red-500">{formErrors.type}</p>
              )}
            </div>

            {/* ── Date Range Picker ───────────────────────────────────────── */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">
                Date Range <span className="text-red-500">*</span>
              </Label>

              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={loading}
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !form.dateRange?.from && 'text-gray-400',
                      formErrors.dateRange  && 'border-red-400 focus-visible:ring-red-300'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-gray-400" />
                    <span className="truncate">
                      {formatDateRangeLabel(form.dateRange)}
                    </span>
                  </Button>
                </PopoverTrigger>

                <PopoverContent
                  className="w-auto p-0 bg-white shadow-lg"
                  align="start"
                  sideOffset={4}
                >
                  <Calendar
                    mode="range"
                    selected={form.dateRange}
                    onSelect={(range) => {
                      setField('dateRange', range);
                      // Auto-close once both dates are chosen
                      if (range?.from && range?.to) {
                        setCalendarOpen(false);
                      }
                    }}
                    numberOfMonths={2}
                    disabled={(date) =>
                      date < new Date(new Date().setHours(0, 0, 0, 0))
                    }
                    initialFocus
                  />

                  {/* Footer inside popover — clear & confirm */}
                  <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs text-gray-500"
                      onClick={() => {
                        setField('dateRange', undefined);
                        setCalendarOpen(false);
                      }}
                    >
                      Clear
                    </Button>
                    {form.dateRange?.from && form.dateRange?.to && (
                      <span className="text-xs font-medium text-gray-700">
                        {totalDaysSelected} day{totalDaysSelected > 1 ? 's' : ''} selected
                      </span>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      className="text-xs"
                      disabled={!form.dateRange?.from || !form.dateRange?.to}
                      onClick={() => setCalendarOpen(false)}
                    >
                      Confirm
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              {formErrors.dateRange && (
                <p className="text-xs text-red-500">{formErrors.dateRange}</p>
              )}

              {/* Summary pill — only shown when both dates are selected */}
              {totalDaysSelected > 0 && (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1">
                  <CalendarIcon className="h-3 w-3 text-blue-500" />
                  <span className="text-xs font-medium text-blue-700">
                    {totalDaysSelected} working day{totalDaysSelected > 1 ? 's' : ''} requested
                  </span>
                </div>
              )}
            </div>

            {/* ── Reason ─────────────────────────────────────────────────── */}
            <div className="space-y-1.5">
              <Label htmlFor="reason" className="text-sm font-medium text-gray-700">
                Reason <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="reason"
                placeholder="Please describe the reason for your leave request..."
                rows={4}
                value={form.reason}
                onChange={(e) => setField('reason', e.target.value)}
                disabled={loading}
                className={cn(
                  'resize-none',
                  formErrors.reason && 'border-red-400 focus-visible:ring-red-300'
                )}
              />
              <div className="flex items-center justify-between">
                {formErrors.reason ? (
                  <p className="text-xs text-red-500">{formErrors.reason}</p>
                ) : (
                  <span /> // spacer
                )}
                {/* Character count */}
                <span className={cn(
                  'text-xs tabular-nums',
                  form.reason.length < 10 ? 'text-gray-400' : 'text-gray-500'
                )}>
                  {form.reason.length} chars
                </span>
              </div>
            </div>

            {/* ── Submission-level error banner ───────────────────────────── */}
            {submitError && (
              <div className="flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 px-3 py-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <p className="text-sm text-red-700">{submitError}</p>
              </div>
            )}
          </div>

          {/* ── Footer ───────────────────────────────────────────────────── */}
          <DialogFooter className="mt-6 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Request'
              )}
            </Button>
          </DialogFooter>
        </form>

      </DialogContent>
    </Dialog>
  );
}