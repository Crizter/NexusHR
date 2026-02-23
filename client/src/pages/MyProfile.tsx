import { useState }      from 'react';
import { useAuth }       from '@/context/AuthContext';
import { api }           from '@/lib/api';
import {
  Card, CardContent, CardDescription,
  CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Input }   from '@/components/ui/input';
import { Label }   from '@/components/ui/label';
import { Button }  from '@/components/ui/button';
import {
  Save, Lock, User, CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react';

// ─── Inline message (success or error) ───────────────────────────────────────
interface MessageBannerProps {
  message: { text: string; type: 'success' | 'error' } | null;
}

function MessageBanner({ message }: MessageBannerProps) {
  if (!message) return null;

  const isSuccess = message.type === 'success';
  return (
    <div
      className={`flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm
        ${isSuccess
          ? 'border-green-200 bg-green-50  text-green-800'
          : 'border-red-200   bg-red-50    text-red-800'
        }`}
    >
      {isSuccess
        ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
        : <AlertCircle  className="mt-0.5 h-4 w-4 shrink-0 text-red-500"   />}
      <p>{message.text}</p>
    </div>
  );
}

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
  oldPassword:     '',
  newPassword:     '',
  confirmPassword: '',
};

// ─── Main component ───────────────────────────────────────────────────────────
export function MyProfile() {
  const { user, setUser } = useAuth();

  // ── Profile form state ─────────────────────────────────────────────────────
  const [profile, setProfile] = useState<ProfileState>({
    firstName: user?.name?.split(' ')[0] ?? '',
    lastName:  user?.name?.split(' ').slice(1).join(' ') ?? '',
    email:     user?.email ?? '',
  });
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [profileMessage,   setProfileMessage]   = useState<StatusMessage>(null);

  // ── Password form state ────────────────────────────────────────────────────
  const [password,         setPassword]         = useState<PasswordState>(EMPTY_PASSWORD);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [passwordMessage,  setPasswordMessage]  = useState<StatusMessage>(null);

  // ── Profile field updater ──────────────────────────────────────────────────
  const setProfileField = <K extends keyof ProfileState>(key: K, val: string) => {
    setProfile(prev => ({ ...prev, [key]: val }));
    if (profileMessage) setProfileMessage(null);
  };

  // ── Password field updater ─────────────────────────────────────────────────
  const setPasswordField = <K extends keyof PasswordState>(key: K, val: string) => {
    setPassword(prev => ({ ...prev, [key]: val }));
    if (passwordMessage) setPasswordMessage(null);
  };

  // ── Submit: update profile ─────────────────────────────────────────────────
  const handleProfileSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setProfileMessage(null);

    if (!profile.firstName.trim() || !profile.lastName.trim() || !profile.email.trim()) {
      setProfileMessage({ text: 'All fields are required.', type: 'error' });
      return;
    }

    try {
      setIsProfileLoading(true);
      const updatedUser = await api.updateMyProfile({
        firstName: profile.firstName.trim(),
        lastName:  profile.lastName.trim(),
        email:     profile.email.trim(),
      });

      // Update global auth context so navbar / avatar reflects new name
      setUser(prev => prev
        ? { ...prev, name: `${updatedUser.profile.firstName} ${updatedUser.profile.lastName}`, email: updatedUser.email }
        : prev
      );

      setProfileMessage({ text: 'Profile updated successfully!', type: 'success' });
    } catch (err) {
      setProfileMessage({
        text: err instanceof Error ? err.message : 'Failed to update profile.',
        type: 'error',
      });
    } finally {
      setIsProfileLoading(false);
    }
  };

  // ── Submit: change password ────────────────────────────────────────────────
  const handlePasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPasswordMessage(null);

    // Client-side validation
    if (!password.oldPassword || !password.newPassword || !password.confirmPassword) {
      setPasswordMessage({ text: 'All password fields are required.', type: 'error' });
      return;
    }

    if (password.newPassword.length < 8) {
      setPasswordMessage({ text: 'New password must be at least 8 characters.', type: 'error' });
      return;
    }

    if (password.newPassword !== password.confirmPassword) {
      setPasswordMessage({ text: 'New passwords do not match.', type: 'error' });
      return;
    }

    if (password.oldPassword === password.newPassword) {
      setPasswordMessage({ text: 'New password must differ from the current password.', type: 'error' });
      return;
    }

    try {
      setIsPasswordLoading(true);
      const response = await api.updateMyPassword({
        oldPassword: password.oldPassword,
        newPassword: password.newPassword,
      });

      setPassword(EMPTY_PASSWORD);
      setPasswordMessage({ text: response.message ?? 'Password updated successfully!', type: 'success' });
    } catch (err) {
      setPasswordMessage({
        text: err instanceof Error ? err.message : 'Failed to update password.',
        type: 'error',
      });
    } finally {
      setIsPasswordLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your personal information and account security.
        </p>
      </div>

      {/* Avatar + display name row */}
      <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-lg font-bold text-indigo-600 select-none">
          {profile.firstName.charAt(0).toUpperCase()}
          {profile.lastName.charAt(0).toUpperCase()}
        </div>
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

      {/* Two-column grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

        {/* ── Card 1: Profile Information ──────────────────────────────────── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-indigo-50 p-1.5">
                <User className="h-4 w-4 text-indigo-600" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-gray-900">
                  Profile Information
                </CardTitle>
                <CardDescription className="text-xs text-gray-500 mt-0.5">
                  Update your personal details here.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <form onSubmit={handleProfileSubmit} noValidate>
            <CardContent className="space-y-4">

              {/* First + Last name */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName" className="text-sm font-medium text-gray-700">
                    First Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="firstName"
                    value={profile.firstName}
                    onChange={(e) => setProfileField('firstName', e.target.value)}
                    disabled={isProfileLoading}
                    placeholder="Sarah"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName" className="text-sm font-medium text-gray-700">
                    Last Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    value={profile.lastName}
                    onChange={(e) => setProfileField('lastName', e.target.value)}
                    disabled={isProfileLoading}
                    placeholder="Johnson"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                  Email Address <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfileField('email', e.target.value)}
                  disabled={isProfileLoading}
                  placeholder="sarah@nexustech.com"
                />
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

        {/* ── Card 2: Change Password ───────────────────────────────────────── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-amber-50 p-1.5">
                <Lock className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-gray-900">
                  Change Password
                </CardTitle>
                <CardDescription className="text-xs text-gray-500 mt-0.5">
                  Ensure your account is using a long, random password to stay secure.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <form onSubmit={handlePasswordSubmit} noValidate>
            <CardContent className="space-y-4">

              {/* Current password */}
              <div className="space-y-1.5">
                <Label htmlFor="oldPassword" className="text-sm font-medium text-gray-700">
                  Current Password <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="oldPassword"
                  type="password"
                  value={password.oldPassword}
                  onChange={(e) => setPasswordField('oldPassword', e.target.value)}
                  disabled={isPasswordLoading}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>

              {/* New password */}
              <div className="space-y-1.5">
                <Label htmlFor="newPassword" className="text-sm font-medium text-gray-700">
                  New Password <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={password.newPassword}
                  onChange={(e) => setPasswordField('newPassword', e.target.value)}
                  disabled={isPasswordLoading}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                <p className="text-xs text-gray-400">Minimum 8 characters.</p>
              </div>

              {/* Confirm new password */}
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                  Confirm New Password <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={password.confirmPassword}
                  onChange={(e) => setPasswordField('confirmPassword', e.target.value)}
                  disabled={isPasswordLoading}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className={
                    password.confirmPassword &&
                    password.newPassword !== password.confirmPassword
                      ? 'border-red-400 focus-visible:ring-red-400'
                      : ''
                  }
                />
                {/* Inline mismatch hint */}
                {password.confirmPassword &&
                 password.newPassword !== password.confirmPassword && (
                  <p className="text-xs text-red-500">Passwords do not match.</p>
                )}
              </div>

              <MessageBanner message={passwordMessage} />
            </CardContent>

            <CardFooter className="pt-2">
              <Button
                type="submit"
                disabled={isPasswordLoading}
                variant="outline"
                className="w-full sm:w-auto border-amber-200 text-amber-700 hover:bg-amber-50 hover:border-amber-300"
              >
                {isPasswordLoading
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</>
                  : <><Lock className="mr-2 h-4 w-4" />Update Password</>}
              </Button>
            </CardFooter>
          </form>
        </Card>

      </div>
    </div>
  );
}