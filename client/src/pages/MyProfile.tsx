import { useState, useEffect } from 'react';
import { useAuth }             from '@/context/AuthContext';
import { api }                 from '@/lib/api';
import type { Payslip }        from '@/lib/api';
import { format }              from 'date-fns';
import { usePayslipDownload }  from '@/hooks/usePayslipDownload';
import {
  Card, CardContent, CardDescription,
  CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import { Button }   from '@/components/ui/button';
import { Badge }    from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Save, Lock, User, CheckCircle2, AlertCircle,
  Loader2, FileText, Download,
} from 'lucide-react';
import { ProfilePictureUpload } from '@/components/profile/ProfilePictureUpload';
import { DownloadButton }       from './AllPayslips';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ProfileState {
  firstName: string;
  lastName:  string;
  email:     string;
}
interface PasswordState {
  oldPassword:     string;
  newPassword:     string;
  confirmPassword: string;
}
type StatusMessage = { text: string; type: 'success' | 'error' } | null;

const EMPTY_PASSWORD: PasswordState = {
  oldPassword: '', newPassword: '', confirmPassword: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const monthName = (m: number) => format(new Date(2000, m - 1, 1), 'MMMM');

// ─── Inline banner ────────────────────────────────────────────────────────────
function MessageBanner({ message }: { message: StatusMessage }) {
  if (!message) return null;
  const ok = message.type === 'success';
  return (
    <div className={`flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm
      ${ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
      {ok
        ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
        : <AlertCircle  className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />}
      <p>{message.text}</p>
    </div>
  );
}

// ─── Payslips tab content ─────────────────────────────────────────────────────
function PayslipsTab() {
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [payslips,     setPayslips]     = useState<Payslip[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  const { handleDownload, isDownloading, downloadingId } = usePayslipDownload();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const slips = await api.getMyPayslips(selectedYear);
        if (!cancelled) setPayslips(slips);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load payslips');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [selectedYear]);

  return (
    <div className="space-y-4">

      {/* Sub-header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-900">Payslips &amp; Tax Documents</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Download your paid payslips. Payslips appear once HR marks them as paid.
          </p>
        </div>
        <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table card */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full rounded-md" />
              ))}
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 p-4 text-sm text-red-700 border-red-200 bg-red-50 rounded-md m-4">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : payslips.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-500">
                No paid payslips for {selectedYear}.
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Check back once HR processes and pays your payroll.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50">
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500">Month</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">Net Pay</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500 text-center">Status</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500 text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payslips.map(slip => {
                  const filename = `Payslip_${monthName(slip.payPeriod.month)}_${slip.payPeriod.year}.pdf`;
                  return (
                    <TableRow key={slip._id} className="hover:bg-gray-50 transition-colors">
                      <TableCell className="font-medium text-gray-900 text-sm py-3.5">
                        {monthName(slip.payPeriod.month)}
                        <span className="ml-1.5 text-xs text-gray-400">{slip.payPeriod.year}</span>
                      </TableCell>
                      <TableCell className="text-right text-sm font-bold text-gray-900 tabular-nums py-3.5">
                        {slip.netPay.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center py-3.5">
                        <Badge className="bg-green-50 text-green-700 hover:bg-green-50 border-green-200">
                          Paid
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center py-3.5">
                        <DownloadButton
                          payslipId={slip._id}
                          filename={filename}
                          isDownloading={isDownloading(slip._id)}
                          isAnyDownloading={!!downloadingId}
                          onDownload={handleDownload}
                        />
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
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function MyProfile() {
  const { user, setUser } = useAuth();

  const [profile, setProfile] = useState<ProfileState>({
    firstName: user?.name?.split(' ')[0] ?? '',
    lastName:  user?.name?.split(' ').slice(1).join(' ') ?? '',
    email:     user?.email ?? '',
  });
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [profileMessage,   setProfileMessage]   = useState<StatusMessage>(null);
  const [avatarUrl,        setAvatarUrl]        = useState<string | null>(
    (user as any)?.avatarUrl ?? null
  );

  const [password,          setPassword]          = useState<PasswordState>(EMPTY_PASSWORD);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [passwordMessage,   setPasswordMessage]   = useState<StatusMessage>(null);

  const setProfileField = <K extends keyof ProfileState>(key: K, val: string) => {
    setProfile(prev => ({ ...prev, [key]: val }));
    if (profileMessage) setProfileMessage(null);
  };

  const setPasswordField = <K extends keyof PasswordState>(key: K, val: string) => {
    setPassword(prev => ({ ...prev, [key]: val }));
    if (passwordMessage) setPasswordMessage(null);
  };

  const handleProfileSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setProfileMessage(null);
    if (!profile.firstName.trim() || !profile.lastName.trim() || !profile.email.trim()) {
      setProfileMessage({ text: 'All fields are required.', type: 'error' });
      return;
    }
    try {
      setIsProfileLoading(true);
      const updated = await api.updateMyProfile({
        firstName: profile.firstName.trim(),
        lastName:  profile.lastName.trim(),
        email:     profile.email.trim(),
      });
      setUser(prev => prev
        ? { ...prev, name: `${updated.profile.firstName} ${updated.profile.lastName}`, email: updated.email }
        : prev
      );
      setProfileMessage({ text: 'Profile updated successfully!', type: 'success' });
    } catch (err) {
      setProfileMessage({ text: err instanceof Error ? err.message : 'Failed to update profile.', type: 'error' });
    } finally {
      setIsProfileLoading(false);
    }
  };

  const handleAvatarSuccess = (publicUrl: string) => {
    setAvatarUrl(publicUrl);
    setUser(prev => prev ? { ...prev, avatarUrl: publicUrl } as any : prev);
  };

  const handlePasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPasswordMessage(null);
    if (!password.oldPassword || !password.newPassword || !password.confirmPassword) {
      setPasswordMessage({ text: 'All password fields are required.', type: 'error' }); return;
    }
    if (password.newPassword.length < 8) {
      setPasswordMessage({ text: 'New password must be at least 8 characters.', type: 'error' }); return;
    }
    if (password.newPassword !== password.confirmPassword) {
      setPasswordMessage({ text: 'New passwords do not match.', type: 'error' }); return;
    }
    if (password.oldPassword === password.newPassword) {
      setPasswordMessage({ text: 'New password must differ from the current password.', type: 'error' }); return;
    }
    try {
      setIsPasswordLoading(true);
      const res = await api.updateMyPassword({ oldPassword: password.oldPassword, newPassword: password.newPassword });
      setPassword(EMPTY_PASSWORD);
      setPasswordMessage({ text: res.message ?? 'Password updated successfully!', type: 'success' });
    } catch (err) {
      setPasswordMessage({ text: err instanceof Error ? err.message : 'Failed to update password.', type: 'error' });
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const initials = (profile.firstName.charAt(0) + profile.lastName.charAt(0)).toUpperCase() || '?';

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your personal information, security, and payslips.
        </p>
      </div>

      {/* Avatar row */}
      <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <ProfilePictureUpload
          currentAvatarUrl={avatarUrl}
          initials={initials}
          onSuccess={handleAvatarSuccess}
        />
        <div>
          <p className="text-base font-semibold text-gray-900">
            {profile.firstName} {profile.lastName}
          </p>
          <p className="text-sm text-gray-500">{profile.email}</p>
          <span className="mt-0.5 inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 capitalize">
            {user?.role?.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile">
        <TabsList className="mb-4">
          <TabsTrigger value="profile">
            <User className="mr-1.5 h-3.5 w-3.5" />
            Profile Info
          </TabsTrigger>
          <TabsTrigger value="security">
            <Lock className="mr-1.5 h-3.5 w-3.5" />
            Security
          </TabsTrigger>
          <TabsTrigger value="payslips">
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            Payslips
          </TabsTrigger>
        </TabsList>

        {/* ── Profile tab ─────────────────────────────────────────────────── */}
        <TabsContent value="profile">
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-indigo-50 p-1.5">
                  <User className="h-4 w-4 text-indigo-600" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold text-gray-900">Profile Information</CardTitle>
                  <CardDescription className="text-xs text-gray-500 mt-0.5">Update your personal details here.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <form onSubmit={handleProfileSubmit} noValidate>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName" className="text-sm font-medium text-gray-700">
                      First Name <span className="text-red-500">*</span>
                    </Label>
                    <Input id="firstName" value={profile.firstName}
                      onChange={e => setProfileField('firstName', e.target.value)}
                      disabled={isProfileLoading} placeholder="Sarah" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lastName" className="text-sm font-medium text-gray-700">
                      Last Name <span className="text-red-500">*</span>
                    </Label>
                    <Input id="lastName" value={profile.lastName}
                      onChange={e => setProfileField('lastName', e.target.value)}
                      disabled={isProfileLoading} placeholder="Johnson" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                    Email Address <span className="text-red-500">*</span>
                  </Label>
                  <Input id="email" type="email" value={profile.email}
                    onChange={e => setProfileField('email', e.target.value)}
                    disabled={isProfileLoading} placeholder="sarah@nexustech.com" />
                </div>
                <MessageBanner message={profileMessage} />
              </CardContent>
              <CardFooter className="pt-2">
                <Button type="submit" disabled={isProfileLoading} className="w-full sm:w-auto">
                  {isProfileLoading
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                    : <><Save className="mr-2 h-4 w-4" />Save Changes</>}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        {/* ── Security tab ────────────────────────────────────────────────── */}
        <TabsContent value="security">
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-amber-50 p-1.5">
                  <Lock className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold text-gray-900">Change Password</CardTitle>
                  <CardDescription className="text-xs text-gray-500 mt-0.5">
                    Use a long, random password to keep your account secure.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <form onSubmit={handlePasswordSubmit} noValidate>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="oldPassword" className="text-sm font-medium text-gray-700">
                    Current Password <span className="text-red-500">*</span>
                  </Label>
                  <Input id="oldPassword" type="password" value={password.oldPassword}
                    onChange={e => setPasswordField('oldPassword', e.target.value)}
                    disabled={isPasswordLoading} placeholder="••••••••" autoComplete="current-password" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="newPassword" className="text-sm font-medium text-gray-700">
                    New Password <span className="text-red-500">*</span>
                  </Label>
                  <Input id="newPassword" type="password" value={password.newPassword}
                    onChange={e => setPasswordField('newPassword', e.target.value)}
                    disabled={isPasswordLoading} placeholder="••••••••" autoComplete="new-password" />
                  <p className="text-xs text-gray-400">Minimum 8 characters.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                    Confirm New Password <span className="text-red-500">*</span>
                  </Label>
                  <Input id="confirmPassword" type="password" value={password.confirmPassword}
                    onChange={e => setPasswordField('confirmPassword', e.target.value)}
                    disabled={isPasswordLoading} placeholder="••••••••" autoComplete="new-password"
                    className={
                      password.confirmPassword && password.newPassword !== password.confirmPassword
                        ? 'border-red-400 focus-visible:ring-red-400' : ''
                    } />
                  {password.confirmPassword && password.newPassword !== password.confirmPassword && (
                    <p className="text-xs text-red-500">Passwords do not match.</p>
                  )}
                </div>
                <MessageBanner message={passwordMessage} />
              </CardContent>
              <CardFooter className="pt-2">
                <Button type="submit" disabled={isPasswordLoading} variant="outline"
                  className="w-full sm:w-auto border-amber-200 text-amber-700 hover:bg-amber-50 hover:border-amber-300">
                  {isPasswordLoading
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</>
                    : <><Lock className="mr-2 h-4 w-4" />Update Password</>}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        {/* ── Payslips tab ─────────────────────────────────────────────────── */}
        <TabsContent value="payslips">
          <PayslipsTab />
        </TabsContent>

      </Tabs>
    </div>
  );
}