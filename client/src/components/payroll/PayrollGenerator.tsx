import { useEffect, useState, useCallback, useRef } from 'react';
import { getMonth, getYear }                        from 'date-fns';
import { api }                                      from '@/lib/api';
import { toast }                                    from 'sonner';
import { Button }                                   from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  CheckCircle2, Loader2, Plus,
  AlertTriangle, XCircle, PartyPopper,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const YEARS = Array.from({ length: 5 }, (_, i) => getYear(new Date()) - i);
const POLL_INTERVAL_MS = 3_000;  // poll every 3 seconds

// ─── Types ────────────────────────────────────────────────────────────────────
interface PayrollBatch {
  _id:            string;
  status:         'processing' | 'completed' | 'completed_with_errors' | 'failed';
  totalEmployees: number;
  processedCount: number;
  failedCount:    number;
  completedAt?:   string;
}

interface PayrollGeneratorProps {
  onComplete:          () => void;
  selectedMonth:       number;
  selectedYear:        number;
  onMonthChange:       (m: number) => void;
  onYearChange:        (y: number) => void;
  /** Registers the internal handleGenerate so parent can trigger it */
  onRegisterTrigger?:  (fn: () => void) => void;
  /** Hides the button — used when PrepView has its own CTA */
  hidden?:             boolean;
}

export function PayrollGenerator({
  onComplete,
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange,
  onRegisterTrigger,
  hidden = false,
}: PayrollGeneratorProps) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [isGenerating,   setIsGenerating]   = useState(false);
  const [pollingBatchId, setPollingBatchId] = useState<string | null>(null);
  const [batchStatus,    setBatchStatus]    = useState<PayrollBatch | null>(null);
  const [isDone,         setIsDone]         = useState(false);   // shows success state in modal
  const [pollError,      setPollError]      = useState<string | null>(null);

  // Keep a stable ref to the interval so the cleanup always cancels the right one
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Trigger — POST /api/payroll/generate ──────────────────────────────────
  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      setPollError(null);

      const result = await api.generatePayroll(selectedMonth, selectedYear);

      // 202 Accepted — backend returns { batchId, totalEmployees }
      const batchId = (result as any).batchId as string;

      // Seed an optimistic initial state so the modal opens immediately
      // with 0/N instead of blank
      setBatchStatus({
        _id:            batchId,
        status:         'processing',
        totalEmployees: (result as any).totalEmployees ?? 0,
        processedCount: 0,
        failedCount:    0,
      });
      setIsDone(false);

      // Opening the modal — polling starts via the useEffect below
      setPollingBatchId(batchId);

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';

      // 409 means payroll already exists — not a crash, just inform HR
      if (msg.includes('already')) {
        toast.info('Payroll already exists', { description: msg });
      } else {
        toast.error('Failed to start payroll generation', { description: msg });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Register trigger with parent on mount / when handleGenerate changes
  useEffect(() => {
    onRegisterTrigger?.(handleGenerate);
  }, [selectedMonth, selectedYear]);   // re-register when period changes

  // ── Polling — GET /api/payroll/status/:batchId ────────────────────────────
  useEffect(() => {
    // Only run when we have a batchId to poll
    if (!pollingBatchId) return;

    const poll = async () => {
      try {
        const data = await api.getPayrollBatchStatus(pollingBatchId) as PayrollBatch;
        setBatchStatus(data);
        setPollError(null);

        const isComplete =
          data.status === 'completed'             ||
          data.status === 'completed_with_errors' ||
          data.status === 'failed'                ||
          data.processedCount + data.failedCount >= data.totalEmployees;

        if (isComplete) {
          // Stop polling immediately
          if (intervalRef.current) clearInterval(intervalRef.current);

          setIsDone(true);

          // Hold the completed modal for 2.5s so HR can read it, then close
          setTimeout(() => {
            setPollingBatchId(null);
            setIsDone(false);
            setBatchStatus(null);
            onComplete();   // refresh the payslips table
          }, 2_500);
        }

      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Poll failed';
        setPollError(msg);
        console.error('[PayrollGenerator] Poll error:', msg);
        // Do NOT stop polling on a single network blip — it will retry next tick
      }
    };

    // Fire once immediately so the modal updates without waiting 3s
    poll();

    // Then poll every POLL_INTERVAL_MS
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    // ── Cleanup — critical to prevent memory leaks on unmount / nav away ────
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pollingBatchId]);   // re-runs only when batchId changes

  // ── Derived values for the progress bar ───────────────────────────────────
  const processed  = batchStatus?.processedCount ?? 0;
  const total      = batchStatus?.totalEmployees  ?? 1;   // avoid div/0
  const failed     = batchStatus?.failedCount     ?? 0;
  const progressPct = Math.min(Math.round((processed / total) * 100), 100);

  const isCompleted       = batchStatus?.status === 'completed';
  const isCompletedErrors = batchStatus?.status === 'completed_with_errors';
  const isFailed          = batchStatus?.status === 'failed';

  return (
    <>
      {/* ── Trigger button — hidden in Prep view ── */}
      {!hidden && (
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !!pollingBatchId}
          size="sm"
        >
          {isGenerating
            ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            : <Plus className="mr-1.5 h-4 w-4" />}
          Generate Payroll
        </Button>
      )}

      {/* ── Progress Modal — always rendered regardless of hidden ── */}
      {pollingBatchId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center
                     bg-black/50 backdrop-blur-sm"
          // Prevent accidental close — HR should wait for completion
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl mx-4">

            {/* ── Done state ─────────────────────────────────────────────── */}
            {isDone ? (
              <div className="flex flex-col items-center text-center gap-3">
                {isFailed ? (
                  <>
                    <XCircle className="h-14 w-14 text-red-500" />
                    <h3 className="text-lg font-bold text-gray-900">Payroll Failed</h3>
                    <p className="text-sm text-gray-500">
                      The batch failed entirely. Check server logs and retry.
                    </p>
                  </>
                ) : isCompletedErrors ? (
                  <>
                    <AlertTriangle className="h-14 w-14 text-amber-500" />
                    <h3 className="text-lg font-bold text-gray-900">
                      Completed with Errors
                    </h3>
                    <p className="text-sm text-gray-500">
                      {processed} of {total} employees processed.{' '}
                      <span className="font-semibold text-red-600">
                        {failed} failed
                      </span>{' '}
                      — check <code className="bg-gray-100 px-1 rounded text-xs">failedEmployeeIds</code> in the batch record.
                    </p>
                  </>
                ) : (
                  <>
                    <PartyPopper className="h-14 w-14 text-green-500" />
                    <h3 className="text-lg font-bold text-gray-900">
                      Payroll Generated!
                    </h3>
                    <p className="text-sm text-gray-500">
                      All {total} payslips have been created as drafts.
                    </p>
                  </>
                )}

                {/* Progress bar — stays at 100% in done state */}
                <div className="w-full mt-2">
                  <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        isFailed          ? 'bg-red-500'   :
                        isCompletedErrors ? 'bg-amber-500' :
                        'bg-green-500'
                      }`}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <p className="text-xs text-gray-400 mt-1">Closing automatically…</p>
              </div>

            ) : (
              /* ── Processing state ────────────────────────────────────── */
              <div className="space-y-5">
                {/* Header */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                    <h3 className="text-base font-bold text-gray-900">
                      Generating Payroll
                    </h3>
                  </div>
                  <p className="text-sm text-gray-500 pl-7">
                    {MONTHS[selectedMonth - 1]} {selectedYear} — please don't close this window.
                  </p>
                </div>

                {/* ── Progress bar ─────────────────────────────────────── */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Processing employees…</span>
                    <span className="font-semibold tabular-nums">
                      {progressPct}%
                    </span>
                  </div>

                  <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-3 rounded-full bg-indigo-600 transition-all duration-500
                                 ease-out"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>

                  {/* Count label */}
                  <p className="text-center text-sm font-medium text-gray-700 tabular-nums">
                    {processed} / {total} employees
                  </p>
                </div>

                {/* ── Failed warning ───────────────────────────────────── */}
                {failed > 0 && (
                  <div className="flex items-start gap-2 rounded-lg bg-red-50
                                  border border-red-200 px-3 py-2">
                    <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-700">
                      <span className="font-semibold">{failed} employee(s)</span> failed
                      to process so far. The batch will continue for remaining employees.
                    </p>
                  </div>
                )}

                {/* ── Poll error (transient network blip) ──────────────── */}
                {pollError && (
                  <p className="text-xs text-center text-amber-600">
                    ⚠ Status check failed — retrying… ({pollError})
                  </p>
                )}

                {/* Step indicators */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    { label: 'Queued',     done: true },
                    { label: 'Processing', done: processed > 0 },
                    { label: 'Complete',   done: isDone },
                  ].map(step => (
                    <div
                      key={step.label}
                      className={`flex flex-col items-center gap-1 rounded-lg p-2
                                  text-xs font-medium transition-colors ${
                        step.done
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'bg-gray-50 text-gray-400'
                      }`}
                    >
                      <CheckCircle2 className={`h-4 w-4 ${
                        step.done ? 'text-indigo-600' : 'text-gray-300'
                      }`} />
                      {step.label}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}