import { useEffect, useState } from 'react';
import { useAuth }             from '@/context/AuthContext';
import { api }                 from '@/lib/api';
import type { Organization }   from '@/lib/api';
import { toast }               from 'sonner';
import { Loader2, Building2, Save } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card, CardContent, CardDescription,
  CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Input }   from '@/components/ui/input';
import { Label }   from '@/components/ui/label';
import { Button }  from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Skeleton loader ──────────────────────────────────────────────────────────
function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <Skeleton className="h-10 w-80" />
      <Card>
        <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Reusable field row ───────────────────────────────────────────────────────
function FieldRow({
  id, label, description, children,
}: {
  id?: string; label: string; description?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      {id
        ? <Label htmlFor={id} className="text-sm font-medium text-gray-700">{label}</Label>
        : <p className="text-sm font-medium text-gray-700">{label}</p>}
      {children}
      {description && <p className="text-xs text-gray-500">{description}</p>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function OrganizationSettings() {
  const { user } = useAuth();

  const [orgData,   setOrgData]   = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving,  setIsSaving]  = useState(false);

  const isSuperAdmin = user?.role === 'super_admin';

  // ── Fetch on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const data = await api.getOrganization();
        setOrgData(data);
      } catch (err) {
        toast.error('Failed to load organization settings', {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  // ── Top-level field handler ─────────────────────────────────────────────────
  const handleNameChange = (value: string) => {
    if (!orgData) return;
    setOrgData({ ...orgData, name: value });
  };

  // ── Nested settings handler ─────────────────────────────────────────────────
  const handleSettingChange = (
    section: 'leavePolicy' | 'payroll' | 'root',
    field:   string,
    value:   string | number,
  ) => {
    if (!orgData) return;

    if (section === 'root') {
      setOrgData({
        ...orgData,
        settings: { ...orgData.settings, [field]: value },
      });
      return;
    }

    setOrgData({
      ...orgData,
      settings: {
        ...orgData.settings,
        [section]: {
          ...orgData.settings[section],
          [field]: value,
        },
      },
    });
  };

  // ── Save handler ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!orgData) return;
    try {
      setIsSaving(true);
      const updated = await api.updateOrganization({
        name:     orgData.name,
        settings: orgData.settings,
      });
      setOrgData(updated);
      toast.success('Settings saved', {
        description: 'Organization settings have been updated successfully.',
      });
    } catch (err) {
      toast.error('Failed to save settings', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading) return <SettingsSkeleton />;

  // ── Null guard ──────────────────────────────────────────────────────────────
  if (!orgData) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">
          Could not load organization data. Please refresh the page.
        </p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  // ── Page ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
            <Building2 className="h-5 w-5 text-gray-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Organization Settings</h1>
            <p className="text-sm text-gray-500">
              Manage your organization's configuration and policies.
            </p>
          </div>
        </div>

        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
            : <><Save className="mr-2 h-4 w-4" />Save Changes</>}
        </Button>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="leavePolicy">Leave Policy</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
        </TabsList>

        {/* ── General tab ───────────────────────────────────────────────────── */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">General Information</CardTitle>
              <CardDescription>
                Basic details about your organization.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">

              {/* Name */}
              <FieldRow
                id="org-name"
                label="Organization Name"
                description={
                  !isSuperAdmin
                    ? 'Only Super Admins can change the organization name.'
                    : undefined
                }
              >
                <Input
                  id="org-name"
                  value={orgData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  disabled={!isSuperAdmin}
                  placeholder="Acme Corp"
                />
              </FieldRow>

              {/* Slug — always disabled */}
              <FieldRow
                id="org-slug"
                label="Slug"
                description="This identifier is permanent and cannot be changed."
              >
                <Input
                  id="org-slug"
                  value={orgData.slug}
                  disabled
                  className="bg-gray-50 text-gray-500"
                />
              </FieldRow>

              {/* Timezone */}
              <FieldRow id="org-timezone" label="Timezone">
                <Input
                  id="org-timezone"
                  value={orgData.settings.timezone}
                  onChange={(e) =>
                    handleSettingChange('root', 'timezone', e.target.value)
                  }
                  placeholder="Asia/Kolkata"
                />
              </FieldRow>

            </CardContent>

            {/* Subscription info — read-only, super_admin only */}
            {isSuperAdmin && (
              <CardFooter className="flex-col items-start gap-3 border-t pt-5">
                <p className="text-sm font-medium text-gray-700">Subscription</p>
                <div className="grid grid-cols-3 gap-4 w-full">
                  <div className="rounded-md border bg-gray-50 px-3 py-2">
                    <p className="text-xs text-gray-500">Plan</p>
                    <p className="text-sm font-medium capitalize">{orgData.subscription.plan}</p>
                  </div>
                  <div className="rounded-md border bg-gray-50 px-3 py-2">
                    <p className="text-xs text-gray-500">Status</p>
                    <p className={`text-sm font-medium capitalize ${
                      orgData.subscription.status === 'active' ? 'text-green-700' : 'text-red-600'
                    }`}>
                      {orgData.subscription.status.replace('_', ' ')}
                    </p>
                  </div>
                  <div className="rounded-md border bg-gray-50 px-3 py-2">
                    <p className="text-xs text-gray-500">Max Users</p>
                    <p className="text-sm font-medium">{orgData.subscription.maxUsers}</p>
                  </div>
                </div>
              </CardFooter>
            )}
          </Card>
        </TabsContent>

        {/* ── Leave Policy tab ──────────────────────────────────────────────── */}
        <TabsContent value="leavePolicy">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Leave Policy</CardTitle>
              <CardDescription>
                Set the annual leave entitlements for all employees.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">

              {/* Casual leaves */}
              <FieldRow
                id="casual-leaves"
                label="Casual Leaves (per year)"
                description="Number of casual leave days each employee is entitled to annually."
              >
                <Input
                  id="casual-leaves"
                  type="number"
                  min={0}
                  max={365}
                  value={orgData.settings.leavePolicy.casualLeaves}
                  onChange={(e) =>
                    handleSettingChange(
                      'leavePolicy',
                      'casualLeaves',
                      Math.max(0, parseInt(e.target.value) || 0)
                    )
                  }
                  className="w-40"
                />
              </FieldRow>

              {/* Sick leaves */}
              <FieldRow
                id="sick-leaves"
                label="Sick Leaves (per year)"
                description="Number of sick leave days each employee is entitled to annually."
              >
                <Input
                  id="sick-leaves"
                  type="number"
                  min={0}
                  max={365}
                  value={orgData.settings.leavePolicy.sickLeaves}
                  onChange={(e) =>
                    handleSettingChange(
                      'leavePolicy',
                      'sickLeaves',
                      Math.max(0, parseInt(e.target.value) || 0)
                    )
                  }
                  className="w-40"
                />
              </FieldRow>

            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Payroll tab ───────────────────────────────────────────────────── */}
        <TabsContent value="payroll">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payroll Configuration</CardTitle>
              <CardDescription>
                Configure how payroll is calculated and processed.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">

              {/* Currency */}
              <FieldRow
                id="payroll-currency"
                label="Currency"
                description="The currency used for all salary calculations."
              >
                <Input
                  id="payroll-currency"
                  value={orgData.settings.payroll.currency}
                  onChange={(e) =>
                    handleSettingChange('payroll', 'currency', e.target.value.toUpperCase())
                  }
                  placeholder="USD"
                  maxLength={3}
                  className="w-28 uppercase"
                />
              </FieldRow>

              {/* Pay cycle */}
              <FieldRow label="Pay Cycle" description="How frequently employees are paid.">
                <Select
                  value={orgData.settings.payroll.payCycle}
                  onValueChange={(val) =>
                    handleSettingChange('payroll', 'payCycle', val)
                  }
                >
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Select cycle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="bi-weekly">Bi-Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>

              {/* Tax ID */}
              <FieldRow
                id="payroll-taxid"
                label="Tax ID"
                description="Your organization's tax identification number (optional)."
              >
                <Input
                  id="payroll-taxid"
                  value={orgData.settings.payroll.taxId ?? ''}
                  onChange={(e) =>
                    handleSettingChange('payroll', 'taxId', e.target.value)
                  }
                  placeholder="e.g. 12-3456789"
                  className="w-60"
                />
              </FieldRow>

            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Floating save at bottom for long pages ───────────────────────────── */}
      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={isSaving} variant="outline">
          {isSaving
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
            : <><Save className="mr-2 h-4 w-4" />Save Changes</>}
        </Button>
      </div>
    </div>
  );
}