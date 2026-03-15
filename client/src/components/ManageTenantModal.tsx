import { useState, useEffect } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input }  from '@/components/ui/input';
import { Label }  from '@/components/ui/label';
import { toast }  from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrgSubscription {
  plan:     'free' | 'pro' | 'enterprise';
  status:   'active' | 'past_due';
  maxUsers: number;
}

interface OrgSettings {
  payroll: { currency: string; payCycle: string; taxId?: string };
  timezone: string;
  leavePolicy: { casualLeaves: number; sickLeaves: number };
}

export interface ManagedOrg {
  _id:          string;
  name:         string;
  slug:         string;
  isActive:     boolean;
  subscription: OrgSubscription;
  settings:     OrgSettings;
  createdAt:    string;
}

interface Props {
  isOpen:          boolean;
  onClose:         () => void;
  organization:    ManagedOrg | null;
  onUpdateSuccess: (updated: ManagedOrg) => void;
}

// ─── Local form state shape ───────────────────────────────────────────────────

interface FormData {
  isActive: boolean;
  plan:     'free' | 'pro' | 'enterprise';
  maxUsers: number;
  taxId:    string;
}

const API_BASE = import.meta.env.VITE_API_URL as string;

// ─── Component ────────────────────────────────────────────────────────────────

export function ManageTenantModal({ isOpen, onClose, organization, onUpdateSuccess }: Props) {
  const [formData,    setFormData]    = useState<FormData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError,  setSubmitError]  = useState<string | null>(null);

  // Sync local form whenever the selected org changes
  useEffect(() => {
    if (!organization) { setFormData(null); return; }
    setFormData({
      isActive: organization.isActive,
      plan:     organization.subscription.plan,
      maxUsers: organization.subscription.maxUsers,
      taxId:    organization.settings.payroll.taxId ?? '',
    });
    setSubmitError(null);
  }, [organization]);

  const handleSave = async () => {
    if (!organization || !formData) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const token = localStorage.getItem('adminToken') ?? '';
      const res   = await fetch(`${API_BASE}/super-admin/organizations/${organization._id}`, {
        method:  'PATCH',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          isActive:     formData.isActive,
          subscription: {
            plan:     formData.plan,
            maxUsers: formData.maxUsers,
          },
          settings: {
            payroll: { taxId: formData.taxId },
          },
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Update failed');

      toast.success(`${organization.name} updated successfully.`);
      onUpdateSuccess(json.data as ManagedOrg);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!formData || !organization) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">

        <SheetHeader className="mb-6">
          <SheetTitle className="text-lg font-semibold text-gray-900">
            Manage {organization.name}
          </SheetTitle>
          <SheetDescription className="text-sm text-gray-500">
            Update subscription, billing settings, or suspend access.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">

          {/* ── Kill Switch ─────────────────────────────────────────────── */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Organisation Status</p>
                <p className="text-xs text-gray-500 mt-0.5">Active / Suspended</p>
              </div>

              {/* Tailwind toggle — Switch component not yet installed */}
              <button
                type="button"
                role="switch"
                aria-checked={formData.isActive}
                onClick={() => setFormData(f => f ? { ...f, isActive: !f.isActive } : f)}
                className={`
                  relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
                  transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2
                  focus-visible:ring-violet-500 focus-visible:ring-offset-2
                  ${formData.isActive ? 'bg-violet-600' : 'bg-gray-300'}
                `}
              >
                <span
                  className={`
                    pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow
                    ring-0 transition duration-200 ease-in-out
                    ${formData.isActive ? 'translate-x-5' : 'translate-x-0'}
                  `}
                />
              </button>
            </div>

            {!formData.isActive && (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                <p className="text-xs text-red-700 leading-snug">
                  Users in this organisation will <strong>immediately lose access</strong> to
                  the platform when you save.
                </p>
              </div>
            )}
          </div>

          {/* ── Subscription Plan ────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label htmlFor="plan" className="text-sm font-medium text-gray-700">
              Subscription Plan
            </Label>
            <Select
              value={formData.plan}
              onValueChange={(v) => setFormData(f => f ? { ...f, plan: v as FormData['plan'] } : f)}
            >
              <SelectTrigger id="plan" className="w-full">
                <SelectValue placeholder="Select plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ── Max Users ────────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label htmlFor="maxUsers" className="text-sm font-medium text-gray-700">
              Max Users
            </Label>
            <Input
              id="maxUsers"
              type="number"
              min={1}
              value={formData.maxUsers}
              onChange={e => setFormData(f => f ? { ...f, maxUsers: Number(e.target.value) } : f)}
            />
          </div>

          {/* ── Tax ID ───────────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label htmlFor="taxId" className="text-sm font-medium text-gray-700">
              Tax ID
            </Label>
            <Input
              id="taxId"
              type="text"
              placeholder="e.g. US-123456789"
              value={formData.taxId}
              onChange={e => setFormData(f => f ? { ...f, taxId: e.target.value } : f)}
            />
          </div>

          {/* ── Error ────────────────────────────────────────────────────── */}
          {submitError && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {submitError}
            </p>
          )}

        </div>

        <SheetFooter className="mt-8 flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSubmitting}
            className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </SheetFooter>

      </SheetContent>
    </Sheet>
  );
}