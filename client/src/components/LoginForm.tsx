// src/components/LoginForm.tsx (update the handleSubmit function)
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    orgId: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.password.trim()) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!formData.orgId.trim()) {
      newErrors.orgId = 'Organization ID is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      // TODO: Replace with actual API call
      const userData = {
        id: 'user-123',
        orgId: formData.orgId,
        name: 'John Doe',
        email: formData.email,
        role: 'hr_manager' as const,
      };

      await login(userData);
      navigate('/dashboard'); // Navigate to dashboard after successful login
    } catch (error) {
      console.error('Login failed:', error);
      setErrors({ general: 'Login failed. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors.general && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {errors.general}
        </div>
      )}
      
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          className={errors.email ? 'border-red-500' : ''}
        />
        {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
      </div>

      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={formData.password}
          onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
          className={errors.password ? 'border-red-500' : ''}
        />
        {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
      </div>

      <div>
        <Label htmlFor="orgId">Organization ID</Label>
        <Input
          id="orgId"
          value={formData.orgId}
          onChange={(e) => setFormData(prev => ({ ...prev, orgId: e.target.value }))}
          className={errors.orgId ? 'border-red-500' : ''}
        />
        {errors.orgId && <p className="text-red-500 text-sm mt-1">{errors.orgId}</p>}
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Signing in...' : 'Sign In'}
      </Button>
    </form>
  );
}