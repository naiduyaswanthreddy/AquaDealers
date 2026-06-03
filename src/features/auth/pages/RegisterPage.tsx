import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, MapPin, Phone, Store, User, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { AP_DISTRICTS } from '@/lib/constants';
import { useAuthStore } from '@/stores/authStore';
import { Button, Input, Select } from '@/components/ui';

const registerSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    shopName: z.string().min(3, 'Shop name must be at least 3 characters'),
    phone: z.string().regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit mobile number'),
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
    district: z.string().min(1, 'Please select a district'),
    state: z.string().default('Andhra Pradesh'),
    terms: z.boolean().refine((val) => val === true, {
      message: 'You must agree to the terms',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export const RegisterPage: React.FC = () => {
  const { register: registerDealer } = useAuthStore();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      shopName: '',
      phone: '',
      email: '',
      password: '',
      confirmPassword: '',
      district: '',
      state: 'Andhra Pradesh',
      terms: false,
    },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    try {
      await registerDealer({
        name: values.name,
        shopName: values.shopName,
        phone: values.phone,
        email: values.email,
        password: values.password,
        district: values.district,
        state: values.state,
      });
      toast.success('Account created. Welcome to AquaDealer.');
      navigate('/onboarding');
    } catch (error: any) {
      toast.error(error.message || 'Registration failed. Please try again.');
    }
  };

  const districtOptions = AP_DISTRICTS.map((district) => ({
    value: district,
    label: district,
  }));

  return (
    <div className="h-[100dvh] w-full grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] overflow-hidden bg-white">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex flex-col bg-[#0052cc] pt-12 px-12 xl:px-16 relative text-white z-10 overflow-hidden h-full">
        <div className="relative z-20 flex-shrink-0">
          <img 
            src="/full logo white.png" 
            alt="AquaDealer" 
            className="h-36 w-auto mb-8" 
          />
          
          <h1 className="text-[2.25rem] leading-[1.2] font-bold mb-4 tracking-tight">
            Create your account
          </h1>
          
          <p className="text-blue-100 text-[1rem] mb-8 max-w-md font-medium leading-relaxed">
            Join AquaDealer and take your<br/>aqua business to the next level.
          </p>
          
          <ul className="space-y-3">
            <li className="flex items-center gap-3">
              <CheckCircle2 className="h-[1.15rem] w-[1.15rem] text-white" />
              <span className="text-[0.95rem] font-medium text-white">Easy Inventory Management</span>
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 className="h-[1.15rem] w-[1.15rem] text-white" />
              <span className="text-[0.95rem] font-medium text-white">Professional Billing</span>
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 className="h-[1.15rem] w-[1.15rem] text-white" />
              <span className="text-[0.95rem] font-medium text-white">Business Growth Insights</span>
            </li>
          </ul>
        </div>
        
        {/* The Giant Blue Prawn Graphic */}
        <div className="absolute bottom-0 left-[-5%] w-[110%] z-10 pointer-events-none flex items-end justify-center h-[50%]">
          <img 
            src="/full prawn.png" 
            alt="Prawn Graphic" 
            className="w-[48%] h-auto object-contain object-bottom transform translate-y-[5%]" 
          />
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-center relative z-20 h-[100dvh] lg:h-auto lg:p-8 lg:bg-transparent bg-[#0052cc] overflow-hidden">
        
        {/* Mobile Header (Hidden on Desktop) */}
        <div className="lg:hidden flex flex-col pt-10 pb-6 relative px-4 shrink-0">
          <button 
            type="button" 
            onClick={() => navigate('/login')} 
            className="absolute left-4 top-10 text-white p-2"
            aria-label="Go back"
          >
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
        </div>

        <div className="w-full flex-1 lg:flex-none flex flex-col lg:justify-center max-w-[480px] bg-white rounded-t-[2rem] lg:rounded-none p-6 pt-8 lg:p-0 shadow-[0_-8px_30px_rgb(0,0,0,0.08)] lg:shadow-none h-full overflow-y-auto mx-auto">
          
          <h2 className="text-[1.6rem] font-extrabold text-[#0f172a] mb-1 tracking-tight">Create your account</h2>
          <p className="text-slate-500 text-[0.85rem] font-medium mb-6">Fill in the details to get started</p>
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[0.8rem] font-bold text-slate-700 mb-1">Full Name</label>
                <Input
                  {...register('name')}
                  placeholder="Owner name"
                  leftIcon={<User className="h-4 w-4 text-slate-400" />}
                  error={errors.name?.message}
                  className="bg-white border-slate-200 focus:bg-white h-[2.6rem] text-[0.85rem]"
                />
              </div>
              <div>
                <label className="block text-[0.8rem] font-bold text-slate-700 mb-1">Shop Name</label>
                <Input
                  {...register('shopName')}
                  placeholder="Balaji Aqua"
                  leftIcon={<Store className="h-4 w-4 text-slate-400" />}
                  error={errors.shopName?.message}
                  className="bg-white border-slate-200 focus:bg-white h-[2.6rem] text-[0.85rem]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[0.8rem] font-bold text-slate-700 mb-1">Mobile Number</label>
                <Input
                  {...register('phone')}
                  type="tel"
                  placeholder="10-digit number"
                  leftIcon={<Phone className="h-4 w-4 text-slate-400" />}
                  error={errors.phone?.message}
                  className="bg-white border-slate-200 focus:bg-white h-[2.6rem] text-[0.85rem]"
                />
              </div>
              <div>
                <label className="block text-[0.8rem] font-bold text-slate-700 mb-1">Email Address</label>
                <Input
                  {...register('email')}
                  type="email"
                  placeholder="dealer@example.com"
                  leftIcon={<Mail className="h-4 w-4 text-slate-400" />}
                  error={errors.email?.message}
                  className="bg-white border-slate-200 focus:bg-white h-[2.6rem] text-[0.85rem]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[0.8rem] font-bold text-slate-700 mb-1">District</label>
                <Select
                  {...register('district')}
                  options={districtOptions}
                  placeholder="Select district"
                  error={errors.district?.message}
                  className="bg-white border-slate-200 focus:bg-white h-[2.6rem] text-[0.85rem]"
                />
              </div>
              <div>
                <label className="block text-[0.8rem] font-bold text-slate-700 mb-1">State</label>
                <Input
                  {...register('state')}
                  leftIcon={<MapPin className="h-4 w-4 text-slate-400" />}
                  disabled
                  className="bg-slate-50 border-slate-200 h-[2.6rem] text-[0.85rem] text-slate-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[0.8rem] font-bold text-slate-700 mb-1">Password</label>
                <Input
                  {...register('password')}
                  type="password"
                  placeholder="Min 6 characters"
                  leftIcon={<Lock className="h-4 w-4 text-slate-400" />}
                  error={errors.password?.message}
                  className="bg-white border-slate-200 focus:bg-white h-[2.6rem] text-[0.85rem]"
                />
              </div>
              <div>
                <label className="block text-[0.8rem] font-bold text-slate-700 mb-1">Confirm Password</label>
                <Input
                  {...register('confirmPassword')}
                  type="password"
                  placeholder="Re-enter password"
                  leftIcon={<Lock className="h-4 w-4 text-slate-400" />}
                  error={errors.confirmPassword?.message}
                  className="bg-white border-slate-200 focus:bg-white h-[2.6rem] text-[0.85rem]"
                />
              </div>
            </div>

            <div className="pt-1 pb-2 flex items-start gap-2">
              <input 
                type="checkbox" 
                id="terms"
                {...register('terms')}
                className="mt-0.5 w-3.5 h-3.5 rounded border-slate-300 text-[#0047b3] focus:ring-[#0047b3] shrink-0 cursor-pointer" 
              />
              <div className="flex flex-col">
                <label htmlFor="terms" className="text-[0.75rem] font-medium text-[#0f172a] cursor-pointer leading-snug">
                  I agree to the <span className="text-[#0052cc] font-bold">Terms & Conditions</span> and <span className="text-[#0052cc] font-bold">Privacy Policy</span>
                </label>
                {errors.terms && <span className="text-red-500 text-xs font-medium mt-0.5">{errors.terms.message}</span>}
              </div>
            </div>
            
            <Button type="submit" variant="primary" className="w-full h-[2.75rem] text-[0.95rem] rounded-xl font-bold transition-colors shadow-none mt-1" loading={isSubmitting}>
              Sign up
            </Button>
            
            <p className="text-center text-[0.85rem] font-semibold text-slate-700 mt-3">
              Already have an account?{' '}
              <Link to="/login" className="text-[#0052cc] font-bold hover:underline underline-offset-4">
                Login
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
