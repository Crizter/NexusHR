import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { mockApi } from '@/lib/mockApi';
import type { Department } from '@/lib/mockApi';
import { ROLES } from '@/lib/config';
import type { Role } from '@/lib/config';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, AlertCircle } from 'lucide-react';

// ─── Props ────────────────────────────────────────────────────────────────────
interface AddEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// ─── Form state shape ─────────────────────────────────────────────────────────
interface FormState {
  firstName:    string;
  lastName:     string;
  email:        string;
  role:         Role | '';
  departmentId: string;
}

// ─── Validation errors shape ──────────────────────────────────────────────────
interface FormErrors {
  firstName?:    string;
  lastName?:     string;
  email?:        string;
  role?:         string;
  departmentId?: string;
}

const EMPTY_FORM: FormState = {
  firstName:    '',
  lastName:     '',
  email:        '',
  role:         '',
  departmentId: '',
};

// ─── Selectable roles (super_admin is not assignable via UI) ──────────────────
const ASSIGNABLE_ROLES: { value: Role; label: string }[] = [
  { value: ROLES.hr_manager, label: 'HR Manager' },
  { value: ROLES.employee,   label: 'Employee'   },
];

// ─── Component ────────────────────────────────────────────────────────────────
export function AddEmployeeDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddEmployeeDialogProps) {
  const { user } = useAuth();

  // ── Form state ─────────────────────────────────────────────────────────────
  const [form, setForm]               = useState<FormState>(EMPTY_FORM);
  const [formErrors, setFormErrors]   = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading]         = useState<boolean>(false);

  // ── Departments ────────────────────────────────────────────────────────────
  const [departments, setDepartments]       = useState<Department[]>([]);
  const [deptLoading, setDeptLoading]       = useState<boolean>(true);
  const [deptError, setDeptError]           = useState<string | null>(null);

  // Fetch departments once when the dialog opens
  useEffect(() => {
    if (!open || !user?.orgId) return;

    const fetchDepartments = async () => {
      try {
        setDeptLoading(true);
        setDeptError(null);
        const data = await mockApi.getDepartments(user.orgId);
        setDepartments(data);
      } catch (err) {
        setDeptError(
          err instanceof Error ? err.message : 'Failed to load departments'
        );
      } finally {
        setDeptLoading(false);
      }
    };

    fetchDepartments();
  }, [open, user?.orgId]);

  // Reset the whole form whenever the dialog is closed
  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setFormErrors({});
      setSubmitError(null);
    }
  }, [open]);

  // ── Field helpers ──────────────────────────────────────────────────────────
  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    // Clear per-field error as soon as the user starts correcting
    if (formErrors[key]) {
      setFormErrors(prev => ({ ...prev, [key]: undefined }));
    }
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const errors: FormErrors = {};

    if (!form.firstName.trim()) {
      errors.firstName = 'First name is required.';
    } else if (form.firstName.trim().length < 2) {
      errors.firstName = 'First name must be at least 2 characters.';
    }

    if (!form.lastName.trim()) {
      errors.lastName = 'Last name is required.';
    } else if (form.lastName.trim().length < 2) {
      errors.lastName = 'Last name must be at least 2 characters.';
    }

    if (!form.email.trim()) {
      errors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!form.role) {
      errors.role = 'Please select a role.';
    }

    if (!form.departmentId) {
      errors.departmentId = 'Please select a department.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validate()) return;
    if (!user?.orgId)  return;

    try {
      setLoading(true);
      setSubmitError(null);

      await mockApi.addEmployee(user.orgId, {
        displayId:     '',           // generated by the API / backend
        email:         form.email.trim(),
        passwordHash:  'temp_hash',  // placeholder — backend will hash on real API
        role:          form.role as Role,
        departmentId:  form.departmentId,
        profile: {
          firstName:     form.firstName.trim(),
          lastName:      form.lastName.trim(),
          contactNumber: '',
        },
        financial: {
          baseSalary: 0,
          currency:   'USD',
        },
        leaveBalances: {
          casual: 10,
          sick:   8,
        },
      });

      // Notify parent to re-fetch the table and close
      onSuccess();
      onOpenChange(false);

    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-white">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-gray-900">
            Add New Employee
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            Fill in the details below. The employee will be added to your
            organization immediately.
          </DialogDescription>
        </DialogHeader>

        {/* ── Form ───────────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-5 py-2">

            {/* First Name + Last Name — 2-column grid */}
            <div className="grid grid-cols-2 gap-4">

              {/* First Name */}
              <div className="space-y-1.5">
                <Label htmlFor="firstName" className="text-sm font-medium text-gray-700">
                  First Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="firstName"
                  placeholder="Sarah"
                  value={form.firstName}
                  onChange={(e) => setField('firstName', e.target.value)}
                  disabled={loading}
                  className={formErrors.firstName ? 'border-red-400 focus-visible:ring-red-300' : ''}
                />
                {formErrors.firstName && (
                  <p className="text-xs text-red-500">{formErrors.firstName}</p>
                )}
              </div>

              {/* Last Name */}
              <div className="space-y-1.5">
                <Label htmlFor="lastName" className="text-sm font-medium text-gray-700">
                  Last Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="lastName"
                  placeholder="Johnson"
                  value={form.lastName}
                  onChange={(e) => setField('lastName', e.target.value)}
                  disabled={loading}
                  className={formErrors.lastName ? 'border-red-400 focus-visible:ring-red-300' : ''}
                />
                {formErrors.lastName && (
                  <p className="text-xs text-red-500">{formErrors.lastName}</p>
                )}
              </div>
            </div>

            {/* Email — full width */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email Address <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="sarah@nexustech.com"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                disabled={loading}
                className={formErrors.email ? 'border-red-400 focus-visible:ring-red-300' : ''}
              />
              {formErrors.email && (
                <p className="text-xs text-red-500">{formErrors.email}</p>
              )}
            </div>

            {/* Role select */}
            <div className="space-y-1.5">
              <Label htmlFor="role" className="text-sm font-medium text-gray-700">
                Role <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.role}
                onValueChange={(value) => setField('role', value as Role)}
                disabled={loading}
              >
                <SelectTrigger
                  id="role"
                  className={formErrors.role ? 'border-red-400 focus:ring-red-300' : ''}
                >
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.role && (
                <p className="text-xs text-red-500">{formErrors.role}</p>
              )}
            </div>

            {/* Department select */}
            <div className="space-y-1.5">
              <Label htmlFor="departmentId" className="text-sm font-medium text-gray-700">
                Department <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.departmentId}
                onValueChange={(value) => setField('departmentId', value)}
                disabled={loading || deptLoading}
              >
                <SelectTrigger
                  id="departmentId"
                  className={formErrors.departmentId ? 'border-red-400 focus:ring-red-300' : ''}
                >
                  <SelectValue
                    placeholder={deptLoading ? 'Loading departments...' : 'Select a department'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {deptError ? (
                    // Non-interactive message inside the dropdown
                    <div className="px-3 py-2 text-sm text-red-500">{deptError}</div>
                  ) : (
                    departments.map((dept) => (
                      <SelectItem key={dept._id} value={dept._id}>
                        {dept.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {formErrors.departmentId && (
                <p className="text-xs text-red-500">{formErrors.departmentId}</p>
              )}
            </div>

            {/* Submission-level error banner */}
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
              disabled={loading || deptLoading}
              className="w-full sm:w-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Employee'
              )}
            </Button>
          </DialogFooter>
        </form>

      </DialogContent>
    </Dialog>
  );
}