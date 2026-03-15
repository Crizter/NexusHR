import { useState } from 'react';
import { Building2, User, Mail, Loader2, CheckCircle2, AlertCircle, ShieldCheck, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input }  from '@/components/ui/input';
import { Label }  from '@/components/ui/label';
import { Button } from '@/components/ui/button';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  orgName:   string;
  firstName: string;
  lastName:  string;
  email:     string;
}

interface Status {
  type:    'idle' | 'success' | 'error';
  message: string;
}

const EMPTY_FORM: FormData = { orgName: '', firstName: '', lastName: '', email: '' };

// ─── Component ────────────────────────────────────────────────────────────────

export function SuperAdminDashboard() {
  const [formData,     setFormData]     = useState<FormData>(EMPTY_FORM);
  const [status,       setStatus]       = useState<Status>({ type: 'idle', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setField = (key: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    if (status.type !== 'idle') setStatus({ type: 'idle', message: '' });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus({ type: 'idle', message: '' });
    try {
      await api.onboardTenant(formData);
      setStatus({
        type:    'success',
        message: `Organization created successfully! Credentials emailed to ${formData.email}.`,
      });
      setFormData(EMPTY_FORM);
    } catch (err) {
      setStatus({
        type:    'error',
        message: err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100">
            <ShieldCheck className="h-5 w-5 text-violet-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Tenant Provisioning</h1>
        </div>
        <p className="text-sm text-gray-500 pl-12 leading-relaxed">
          Creates a new isolated tenant environment and emails the HR Manager their credentials.
          This action cannot be undone without direct database access.
        </p>
      </div>

      {/* ── Status banners ──────────────────────────────────────────────── */}
      {status.type === 'success' && (
        <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3.5">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
          <p className="text-sm font-medium text-green-800">{status.message}</p>
        </div>
      )}
      {status.type === 'error' && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3.5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <p className="text-sm font-medium text-red-800">{status.message}</p>
        </div>
      )}

      {/* ── Form card ───────────────────────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">New Tenant Details</CardTitle>
          <CardDescription>All fields are required.</CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit} noValidate>
          <CardContent className="space-y-5">

            {/* Organization Name */}
            <div className="space-y-1.5">
              <Label htmlFor="orgName">Organization Name</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <Input
                  id="orgName"
                  type="text"
                  required
                  placeholder="Acme Corp"
                  value={formData.orgName}
                  onChange={e => setField('orgName', e.target.value)}
                  disabled={isSubmitting}
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-gray-400">Must be unique across the platform.</p>
            </div>

            {/* First + Last Name */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">First Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <Input
                    id="firstName"
                    type="text"
                    required
                    placeholder="Jane"
                    value={formData.firstName}
                    onChange={e => setField('firstName', e.target.value)}
                    disabled={isSubmitting}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Last Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <Input
                    id="lastName"
                    type="text"
                    required
                    placeholder="Smith"
                    value={formData.lastName}
                    onChange={e => setField('lastName', e.target.value)}
                    disabled={isSubmitting}
                    className="pl-9"
                  />
                </div>
              </div>
              <p className="col-span-2 -mt-1 text-xs text-gray-400">
                HR Manager's name — used in the welcome email.
              </p>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email">HR Manager Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="hr@acmecorp.com"
                  value={formData.email}
                  onChange={e => setField('email', e.target.value)}
                  disabled={isSubmitting}
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-gray-400">
                A temporary password will be sent here. Must be unique across the platform.
              </p>
            </div>

          </CardContent>

          <CardFooter className="flex items-center justify-between gap-4 rounded-b-xl border-t bg-gray-50 px-6 py-4">
            <p className="max-w-xs text-xs text-gray-400">
              Credentials are emailed on creation. The HR Manager should change their password on first login.
            </p>
            <Button
              type="submit"
              disabled={isSubmitting || !formData.orgName || !formData.firstName || !formData.lastName || !formData.email}
              className="shrink-0 bg-violet-600 hover:bg-violet-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Provisioning...
                </>
              ) : (
                'Provision Tenant'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* ── Tenant Directory quick-link ──────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardContent className="flex items-center justify-between py-5">
          <div>
            <p className="text-sm font-semibold text-gray-800">Tenant Directory</p>
            <p className="mt-0.5 text-xs text-gray-400">
              Browse and search all provisioned organisations.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0 gap-2">
            <Link to="/super-admin/tenants">
              <Building2 className="h-4 w-4" />
              View Directory
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardContent>
      </Card>

    </div>
  );
}