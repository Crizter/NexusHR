import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';                          // ← real API
import type { Department } from '@/lib/api';
import { ROLES } from '@/lib/config';
import type { Role } from '@/lib/config';
import { toast }    from 'sonner';      
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, AlertCircle } from 'lucide-react';

interface AddEmployeeDialogProps {
  open:         boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess:    () => void;
}

interface FormState {
  firstName:    string;
  lastName:     string;
  email:        string;
  role:         Role | '';
  departmentId: string;
}

interface FormErrors {
  firstName?:    string;
  lastName?:     string;
  email?:        string;
  role?:         string;
  departmentId?: string;
}

const EMPTY_FORM: FormState = {
  firstName: '', lastName: '', email: '', role: '', departmentId: '',
};

const ASSIGNABLE_ROLES: { value: Role; label: string }[] = [
  { value: ROLES.hr_manager, label: 'HR Manager' },
  { value: ROLES.manager,    label: 'Manager'    },
  { value: ROLES.employee,   label: 'Employee'   },
];

export function AddEmployeeDialog({ open, onOpenChange, onSuccess }: AddEmployeeDialogProps) {
  const { user } = useAuth();

  const [form,        setForm]        = useState<FormState>(EMPTY_FORM);
  const [formErrors,  setFormErrors]  = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading,     setLoading]     = useState(false);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptLoading, setDeptLoading] = useState(true);
  const [deptError,   setDeptError]   = useState<string | null>(null);

  // ── Fetch departments when dialog opens ───────────────────────────────────
  useEffect(() => {
    if (!open || !user?.orgId) return;

    const fetchDepts = async () => {
      try {
        setDeptLoading(true);
        setDeptError(null);
        const data = await api.getDepartments();          // ← real API
        setDepartments(data);
      } catch (err) {
        setDeptError(err instanceof Error ? err.message : 'Failed to load departments');
      } finally {
        setDeptLoading(false);
      }
    };

    fetchDepts();
  }, [open, user?.orgId]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setFormErrors({});
      setSubmitError(null);
    }
  }, [open]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (formErrors[key]) setFormErrors(prev => ({ ...prev, [key]: undefined }));
    if (submitError)     setSubmitError(null);
  };

  const validate = (): boolean => {
    const errors: FormErrors = {};

    if (!form.firstName.trim())          errors.firstName    = 'First name is required.';
    else if (form.firstName.trim().length < 2) errors.firstName = 'At least 2 characters.';

    if (!form.lastName.trim())           errors.lastName     = 'Last name is required.';
    else if (form.lastName.trim().length < 2)  errors.lastName  = 'At least 2 characters.';

    if (!form.email.trim())              errors.email        = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
                                         errors.email        = 'Enter a valid email.';

    if (!form.role)                      errors.role         = 'Please select a role.';
    if (!form.departmentId)              errors.departmentId = 'Please select a department.';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate() || !user?.orgId) return;

    try {
      setLoading(true);
      setSubmitError(null);

        const created = await api.addEmployee(user.orgId, {
        displayId:    '',
        email:        form.email.trim(),
        role:         form.role as Role,
        departmentId: form.departmentId,
        profile: {
          firstName:     form.firstName.trim(),
          lastName:      form.lastName.trim(),
          contactNumber: '',
        },
        financial:     { baseSalary: 0, currency: 'USD' },
        leaveBalances: { casual: 12, sick: 10 },
        lastLogin:     undefined,
      });
        // ── Success toast ───────────────────────────────────────────────────
      toast.success('Employee added successfully!', {
        description: `${created.profile.firstName} ${created.profile.lastName} has been added to the directory.`,
        duration: 4000,
      });
      
      onSuccess();
      onOpenChange(false);

    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-white">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-gray-900">
            Add New Employee
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            Default password will be set to <span className="font-mono">password123</span>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-5 py-2">

            {/* First + Last name */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="firstName" className="text-sm font-medium text-gray-700">
                  First Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="firstName" placeholder="Sarah"
                  value={form.firstName} disabled={loading}
                  onChange={(e) => setField('firstName', e.target.value)}
                  className={formErrors.firstName ? 'border-red-400' : ''}
                />
                {formErrors.firstName && <p className="text-xs text-red-500">{formErrors.firstName}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lastName" className="text-sm font-medium text-gray-700">
                  Last Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="lastName" placeholder="Johnson"
                  value={form.lastName} disabled={loading}
                  onChange={(e) => setField('lastName', e.target.value)}
                  className={formErrors.lastName ? 'border-red-400' : ''}
                />
                {formErrors.lastName && <p className="text-xs text-red-500">{formErrors.lastName}</p>}
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email Address <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email" type="email" placeholder="sarah@nexustech.com"
                value={form.email} disabled={loading}
                onChange={(e) => setField('email', e.target.value)}
                className={formErrors.email ? 'border-red-400' : ''}
              />
              {formErrors.email && <p className="text-xs text-red-500">{formErrors.email}</p>}
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">
                Role <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.role}
                onValueChange={(v) => setField('role', v as Role)}
                disabled={loading}
              >
                <SelectTrigger className={formErrors.role ? 'border-red-400' : ''}>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE_ROLES.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.role && <p className="text-xs text-red-500">{formErrors.role}</p>}
            </div>

            {/* Department */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">
                Department <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.departmentId}
                onValueChange={(v) => setField('departmentId', v)}
                disabled={loading || deptLoading}
              >
                <SelectTrigger className={formErrors.departmentId ? 'border-red-400' : ''}>
                  <SelectValue placeholder={deptLoading ? 'Loading...' : 'Select a department'} />
                </SelectTrigger>
                <SelectContent>
                  {deptError
                    ? <div className="px-3 py-2 text-sm text-red-500">{deptError}</div>
                    : departments.map(dept => (
                        <SelectItem key={dept._id} value={dept._id}>{dept.name}</SelectItem>
                      ))
                  }
                </SelectContent>
              </Select>
              {formErrors.departmentId && <p className="text-xs text-red-500">{formErrors.departmentId}</p>}
            </div>

            {/* Submit error */}
            {submitError && (
              <div className="flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 px-3 py-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <p className="text-sm text-red-700">{submitError}</p>
              </div>
            )}
          </div>

          <DialogFooter className="mt-6 gap-2 sm:gap-0">
            <Button type="button" variant="outline"
              onClick={() => onOpenChange(false)} disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || deptLoading}>
              {loading
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                : 'Save Employee'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}