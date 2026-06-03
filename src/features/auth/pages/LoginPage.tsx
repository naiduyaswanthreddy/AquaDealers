import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Mail, Lock, Package, FileText, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/authStore';
import { Button, Input } from '@/components/ui';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const { login } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      await login(values.email, values.password);
      toast.success('Successfully signed in');
      navigate(from, { replace: true });
    } catch (error: any) {
      toast.error(error.message || 'Invalid email or password. Please try again.');
    }
  };

  return (
    <div className="min-h-[100dvh] w-full grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] bg-[#f8fbff] overflow-hidden">
      {/* Left Panel - Branding */}
      <div className="relative flex flex-col justify-center items-start px-8 py-12 lg:px-16 xl:px-28 z-10 hidden md:flex">
        <div className="z-20 w-full max-w-[500px]">
          <img src="/full_logo.png" alt="AquaDealer" className="h-[5.5rem] w-auto mb-16" />
          
          <h1 className="text-[2.75rem] leading-[1.15] font-extrabold text-[#1e293b] mb-6 tracking-tight">
            Smart aqua <br/>
            business management <br/>
            <span className="text-[#0088ff]">made simple</span>
          </h1>
          
          <p className="text-slate-500 text-lg mb-16 max-w-[26rem] font-medium leading-relaxed">
            Manage inventory, generate bills and grow your aqua business efficiently.
          </p>
          
          <div className="flex items-start gap-10">
            <div className="flex flex-col items-center gap-3">
              <div className="bg-white p-3.5 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-slate-100 text-[#0088ff]">
                <Package className="h-6 w-6 stroke-[2.5]" />
              </div>
              <span className="text-[0.8rem] font-bold text-slate-700 text-center leading-tight">Inventory<br/>Management</span>
            </div>
            
            <div className="flex flex-col items-center gap-3">
              <div className="bg-white p-3.5 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-slate-100 text-[#0088ff]">
                <FileText className="h-6 w-6 stroke-[2.5]" />
              </div>
              <span className="text-[0.8rem] font-bold text-slate-700 text-center leading-tight">Smart<br/>Billing</span>
            </div>
            
            <div className="flex flex-col items-center gap-3">
              <div className="bg-white p-3.5 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-slate-100 text-[#0088ff]">
                <TrendingUp className="h-6 w-6 stroke-[2.5]" />
              </div>
              <span className="text-[0.8rem] font-bold text-slate-700 text-center leading-tight">Business<br/>Growth</span>
            </div>
          </div>
        </div>

        {/* Decorative Waves */}
        <svg className="absolute bottom-0 left-0 w-full h-auto z-10 pointer-events-none translate-y-2 lg:scale-105 origin-bottom" viewBox="0 0 1440 320" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path fill="#e0f2fe" fillOpacity="0.4" d="M0,256L48,229.3C96,203,192,149,288,154.7C384,160,480,224,576,218.7C672,213,768,139,864,128C960,117,1056,171,1152,197.3C1248,224,1344,224,1392,224L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
          <path fill="#bae6fd" fillOpacity="0.25" d="M0,192L48,197.3C96,203,192,213,288,229.3C384,245,480,267,576,250.7C672,235,768,181,864,181.3C960,181,1056,235,1152,234.7C1248,235,1344,181,1392,154.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
        </svg>
      </div>

      {/* Right Panel - Form */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-center relative z-20 h-[100dvh] lg:h-auto lg:p-12 lg:bg-transparent bg-[#0052cc] overflow-hidden">
        
        {/* Mobile Header (Hidden on Desktop) */}
        <div className="lg:hidden flex flex-col items-center justify-center pt-10 pb-8 relative px-4 shrink-0">
          <button 
            type="button" 
            onClick={() => navigate(from, { replace: true })} 
            className="absolute left-4 top-10 text-white p-2"
            aria-label="Go back"
          >
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <img src="/full logo white.png" alt="AquaDealer Logo" className="h-[7rem] w-auto mt-2" />
        </div>

        {/* Form Container (White Card) */}
        <div className="w-full flex-1 lg:flex-none max-w-[440px] bg-white rounded-t-[2rem] lg:rounded-3xl p-8 pt-10 sm:p-11 shadow-[0_-8px_30px_rgb(0,0,0,0.08)] lg:shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-0 lg:border lg:border-slate-100 mx-auto overflow-y-auto">
          <h2 className="text-[1.6rem] font-extrabold text-[#0f172a] mb-2 tracking-tight">Welcome back!</h2>
          <p className="text-slate-500 text-[0.9rem] font-medium mb-8">Login to your account</p>
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-[0.85rem] font-bold text-slate-700 mb-1.5">Email or Mobile Number</label>
              <Input
                {...register('email')}
                type="email"
                placeholder="Enter your email or mobile number"
                leftIcon={<Mail className="h-4.5 w-4.5 text-slate-400" />}
                autoComplete="email"
                error={errors.email?.message}
                className="bg-slate-50 border-slate-200 focus:bg-white h-12"
              />
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[0.85rem] font-bold text-slate-700">Password</label>
                <Link to="/forgot-password" className="text-[0.85rem] font-bold text-[#0066cc] hover:text-[#0047b3]">
                  Forgot?
                </Link>
              </div>
              <Input
                {...register('password')}
                type="password"
                placeholder="Enter your password"
                leftIcon={<Lock className="h-4.5 w-4.5 text-slate-400" />}
                autoComplete="current-password"
                error={errors.password?.message}
                className="bg-slate-50 border-slate-200 focus:bg-white h-12"
              />
            </div>

            <div className="flex items-center gap-2 pt-1 pb-2">
              <input type="checkbox" id="remember" className="rounded-sm w-4 h-4 border-slate-300 text-[#0047b3] focus:ring-[#0047b3]" />
              <label htmlFor="remember" className="text-sm font-semibold text-slate-500 cursor-pointer">Remember me</label>
            </div>
            
            <Button type="submit" variant="primary" className="w-full h-[3.25rem] text-[1.05rem] rounded-xl font-bold transition-colors" loading={isSubmitting}>
              Login
            </Button>
            
            <p className="text-center text-[0.95rem] font-semibold text-slate-500 mt-6">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="text-[#0066cc] font-black hover:underline underline-offset-4">
                Sign up
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
