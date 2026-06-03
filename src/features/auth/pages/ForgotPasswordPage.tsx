import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/authStore';
import { Button, Card, CardContent, Input } from '@/components/ui';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const ForgotPasswordPage: React.FC = () => {
  const { resetPassword } = useAuthStore();
  const [isSent, setIsSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    try {
      await resetPassword(values.email);
      setIsSent(true);
      toast.success('Password reset email sent successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send reset link. Please try again.');
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <Link to="/login" className="auth-back-link">
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>

        <div className="space-y-3 text-center">
          <h1 className="text-3xl font-extrabold tracking-[-0.03em] text-text-primary">Reset your password</h1>
          <p className="mx-auto max-w-md text-sm text-text-secondary">
            Enter your email address and we&apos;ll send you a secure link to choose a new password.
          </p>
        </div>

        <Card variant="elevated">
          <CardContent className="p-6 sm:p-7">
            {isSent ? (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-light text-success">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-bold tracking-[-0.02em] text-text-primary">Check your email</h2>
                  <p className="text-sm leading-6 text-text-secondary">
                    We&apos;ve sent a password reset link to your inbox. Use it to finish setting a new password.
                  </p>
                </div>
                <Link to="/login" className="w-full">
                  <Button fullWidth>Return to Sign In</Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <Input
                  {...register('email')}
                  label="Email address"
                  placeholder="dealer@example.com"
                  type="email"
                  leftIcon={<Mail className="h-4.5 w-4.5" />}
                  autoComplete="email"
                  error={errors.email?.message}
                />
                <Button type="submit" fullWidth size="lg" loading={isSubmitting}>
                  Send Reset Link
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
