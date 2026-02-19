import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { mockApi } from '@/lib/mockApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';

// ─── Form state shape ─────────────────────────────────────────────────────────
interface FormState {
  email:    string;
  password: string;
}

interface FormErrors {
  email?:    string;
  password?: string;
}

export function LoginForm() {
  const { login }  = useAuth();
  const navigate   = useNavigate();

  // ── State ──────────────────────────────────────────────────────────────────
  const [form, setForm]               = useState<FormState>({ email: '', password: '' });
  const [formErrors, setFormErrors]   = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // ── Field helper ───────────────────────────────────────────────────────────
  const setField = <K extends keyof FormState>(key: K, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    // Clear per-field error as the user starts correcting
    if (formErrors[key]) {
      setFormErrors(prev => ({ ...prev, [key]: undefined }));
    }
    // Clear banner error on any change
    if (submitError) setSubmitError(null);
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const errors: FormErrors = {};

    if (!form.email.trim()) {
      errors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!form.password) {
      errors.password = 'Password is required.';
    } else if (form.password.length < 6) {
      errors.password = 'Password must be at least 6 characters.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      // Call the real mockApi — returns an AuthUser shaped object
      const authUser = await mockApi.login(form.email.trim(), form.password);

      // Persist into AuthContext + sessionStorage
      await login(authUser);

      // Navigate to the dashboard on success
      navigate('/dashboard');

    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Login failed. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">

      {/* ── API-level error banner ────────────────────────────────────────── */}
      {submitError && (
        <div className="flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 px-3 py-2.5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <p className="text-sm text-red-700">{submitError}</p>
        </div>
      )}

      {/* ── Email ─────────────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-sm font-medium text-gray-700">
          Email address
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="sarah.johnson@nexustech.com"
          value={form.email}
          onChange={(e) => setField('email', e.target.value)}
          disabled={isSubmitting}
          className={formErrors.email ? 'border-red-400 focus-visible:ring-red-300' : ''}
        />
        {formErrors.email && (
          <p className="text-xs text-red-500">{formErrors.email}</p>
        )}
      </div>

      {/* ── Password ──────────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-sm font-medium text-gray-700">
          Password
        </Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Enter your password"
            value={form.password}
            onChange={(e) => setField('password', e.target.value)}
            disabled={isSubmitting}
            className={`pr-10 ${formErrors.password ? 'border-red-400 focus-visible:ring-red-300' : ''}`}
          />
          {/* Toggle visibility */}
          <button
            type="button"
            onClick={() => setShowPassword(prev => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {showPassword
              ? <EyeOff className="h-4 w-4" />
              : <Eye    className="h-4 w-4" />
            }
          </button>
        </div>
        {formErrors.password && (
          <p className="text-xs text-red-500">{formErrors.password}</p>
        )}
      </div>

      {/* ── Submit ────────────────────────────────────────────────────────── */}
      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Signing in...
          </>
        ) : (
          'Sign In'
        )}
      </Button>

      {/* ── Dev hint (remove before production) ──────────────────────────── */}
      <p className="text-center text-xs text-gray-400">
        Try: <span className="font-mono">sarah.johnson@nexustech.com</span>
      </p>
    </form>
  );
}