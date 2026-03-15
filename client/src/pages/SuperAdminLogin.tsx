import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input }  from '@/components/ui/input';
import { Label }  from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

const API_BASE = import.meta.env.VITE_API_URL as string;

export function SuperAdminLogin() {
  const navigate = useNavigate();

  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [error,     setError]     = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res  = await fetch(`${API_BASE}/super-admin/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message ?? 'Authentication failed.');
        return;
      }

      // Store separately from the tenant nexus_user sessionStorage token
      localStorage.setItem('adminToken', data.token);
      navigate('/super-admin');

    } catch {
      setError('Network error — unable to reach the server.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Brand mark */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600 shadow-lg shadow-violet-900/40">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400">
              NexusHR Platform
            </p>
            <h1 className="text-xl font-bold text-white mt-1">Super Admin Console</h1>
          </div>
        </div>

        {/* Card */}
        <Card className="border-gray-800 bg-gray-900 shadow-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold text-gray-100">
              Authenticate
            </CardTitle>
            <CardDescription className="text-gray-500 text-sm">
              Restricted access. Authorised personnel only.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {error && (
              <Alert variant="destructive" className="border-red-900 bg-red-950/60">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-red-300 text-sm">{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleLogin} noValidate className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="sa-email" className="text-sm text-gray-300">
                  Email
                </Label>
                <Input
                  id="sa-email"
                  type="email"
                  autoComplete="username"
                  placeholder="admin@nexushr.io"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(null); }}
                  disabled={isLoading}
                  required
                  className="border-gray-700 bg-gray-800 text-gray-100 placeholder:text-gray-600 focus-visible:ring-violet-500 focus-visible:border-violet-500"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sa-password" className="text-sm text-gray-300">
                  Password
                </Label>
                <Input
                  id="sa-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••••"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(null); }}
                  disabled={isLoading}
                  required
                  className="border-gray-700 bg-gray-800 text-gray-100 placeholder:text-gray-600 focus-visible:ring-violet-500 focus-visible:border-violet-500"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading || !email || !password}
                className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold shadow-sm shadow-violet-900/30 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  'Login'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-700">
          © {new Date().getFullYear()} NexusHR · Restricted system access
        </p>

      </div>
    </div>
  );
}