import { useEffect, useState }     from 'react';
import { useSearchParams }         from 'react-router-dom';
import { useAuth }                 from '@/context/AuthContext';
import { api }                     from '@/lib/api';
import type { Organization, ZoomStatus } from '@/lib/api';
import { toast }                   from 'sonner';
import {
  Loader2, Building2, Save,
  Video, Plug, PlugZap,
  Settings2,
} from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card, CardContent, CardDescription,
  CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import { Button }   from '@/components/ui/button';
import { Badge }    from '@/components/ui/badge';
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

// ─── Integration card skeleton ────────────────────────────────────────────────
function IntegrationCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-9 w-36" />
      </CardContent>
    </Card>
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

// ─── Zoom Integration Card ────────────────────────────────────────────────────
function ZoomIntegrationCard() {
  const [zoomStatus,      setZoomStatus]      = useState<ZoomStatus | null>(null);
  const [isStatusLoading, setIsStatusLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    api.getZoomStatus()
      .then(setZoomStatus)
      .catch(() => toast.error('Could not fetch Zoom status.'))
      .finally(() => setIsStatusLoading(false));
  }, []);

  const handleConnect = async () => {
    try {
      setIsActionLoading(true);
      const { url } = await api.getZoomAuthUrl();
      window.location.href = url;
    } catch {
      toast.error('Failed to start Zoom connection. Please try again.');
      setIsActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsActionLoading(true);
      await api.disconnectZoom();
      setZoomStatus(prev =>
        prev
          ? { ...prev, isConnected: false, zoomUserId: null, expiresAt: null, isExpired: null }
          : null
      );
      toast.success('Zoom account disconnected successfully.');
    } catch {
      toast.error('Failed to disconnect Zoom. Please try again.');
    } finally {
      setIsActionLoading(false);
    }
  };

  if (isStatusLoading) return <IntegrationCardSkeleton />;

  const isConnected = zoomStatus?.isConnected ?? false;
  const isExpired   = zoomStatus?.isExpired   ?? false;

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">

          {/* Icon + title */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <Video className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base">Zoom</CardTitle>
              <CardDescription>
                Schedule and launch interviews directly from NexusHR.
              </CardDescription>
            </div>
          </div>

          {/* Status badge */}
          {isConnected ? (
            <Badge
              variant="outline"
              className="shrink-0 gap-1.5 border-green-200 bg-green-50 text-green-700"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              {isExpired ? 'Token Expired' : 'Connected'}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="shrink-0 gap-1.5 border-gray-200 bg-gray-50 text-gray-500"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
              Not Connected
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">

        {/* Connected detail row */}
        {isConnected && zoomStatus?.zoomUserId && (
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
            <p className="text-xs text-gray-500">Zoom User ID</p>
            <p className="mt-0.5 font-mono text-sm text-gray-700">
              {zoomStatus.zoomUserId}
            </p>
            {zoomStatus.expiresAt && (
              <p className="mt-1 text-xs text-gray-400">
                Token expires: {new Date(zoomStatus.expiresAt).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* Action button */}
        {isConnected ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDisconnect}
            disabled={isActionLoading}
            className="border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
          >
            {isActionLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Disconnecting...</>
            ) : (
              <><PlugZap className="mr-2 h-4 w-4" />Disconnect Zoom</>
            )}
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleConnect}
            disabled={isActionLoading}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {isActionLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Redirecting...</>
            ) : (
              <><Plug className="mr-2 h-4 w-4" />Connect Zoom</>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function OrganizationSettings() {
  const { user }                        = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [orgData,   setOrgData]   = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving,  setIsSaving]  = useState(false);

  const isSuperAdmin = user?.role === 'super_admin';

  // ── Handle ?zoom=success|error from Zoom OAuth callback redirect ────────────
  useEffect(() => {
    const zoomParam  = searchParams.get('zoom');
    const reason     = searchParams.get('reason');

    if (zoomParam === 'success') {
      toast.success('Zoom connected successfully!');
    } else if (zoomParam === 'error') {
      const readable = reason?.replace(/_/g, ' ') ?? 'Unknown error';
      toast.error(`Zoom connection failed: ${readable}.`);
    }

    // Clean ?zoom=... from URL without reloading the page
    if (zoomParam) {
      setSearchParams({}, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — run only on mount

  // ── Fetch org data on mount ─────────────────────────────────────────────────
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
      setOrgData({ ...orgData, settings: { ...orgData.settings, [field]: value } });
      return;
    }

    setOrgData({
      ...orgData,
      settings: {
        ...orgData.settings,
        [section]: { ...orgData.settings[section], [field]: value },
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
        <Button
          variant="outline" size="sm"
          className="mt-3"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </div>
    );
  }

  // ── Page ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
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

      {/* Tabs */}
      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="leavePolicy">Leave Policy</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        {/* General tab */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">General Information</CardTitle>
              <CardDescription>Basic details about your organization.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
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

              <FieldRow id="org-timezone" label="Timezone">
                <Input
                  id="org-timezone"
                  value={orgData.settings.timezone}
                  onChange={(e) => handleSettingChange('root', 'timezone', e.target.value)}
                  placeholder="Asia/Kolkata"
                />
              </FieldRow>
            </CardContent>

            {isSuperAdmin && (
              <CardFooter className="flex-col items-start gap-3 border-t pt-5">
                <p className="text-sm font-medium text-gray-700">Subscription</p>
                <div className="grid w-full grid-cols-3 gap-4">
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

        {/* Leave Policy tab */}
        <TabsContent value="leavePolicy">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Leave Policy</CardTitle>
              <CardDescription>
                Set the annual leave entitlements for all employees.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
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
                      'leavePolicy', 'casualLeaves',
                      Math.max(0, parseInt(e.target.value) || 0)
                    )
                  }
                  className="w-40"
                />
              </FieldRow>

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
                      'leavePolicy', 'sickLeaves',
                      Math.max(0, parseInt(e.target.value) || 0)
                    )
                  }
                  className="w-40"
                />
              </FieldRow>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payroll tab */}
        <TabsContent value="payroll">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payroll Configuration</CardTitle>
              <CardDescription>
                Configure how payroll is calculated and processed.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
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

              <FieldRow
                label="Pay Cycle"
                description="How frequently employees are paid."
              >
                <Select
                  value={orgData.settings.payroll.payCycle}
                  onValueChange={(val) => handleSettingChange('payroll', 'payCycle', val)}
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

              <FieldRow
                id="payroll-taxid"
                label="Tax ID"
                description="Your organization's tax identification number (optional)."
              >
                <Input
                  id="payroll-taxid"
                  value={orgData.settings.payroll.taxId ?? ''}
                  onChange={(e) => handleSettingChange('payroll', 'taxId', e.target.value)}
                  placeholder="e.g. 12-3456789"
                  className="w-60"
                />
              </FieldRow>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations tab */}
        <TabsContent value="integrations">
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-gray-400" />
              <div>
                <h2 className="text-sm font-semibold text-gray-700">Video Conferencing</h2>
                <p className="text-xs text-gray-500">
                  Connect tools used during the interview process.
                </p>
              </div>
            </div>

            {/* Zoom */}
            <ZoomIntegrationCard />

            {/* Coming soon placeholders */}
            <div>
              <h2 className="mb-3 text-sm font-semibold text-gray-400">Coming Soon</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {(['Google Meet', 'Microsoft Teams'] as const).map(name => (
                  <Card key={name} className="pointer-events-none opacity-50">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                            <Video className="h-5 w-5 text-gray-400" />
                          </div>
                          <div>
                            <CardTitle className="text-base text-gray-500">{name}</CardTitle>
                            <CardDescription>Available in a future update.</CardDescription>
                          </div>
                        </div>
                        <Badge variant="outline" className="border-gray-200 text-gray-400">
                          Soon
                        </Badge>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Floating save — hidden on integrations tab since it has no saveable fields */}
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